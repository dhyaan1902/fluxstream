import React, { useEffect, useState, useRef } from 'react';
import { Download, RefreshCw, Users, ArrowDown, AlertTriangle, Play, Settings, X, Volume2, Subtitles } from 'lucide-react';
import { subtitleService } from '../../../services/subtitleService';

interface TorrentPlayerProps {
    magnet: string;
    title?: string;
    imdbId?: string; // Add for subtitle fetching
}

interface TorrentFile {
    index: number;
    name: string;
    length: number;
    path: string;
    type?: 'video' | 'subtitle' | 'other';
    subtitles?: SubtitleTrack[];
}

interface SubtitleTrack {
    index: number;
    name: string;
    language: string;
    label: string;
}

interface AudioTrackInfo {
    id: string;
    kind: string;
    label: string;
    language: string;
    enabled: boolean;
}

interface TorrentStatus {
    downloaded: number;
    downloadSpeed: number;
    uploadSpeed: number;
    peers: number;
}

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/torrent`;

// Helper function to detect language from subtitle filename
const detectLanguage = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.includes('.eng.') || lower.includes('.en.') || lower.includes('english')) return 'en';
    if (lower.includes('.spa.') || lower.includes('.es.') || lower.includes('spanish')) return 'es';
    if (lower.includes('.fre.') || lower.includes('.fr.') || lower.includes('french')) return 'fr';
    if (lower.includes('.ger.') || lower.includes('.de.') || lower.includes('german')) return 'de';
    if (lower.includes('.ita.') || lower.includes('.it.') || lower.includes('italian')) return 'it';
    if (lower.includes('.por.') || lower.includes('.pt.') || lower.includes('portuguese')) return 'pt';
    if (lower.includes('.jpn.') || lower.includes('.ja.') || lower.includes('japanese')) return 'ja';
    if (lower.includes('.kor.') || lower.includes('.ko.') || lower.includes('korean')) return 'ko';
    if (lower.includes('.chi.') || lower.includes('.zh.') || lower.includes('chinese')) return 'zh';
    if (lower.includes('.hin.') || lower.includes('.hi.') || lower.includes('hindi')) return 'hi';
    return 'unknown';
};

export const TorrentPlayer: React.FC<TorrentPlayerProps> = ({ magnet, title, imdbId }) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [torrentId, setTorrentId] = useState<string | null>(null);
    const [files, setFiles] = useState<TorrentFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<number>(0);
    const [torrentStatus, setTorrentStatus] = useState<TorrentStatus | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
    const [currentAudioTrack, setCurrentAudioTrack] = useState<string>('');
    const [currentSubtitle, setCurrentSubtitle] = useState<number>(-1);
    const [needsTranscoding, setNeedsTranscoding] = useState<boolean>(false);
    const [videoDuration, setVideoDuration] = useState<number>(0);

    // OpenSubtitles integration
    const [externalSubtitleUrl, setExternalSubtitleUrl] = useState<string | null>(null);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
    const [loadingSubtitles, setLoadingSubtitles] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const wakeLockRef = useRef<any>(null);

    // Add torrent
    useEffect(() => {
        const addTorrent = async () => {
            try {
                const res = await fetch(`${API_BASE}/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ magnet })
                });

                if (!res.ok) throw new Error('Failed to add torrent');

                const data = await res.json();
                setTorrentId(data.id);
                setFiles(data.files);

                // Auto-select largest video file
                const videoFile = data.files.find((f: TorrentFile) =>
                    /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name)
                ) || data.files.reduce((a: TorrentFile, b: TorrentFile) =>
                    a.length > b.length ? a : b
                );

                setSelectedFile(videoFile.index);

                // Auto-detect subtitle files in the torrent
                const subtitleFiles = data.files.filter((f: TorrentFile) =>
                    /\.(srt|vtt|ass|ssa|sub)$/i.test(f.name)
                );

                // Store subtitle files for later use
                if (subtitleFiles.length > 0) {
                    console.log(`Found ${subtitleFiles.length} subtitle files:`, subtitleFiles.map(f => f.name));
                    videoFile.subtitles = subtitleFiles.map((f, idx) => ({
                        index: f.index,
                        name: f.name,
                        language: detectLanguage(f.name),
                        label: f.name.split('/').pop() || `Subtitle ${idx + 1}`
                    }));
                }

                // Check if file needs transcoding
                const needsTranscode = /\.(mkv|avi|flv|wmv|m4v|3gp|divx)$/i.test(videoFile.name);
                setNeedsTranscoding(needsTranscode);

                // Fetch video metadata to get actual duration
                try {
                    const metadataRes = await fetch(`${API_BASE}/${data.id}/metadata/${videoFile.index}`);
                    if (metadataRes.ok) {
                        const metadata = await metadataRes.json();
                        setVideoDuration(metadata.duration);
                        console.log(`Video duration: ${metadata.duration}s (${Math.floor(metadata.duration / 60)}m ${Math.floor(metadata.duration % 60)}s)`);
                    }
                } catch (err) {
                    console.warn('Failed to fetch metadata:', err);
                }

                setStatus('ready');
            } catch (err: any) {
                setStatus('error');
                setErrorMsg(err.message);
            }
        };

        addTorrent();

        return () => {
            // Cleanup: remove torrent on unmount
            if (torrentId) {
                fetch(`${API_BASE}/${torrentId}`, { method: 'DELETE' });
            }
        };
    }, [magnet]);

    // Poll status
    useEffect(() => {
        if (!torrentId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/${torrentId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    setTorrentStatus(data);
                }
            } catch (e) {
                console.error('Status fetch error:', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [torrentId]);

    // Detect audio tracks when video metadata is loaded
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            const tracks: AudioTrackInfo[] = [];

            // Access audioTracks from video element
            if (video.audioTracks && video.audioTracks.length > 0) {
                for (let i = 0; i < video.audioTracks.length; i++) {
                    const track = video.audioTracks[i];
                    tracks.push({
                        id: track.id || `audio-${i}`,
                        kind: track.kind,
                        label: track.label || `Audio Track ${i + 1}`,
                        language: track.language || 'unknown',
                        enabled: track.enabled
                    });

                    if (track.enabled) {
                        setCurrentAudioTrack(track.id || `audio-${i}`);
                    }
                }
                setAudioTracks(tracks);
            }
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }, [isPlaying]);

    // Wake Lock: Keep screen awake during video playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const requestWakeLock = async () => {
            try {
                // Check if Wake Lock API is supported
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                    console.log('🔒 Wake Lock acquired - screen will stay on');

                    wakeLockRef.current.addEventListener('release', () => {
                        console.log('🔓 Wake Lock released');
                    });
                }
            } catch (err: any) {
                console.error('Wake Lock error:', err.message);
            }
        };

        const releaseWakeLock = async () => {
            if (wakeLockRef.current) {
                try {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                } catch (err: any) {
                    console.error('Wake Lock release error:', err.message);
                }
            }
        };

        const handlePlay = () => {
            requestWakeLock();
        };

        const handlePause = () => {
            releaseWakeLock();
        };

        const handleEnded = () => {
            releaseWakeLock();
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('ended', handleEnded);
            releaseWakeLock(); // Release on unmount
        };
    }, [isPlaying]);

    // Load subtitle files into video player
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !torrentId || !isPlaying) return;

        const currentFile = files.find(f => f.index === selectedFile);
        if (!currentFile?.subtitles || currentFile.subtitles.length === 0) return;

        // Remove existing text tracks
        while (video.textTracks.length > 0) {
            const track = video.textTracks[0];
            const trackElement = Array.from(video.querySelectorAll('track')).find(
                t => t.track === track
            );
            if (trackElement) {
                video.removeChild(trackElement);
            }
        }

        // Add subtitle tracks
        currentFile.subtitles.forEach((sub, idx) => {
            const track = document.createElement('track');
            track.kind = 'subtitles';
            track.label = sub.label;
            track.srclang = sub.language;
            track.src = `${API_BASE}/${torrentId}/stream/${sub.index}`;

            // Set first subtitle as default
            if (idx === 0) {
                track.default = true;
                setCurrentSubtitle(0);
            }

            video.appendChild(track);
        });

        console.log(`Loaded ${currentFile.subtitles.length} subtitle tracks`);
    }, [torrentId, selectedFile, isPlaying, files]);

    // Fetch OpenSubtitles subtitles
    useEffect(() => {
        const fetchExternalSubtitles = async () => {
            if (!torrentId || !imdbId) return;

            setLoadingSubtitles(true);
            try {
                console.log('[TorrentPlayer] Fetching subtitles for:', imdbId);
                const url = await subtitleService.getTorrentSubtitles(
                    torrentId,
                    selectedFile,
                    imdbId,
                    'en'
                );

                if (url) {
                    console.log('[TorrentPlayer] Subtitle URL:', url);
                    setExternalSubtitleUrl(url);

                    // Enable the subtitle track after a short delay
                    setTimeout(() => {
                        const video = videoRef.current;
                        if (video && video.textTracks.length > 0) {
                            // Find and enable the OpenSubtitles track
                            for (let i = 0; i < video.textTracks.length; i++) {
                                const track = video.textTracks[i];
                                if (track.label.includes('OpenSubtitles')) {
                                    track.mode = 'showing';
                                    console.log('[TorrentPlayer] Enabled subtitle track:', track.label);
                                    break;
                                }
                            }
                        }
                    }, 500);
                } else {
                    console.log('[TorrentPlayer] No subtitles found');
                }
            } catch (error) {
                console.error('[TorrentPlayer] Subtitle fetch error:', error);
            } finally {
                setLoadingSubtitles(false);
            }
        };

        fetchExternalSubtitles();
    }, [torrentId, selectedFile, imdbId]);

    // Handle audio track change
    const handleAudioTrackChange = (trackId: string) => {
        const video = videoRef.current;
        if (!video || !video.audioTracks) return;

        for (let i = 0; i < video.audioTracks.length; i++) {
            const track = video.audioTracks[i];
            track.enabled = (track.id || `audio-${i}`) === trackId;
        }

        setCurrentAudioTrack(trackId);
        setShowSettings(false);
    };

    // Handle subtitle track change
    const handleSubtitleChange = (index: number) => {
        const video = videoRef.current;
        if (!video || !video.textTracks) return;

        for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = i === index ? 'showing' : 'hidden';
        }

        setCurrentSubtitle(index);
        setShowSettings(false);
    };

    const formatSize = (bytes: number) => {
        const mb = bytes / 1024 / 1024;
        return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
    };

    const formatSpeed = (bps: number) => {
        const kbps = bps / 1024;
        return kbps > 1024 ? `${(kbps / 1024).toFixed(2)} MB/s` : `${kbps.toFixed(2)} KB/s`;
    };

    // Determine video source URL based on format
    const getVideoSource = () => {
        if (!torrentId) return '';
        const endpoint = needsTranscoding ? 'transcode' : 'stream';
        return `${API_BASE}/${torrentId}/${endpoint}/${selectedFile}`;
    };

    return (
        <div className="w-full h-full bg-black rounded-md overflow-hidden relative" style={{ minHeight: '400px' }}>
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white z-10">
                    <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-lg font-medium mb-2">Connecting to peers...</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white z-10 p-8">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <p className="text-lg font-medium mb-2">Failed to load torrent</p>
                    <p className="text-sm text-gray-400 text-center max-w-md">{errorMsg}</p>
                </div>
            )}

            {status === 'ready' && torrentId && (
                <>
                    {!isPlaying ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-10 p-8">
                            <div className="text-center mb-8">
                                <h3 className="text-xl font-bold mb-2">{title || files[selectedFile]?.name}</h3>
                                <p className="text-gray-400 text-sm">
                                    {formatSize(files[selectedFile]?.length || 0)} • {torrentStatus?.peers || 0} Peers
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsPlaying(true)}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
                                >
                                    <Play className="h-5 w-5 fill-current" />
                                    Stream Now
                                </button>
                                <a
                                    href={`${API_BASE}/${torrentId}/download/${selectedFile}`}
                                    download
                                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
                                >
                                    <Download className="h-5 w-5" />
                                    Download File
                                </a>
                            </div>
                        </div>
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                controls
                                autoPlay
                                preload="metadata"
                                className="w-full h-full"
                                src={getVideoSource()}
                                crossOrigin="anonymous"
                                onLoadedMetadata={(e) => {
                                    // Override duration if we have metadata
                                    if (videoDuration > 0 && e.currentTarget.duration !== videoDuration) {
                                        console.log(`Setting video duration from metadata: ${videoDuration}s`);
                                        (e.currentTarget as any).duration = videoDuration;
                                    }
                                }}
                            >
                                {/* Torrent-embedded subtitles */}
                                {files[selectedFile]?.subtitles?.map((subtitle, idx) => (
                                    <track
                                        key={subtitle.index}
                                        kind="subtitles"
                                        src={`${API_BASE}/${torrentId}/subtitle/${subtitle.index}`}
                                        srcLang={subtitle.language}
                                        label={`${subtitle.label} (Embedded)`}
                                    />
                                ))}

                                {/* OpenSubtitles external subtitle */}
                                {externalSubtitleUrl && (
                                    <track
                                        kind="subtitles"
                                        src={externalSubtitleUrl}
                                        srcLang="en"
                                        label="English (OpenSubtitles)"
                                        default={subtitlesEnabled}
                                    />
                                )}
                            </video>

                            {/* Transcoding Indicator */}
                            {needsTranscoding && (
                                <div className="absolute top-4 left-4 z-30 bg-yellow-600/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Transcoding
                                </div>
                            )}

                            {/* Subtitle Toggle Button */}
                            <button
                                onClick={() => {
                                    const newState = !subtitlesEnabled;
                                    setSubtitlesEnabled(newState);
                                    const video = videoRef.current;
                                    if (video && video.textTracks.length > 0) {
                                        for (let i = 0; i < video.textTracks.length; i++) {
                                            const track = video.textTracks[i];
                                            track.mode = newState ? 'showing' : 'hidden';
                                        }
                                    }
                                }}
                                className="absolute top-4 right-20 z-30 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white p-3 rounded-lg transition-all"
                                title={subtitlesEnabled ? 'Hide Subtitles' : 'Show Subtitles'}
                            >
                                <Subtitles className={`h-5 w-5 ${subtitlesEnabled ? 'text-cyan-400' : 'text-gray-400'}`} />
                                {loadingSubtitles && (
                                    <RefreshCw className="h-3 w-3 absolute top-1 right-1 animate-spin text-cyan-400" />
                                )}
                            </button>

                            {/* Settings Button */}
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="absolute top-4 right-4 z-30 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white p-3 rounded-lg transition-all"
                                aria-label="Settings"
                            >
                                <Settings className="h-5 w-5" />
                            </button>

                            {/* Settings Panel */}
                            {showSettings && (
                                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                                    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                                        {/* Header */}
                                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                <Settings className="h-5 w-5" />
                                                Playback Settings
                                            </h3>
                                            <button
                                                onClick={() => setShowSettings(false)}
                                                className="text-gray-400 hover:text-white transition-colors"
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>

                                        {/* Audio Tracks Section */}
                                        {audioTracks.length > 0 && (
                                            <div className="p-4 border-b border-gray-700">
                                                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                                                    <Volume2 className="h-4 w-4" />
                                                    Audio Tracks ({audioTracks.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    {audioTracks.map((track, idx) => (
                                                        <button
                                                            key={track.id}
                                                            onClick={() => handleAudioTrackChange(track.id)}
                                                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${currentAudioTrack === track.id
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-medium">
                                                                    {track.label || `Track ${idx + 1}`}
                                                                </span>
                                                                {currentAudioTrack === track.id && (
                                                                    <span className="text-xs bg-white/20 px-2 py-1 rounded">
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {track.language !== 'unknown' && (
                                                                <span className="text-xs opacity-75">
                                                                    {track.language.toUpperCase()}
                                                                </span>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Subtitle Tracks Section */}
                                        {files[selectedFile]?.subtitles && files[selectedFile].subtitles!.length > 0 && (
                                            <div className="p-4">
                                                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                                                    <Subtitles className="h-4 w-4" />
                                                    Subtitles ({files[selectedFile].subtitles!.length})
                                                </h4>
                                                <div className="space-y-2">
                                                    <button
                                                        onClick={() => handleSubtitleChange(-1)}
                                                        className={`w-full text-left px-4 py-3 rounded-lg transition-all ${currentSubtitle === -1
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-medium">Off</span>
                                                            {currentSubtitle === -1 && (
                                                                <span className="text-xs bg-white/20 px-2 py-1 rounded">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                    {files[selectedFile].subtitles!.map((subtitle, idx) => (
                                                        <button
                                                            key={subtitle.index}
                                                            onClick={() => handleSubtitleChange(idx)}
                                                            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${currentSubtitle === idx
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-medium">{subtitle.label}</span>
                                                                {currentSubtitle === idx && (
                                                                    <span className="text-xs bg-white/20 px-2 py-1 rounded">
                                                                        Active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs opacity-75">
                                                                {subtitle.language.toUpperCase()}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* No options message */}
                                        {audioTracks.length === 0 && (!files[selectedFile]?.subtitles || files[selectedFile].subtitles!.length === 0) && (
                                            <div className="p-8 text-center text-gray-400">
                                                <p>No audio tracks or subtitles available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Stats Overlay (Always visible when ready) */}
                    {torrentStatus && isPlaying && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 text-white text-xs pointer-events-none z-20">
                            <div className="flex items-center justify-between">
                                <span>{needsTranscoding ? 'Transcoding & Streaming...' : 'Streaming...'}</span>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <ArrowDown className="h-3 w-3" />
                                        {formatSpeed(torrentStatus.downloadSpeed)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {torrentStatus.peers}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
