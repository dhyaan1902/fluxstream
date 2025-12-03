import React, { useEffect, useState, useRef } from 'react';
import { Download, RefreshCw, Users, ArrowDown, AlertTriangle, Play, Settings, X, Volume2, Subtitles } from 'lucide-react';

interface TorrentPlayerProps {
    magnet: string;
    title?: string;
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

export const TorrentPlayer: React.FC<TorrentPlayerProps> = ({ magnet, title }) => {
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
    const videoRef = useRef<HTMLVideoElement>(null);

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

                // Check if file needs transcoding
                const needsTranscode = /\.(mkv|avi|flv|wmv|m4v|3gp|divx)$/i.test(videoFile.name);
                setNeedsTranscoding(needsTranscode);

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
                            >
                                {/* Add subtitle tracks */}
                                {files[selectedFile]?.subtitles?.map((subtitle, idx) => (
                                    <track
                                        key={subtitle.index}
                                        kind="subtitles"
                                        src={`${API_BASE}/${torrentId}/subtitle/${subtitle.index}`}
                                        srcLang={subtitle.language}
                                        label={subtitle.label}
                                        default={idx === 0}
                                    />
                                ))}
                            </video>

                            {/* Transcoding Indicator */}
                            {needsTranscoding && (
                                <div className="absolute top-4 left-4 z-30 bg-yellow-600/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                    Transcoding
                                </div>
                            )}

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
