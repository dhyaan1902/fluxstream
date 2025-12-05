import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Download, Film, Layers, Settings } from 'lucide-react';
import { MediaItem, MediaType } from '../../../types';
import { searchAnime, getAnimeInfo, getAnimeEpisodes, getAnimeStream, getAnimeProviders, getStreamFromProvider, AnimeInfo, AnimeEpisode } from '../../../services/animeService';
import { AddToLibraryButton } from '../../shared/components/AddToLibraryButton';
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

    // Load stream when episode or provider changes
    useEffect(() => {
        if (!currentEpisode) return;

        const loadStream = async () => {
            console.log(`[AnimeDetailsView] 🎬 Loading stream for Episode ${currentEpisode.number}...`);
            setStreamUrl(null);
            setDownloadUrl(null);
            setAvailableQualities([]);
            setSelectedQuality(0);
            setStreamLoading(true);
            setError(null);

            try {
                let streamData;

                // If provider is manually selected, use that
                if (currentProvider) {
                    console.log(`[AnimeDetailsView] 📡 Using selected provider: ${currentProvider} `);
                    streamData = await getStreamFromProvider(currentProvider, item.title, currentEpisode.number);
                } else {
                    console.log(`[AnimeDetailsView] 🔄 Auto - selecting provider...`);
                    streamData = await getAnimeStream(currentEpisode.id);
                }

                if (streamData) {
                    console.log(`[AnimeDetailsView] ✅ Stream data received from ${streamData.provider || 'unknown provider'} `);

                    // Update current provider if not set (from auto-select)
                    if (!currentProvider && streamData.provider) {
                        console.log(`[AnimeDetailsView] 🔧 Auto - selected provider: ${streamData.provider} `);
                        setCurrentProvider(streamData.provider);
                    }

                    // Store available qualities if provided by enhanced API
                    if (streamData.qualities && streamData.qualities.length > 0) {
                        console.log(`[AnimeDetailsView] 📊 Available qualities: `, streamData.qualities.map((q: any) => q.quality));
                        setAvailableQualities(streamData.qualities);

                        // Set default quality (first one or marked as default)
                        const defaultQuality = streamData.qualities.find((q: any) => q.isDefault) || streamData.qualities[0];
                        console.log(`[AnimeDetailsView] ✨ Setting quality: ${defaultQuality.quality} `);
                        setStreamUrl(defaultQuality.url);
                        setSelectedQuality(defaultQuality.id);
                    } else {
                        // Fallback: use sources array
                        console.log(`[AnimeDetailsView] ⚠️  Using fallback sources(no qualities array)`);
                        const hlsSource = streamData.sources.find((s: any) => s.isM3U8);
                        const source = hlsSource || streamData.sources[0];
                        if (source) {
                            console.log(`[AnimeDetailsView] 📺 Stream URL set: ${source.url.substring(0, 50)}...`);
                            setStreamUrl(source.url);
                        } else {
                            console.error(`[AnimeDetailsView] ❌ No valid source found`);
                        }
                    }

                    // Handle download URL
                    if (streamData.download) {
                        if (Array.isArray(streamData.download)) {
                            setDownloadUrl(streamData.download[streamData.download.length - 1].url);
                        } else {
                            setDownloadUrl(streamData.download);
                        }
                        console.log(`[AnimeDetailsView] 💾 Download URL available`);
                    }
                } else {
                    console.error(`[AnimeDetailsView] ❌ No stream data returned`);
                    setError(`Failed to load stream from ${currentProvider || 'providers'} `);
                }
            } catch (e: any) {
                console.error(`[AnimeDetailsView] ❌ Stream load error: `, e.message);
                setError(e.message || "Failed to load stream");
            } finally {
                setStreamLoading(false);
            }
        };
        loadStream();
    }, [currentEpisode, currentProvider]);

    // Video player with HLS.js support
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const video = videoRef.current;
        let hls: Hls | null = null;

        // Reset previous HLS instance if exists (though cleanup should handle it)
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        const isHlsSource = streamUrl.includes('.m3u8');

        if (isHlsSource && video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari, Android Chrome, etc.) - PREFERRED for Mobile
            console.log(`[AnimePlayer] 🍎 Using native HLS support (Direct Stream)`);
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.log('Autoplay blocked:', e));
            });
        } else if (isHlsSource && Hls.isSupported()) {
            // Hls.js fallback (Desktop Chrome/Firefox, etc.)
            console.log(`[AnimePlayer] 🛠️ Initializing HLS.js for ${streamUrl}`);
            hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
            });
            hlsRef.current = hls;

            hls.loadSource(streamUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[AnimePlayer] ✅ Manifest parsed, starting playback');
                video.play().catch(e => console.log('Autoplay blocked:', e));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('[AnimePlayer] ⚠️ Fatal network error');
                            hls?.destroy();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('[AnimePlayer] ⚠️ Fatal media error, trying to recover...');
                            hls?.recoverMediaError();
                            break;
                        default:
                            console.error('[AnimePlayer] ❌ Fatal error, destroying HLS:', data);
                            hls?.destroy();
                            break;
                    }
                }
            });
        } else {
            // Direct file playback (mp4 etc) or fallback
            console.log(`[AnimePlayer] 🎥 Using direct playback (not HLS or not supported)`);
            video.src = streamUrl;
            video.play().catch(e => console.log('Autoplay blocked:', e));
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
            if (video) {
                video.removeAttribute('src');
                video.load();
            }
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
                            {/* Provider & Quality Controls - More Prominent */}
                            <div className="glass-panel p-4 rounded-xl">
                                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-cyan-400" />
                                    Streaming Settings
                                </h4>

                                {/* Action Buttons - Mobile Responsive Grid */}
                                <div className="grid grid-cols-2 gap-3 mb-4 sm:flex sm:flex-wrap">
                                    {animeData && (
                                        <AddToLibraryButton item={{
                                            id: animeData.id,
                                            title: animeData.title?.english || animeData.title?.romaji || item.title,
                                            posterUrl: animeData.image || animeData.cover || item.posterUrl,
                                            type: MediaType.ANIME,
                                            description: animeData.description || item.description,
                                            rating: animeData.rating,
                                            status: animeData.status,
                                            genres: animeData.genres || [],
                                            year: animeData.releaseDate ? String(animeData.releaseDate) : item.year,
                                        }} className="w-full sm:w-auto min-w-0" />
                                    )}
                                    {downloadUrl && (
                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors w-full sm:w-auto"
                                        >
                                            <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span className="truncate">Download</span>
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                    {/* Provider Selector */}
                                    {providers.length > 0 && (
                                        <div className="relative flex-1 min-w-0">
                                            <label className="text-xs text-slate-400 mb-1 block">Provider</label>
                                            <button
                                                onClick={() => setShowProviderMenu(!showProviderMenu)}
                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-white rounded-lg transition-all min-w-0"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Layers className="h-4 w-4 text-purple-400 flex-shrink-0" />
                                                    <span className="font-medium truncate">{currentProvider || 'Auto'}</span>
                                                </div>
                                                <span className="text-xs text-purple-300 ml-2 flex-shrink-0">▼</span>
                                            </button>
                                            {showProviderMenu && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                                                    <div className="p-2 bg-slate-800 border-b border-slate-700">
                                                        <p className="text-xs text-slate-400">
                                                            Available: {providers.length} providers
                                                        </p>
                                                    </div>
                                                    <div className="max-h-64 overflow-y-auto">
                                                        {providers.map((provider) => (
                                                            <button
                                                                key={provider}
                                                                onClick={() => handleProviderChange(provider)}
                                                                className={`w - full text - left px - 4 py - 2.5 hover: bg - slate - 800 transition - colors flex items - center justify - between ${provider === currentProvider
                                                                    ? 'bg-purple-600 text-white font-semibold'
                                                                    : 'text-slate-300'
                                                                    } `}
                                                            >
                                                                <span className="truncate">{provider}</span>
                                                                {provider === currentProvider && (
                                                                    <span className="text-purple-200 ml-2">✓</span>
                                                                )}
                                                            </button> // Fixed this closing tag from missing one in view
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Quality Selector */}
                                    {availableQualities.length > 1 && (
                                        <div className="relative flex-1 min-w-0">
                                            <label className="text-xs text-slate-400 mb-1 block">Quality</label>
                                            <button
                                                onClick={() => setShowQualityMenu(!showQualityMenu)}
                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 text-white rounded-lg transition-all min-w-0"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Film className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                                                    <span className="font-medium truncate">{availableQualities.find(q => q.id === selectedQuality)?.quality || 'Auto'}</span>
                                                </div>
                                                <span className="text-xs text-cyan-300 ml-2 flex-shrink-0">▼</span>
                                            </button>
                                            {showQualityMenu && (
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                                                    <div className="p-2 bg-slate-800 border-b border-slate-700">
                                                        <p className="text-xs text-slate-400">
                                                            {availableQualities.length} qualities available
                                                        </p>
                                                    </div>
                                                    <div className="max-h-64 overflow-y-auto">
                                                        {availableQualities.map((quality) => (
                                                            <button
                                                                key={quality.id}
                                                                onClick={() => handleQualityChange(quality.id)}
                                                                className={`w - full text - left px - 4 py - 2.5 hover: bg - slate - 800 transition - colors flex items - center justify - between ${quality.id === selectedQuality
                                                                    ? 'bg-cyan-600 text-white font-semibold'
                                                                    : 'text-slate-300'
                                                                    } `}
                                                            >
                                                                <span className="truncate">{quality.quality}</span>
                                                                {quality.id === selectedQuality && (
                                                                    <span className="text-cyan-200 ml-2">✓</span>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
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
                                            className={`px - 3 py - 2 rounded - md text - sm font - medium transition - all text - left flex items - center ${currentEpisode?.id === ep.id
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                                                } `}
                                        >
                                            <Play className={`h - 3 w - 3 mr - 2 ${currentEpisode?.id === ep.id ? 'fill-current' : ''} `} />
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
            </div >
        </div >
    );
};
