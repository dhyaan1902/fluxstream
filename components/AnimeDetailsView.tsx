import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Download, Film, Layers, Settings } from 'lucide-react';
import { MediaItem } from '../types';
import { searchAnime, getAnimeInfo, getAnimeEpisodes, getAnimeStream, getAnimeProviders, getStreamFromProvider, AnimeInfo, AnimeEpisode } from '../services/animeService';
import Hls from 'hls.js';

interface AnimeDetailsViewProps {
    item: MediaItem;
    onClose: () => void;
}

export const AnimeDetailsView: React.FC<AnimeDetailsViewProps> = ({ item, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [animeData, setAnimeData] = useState<AnimeInfo | null>(null);
    const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
    const [currentEpisode, setCurrentEpisode] = useState<AnimeEpisode | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [streamLoading, setStreamLoading] = useState(false);
    const [availableQualities, setAvailableQualities] = useState<any[]>([]);
    const [selectedQuality, setSelectedQuality] = useState<number>(0);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [providers, setProviders] = useState<string[]>([]);
    const [currentProvider, setCurrentProvider] = useState<string | null>(null);
    const [showProviderMenu, setShowProviderMenu] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const wakeLockRef = useRef<any>(null);

    // Search and get anime info
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError(null);
            try {
                const results = await searchAnime(item.title);
                if (results.length > 0) {
                    const match = results[0];
                    const info = await getAnimeInfo(match.id);
                    if (info) {
                        setAnimeData(info);
                        // Consumet info usually includes episodes
                        const eps = info.episodes || await getAnimeEpisodes(match.id);
                        setEpisodes(eps);
                        if (eps.length > 0) {
                            setCurrentEpisode(eps[0]);
                        }
                    } else {
                        setError("Failed to load anime details.");
                    }
                } else {
                    setError("Anime not found.");
                }
            } catch (e) {
                setError("Error connecting to anime service.");
            } finally {
                setLoading(false);
            }
        };
        init();

        // Fetch available providers
        getAnimeProviders().then(setProviders);
    }, [item.title]);

    // Load stream when episode changes
    useEffect(() => {
        if (!currentEpisode) return;

        const loadStream = async () => {
            setStreamUrl(null);
            setDownloadUrl(null);
            setAvailableQualities([]);
            setSelectedQuality(0);
            setStreamLoading(true);
            try {
                let streamData;

                // If provider is manually selected, use that
                if (currentProvider) {
                    streamData = await getStreamFromProvider(currentProvider, item.title, currentEpisode.number);
                } else {
                    // Default auto-select
                    streamData = await getAnimeStream(currentEpisode.id);
                }

                if (streamData) {
                    // Update current provider if not set (from auto-select)
                    if (!currentProvider && streamData.provider) {
                        setCurrentProvider(streamData.provider);
                    }
                    // Store available qualities if provided by enhanced API
                    if (streamData.qualities && streamData.qualities.length > 0) {
                        setAvailableQualities(streamData.qualities);
                        // Set default quality (first one)
                        const defaultQuality = streamData.qualities.find((q: any) => q.isDefault) || streamData.qualities[0];
                        setStreamUrl(defaultQuality.url);
                        setSelectedQuality(defaultQuality.id);
                    } else {
                        // Fallback: use sources array
                        const hlsSource = streamData.sources.find((s: any) => s.isM3U8);
                        const source = hlsSource || streamData.sources[0];
                        if (source) {
                            setStreamUrl(source.url);
                        }
                    }

                    // Handle download URL
                    if (streamData.download) {
                        if (Array.isArray(streamData.download)) {
                            setDownloadUrl(streamData.download[streamData.download.length - 1].url);
                        } else {
                            setDownloadUrl(streamData.download);
                        }
                    }
                }
            } catch (e) {
                console.error("Stream load error", e);
            } finally {
                setStreamLoading(false);
            }
        };
        loadStream();
    }, [currentEpisode, currentProvider]);

    // Simple video player - stream m3u8 directly
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const video = videoRef.current;

        // Simple direct streaming
        video.src = streamUrl;
        video.load();

        const handleLoadedMetadata = () => {
            video.play().catch(err => console.log('Autoplay prevented:', err));
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.src = '';
        };
    }, [streamUrl]);

    // Wake Lock: Keep screen awake during video playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const requestWakeLock = async () => {
            try {
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
            releaseWakeLock();
        };
    }, []); // Empty dependency array - only set up once

    const handleEpisodeChange = (ep: AnimeEpisode) => {
        setCurrentEpisode(ep);
    };

    const handleDownload = () => {
        if (downloadUrl) {
            window.open(downloadUrl, '_blank');
        }
    };

    const handleQualityChange = (qualityId: number) => {
        const quality = availableQualities.find(q => q.id === qualityId);
        if (quality) {
            setSelectedQuality(qualityId);
            setStreamUrl(quality.url);
            setShowQualityMenu(false);
        }
    };

    const handleProviderChange = (provider: string) => {
        if (provider !== currentProvider) {
            setCurrentProvider(provider);
            setShowProviderMenu(false);
            // Trigger reload by resetting episode (or useEffect dependency)
            // But since useEffect depends on currentEpisode, we need to manually trigger load
            // A better way is to add currentProvider to dependency array of loadStream effect
            // However, that might cause loops. Let's just force reload logic here or rely on state update.
            // Actually, adding currentProvider to dependency array is cleaner if we handle init correctly.
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-2 md:p-4 overflow-hidden bg-black/95">
            <div className="relative w-full max-w-7xl bg-gray-900 rounded-none sm:rounded-md shadow-2xl overflow-hidden border border-gray-800 h-full max-h-[98vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-black">
                    <h2 className="text-xl font-bold text-white truncate pr-4">
                        {animeData?.title?.english || animeData?.title?.romaji || item.title}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">

                    {/* Main Content (Player) */}
                    <div className="flex-1 p-4 md:p-6 bg-black">
                        <div className="aspect-video bg-black rounded-md overflow-hidden shadow-2xl border border-gray-800 relative">
                            {streamUrl ? (
                                <video
                                    ref={videoRef}
                                    controls
                                    autoPlay
                                    className="w-full h-full"
                                    poster={animeData?.cover || animeData?.image || item.posterUrl}
                                ></video>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                                    {loading ? (
                                        <>
                                            <div className="animate-spin h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                                            <p>Searching Anime...</p>
                                        </>
                                    ) : error ? (
                                        <>
                                            <Film className="h-12 w-12 mb-4 opacity-50" />
                                            <p>{error}</p>
                                        </>
                                    ) : streamLoading ? (
                                        <>
                                            <div className="animate-spin h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                                            <p>Loading Stream...</p>
                                        </>
                                    ) : (
                                        <>
                                            <Film className="h-12 w-12 mb-4 opacity-50" />
                                            <p>No stream available.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Controls / Info */}
                        <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-white">
                                        Episode {currentEpisode?.number}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {animeData?.type} • {animeData?.status}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Provider Selector */}
                                    {providers.length > 0 && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowProviderMenu(!showProviderMenu)}
                                                className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
                                            >
                                                <Layers className="h-4 w-4 mr-2" />
                                                {currentProvider || 'Provider'}
                                            </button>
                                            {showProviderMenu && (
                                                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
                                                    {providers.map((provider) => (
                                                        <button
                                                            key={provider}
                                                            onClick={() => handleProviderChange(provider)}
                                                            className={`w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors ${provider === currentProvider ? 'bg-blue-600 text-white' : 'text-gray-300'
                                                                }`}
                                                        >
                                                            {provider}
                                                            {provider === currentProvider && ' ✓'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Quality Selector */}
                                    {availableQualities.length > 1 && (
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowQualityMenu(!showQualityMenu)}
                                                className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
                                            >
                                                <Settings className="h-4 w-4 mr-2" />
                                                {availableQualities.find(q => q.id === selectedQuality)?.quality || 'Quality'}
                                            </button>
                                            {showQualityMenu && (
                                                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
                                                    {availableQualities.map((quality) => (
                                                        <button
                                                            key={quality.id}
                                                            onClick={() => handleQualityChange(quality.id)}
                                                            className={`w-full text-left px-4 py-2 hover:bg-gray-800 transition-colors ${quality.id === selectedQuality ? 'bg-blue-600 text-white' : 'text-gray-300'
                                                                }`}
                                                        >
                                                            {quality.quality}
                                                            {quality.id === selectedQuality && ' ✓'}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {downloadUrl && (
                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
                                        >
                                            <Download className="h-4 w-4 mr-2" />
                                            Download
                                        </button>
                                    )}
                                </div>
                            </div>

                            <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
                                {animeData?.description?.replace(/<[^>]*>/g, '') || item.description}
                            </p>
                        </div>
                    </div>

                    {/* Sidebar (Episodes) */}
                    <div className="w-full md:w-80 bg-black border-l border-gray-800 flex flex-col">
                        <div className="p-4 border-b border-gray-800">
                            <h3 className="font-bold text-gray-300 flex items-center">
                                <Layers className="h-4 w-4 mr-2 text-blue-600" />
                                Episodes ({episodes.length})
                            </h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {episodes.length > 0 ? (
                                <div className="grid grid-cols-4 md:grid-cols-1 gap-2">
                                    {episodes.map(ep => (
                                        <button
                                            key={ep.id}
                                            onClick={() => handleEpisodeChange(ep)}
                                            className={`px-3 py-2 rounded-md text-sm font-medium transition-all text-left flex items-center ${currentEpisode?.id === ep.id
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                                }`}
                                        >
                                            <Play className={`h-3 w-3 mr-2 ${currentEpisode?.id === ep.id ? 'fill-current' : ''}`} />
                                            Episode {ep.number}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    {loading ? 'Loading episodes...' : 'No episodes found.'}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
