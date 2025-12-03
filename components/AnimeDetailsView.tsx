import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Download, Film, Layers } from 'lucide-react';
import { MediaItem } from '../types';
import { searchAnime, getAnimeInfo, getAnimeEpisodes, getAnimeStream, AnimeInfo, AnimeEpisode } from '../services/animeService';
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
    const [error, setError] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

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
    }, [item.title]);

    // Load stream when episode changes
    useEffect(() => {
        if (!currentEpisode) return;

        const loadStream = async () => {
            setStreamUrl(null);
            setDownloadUrl(null);
            setStreamLoading(true);
            try {
                const streamData = await getAnimeStream(currentEpisode.id);
                if (streamData) {
                    // Find HLS source or default to first
                    const hlsSource = streamData.sources.find(s => s.isM3U8);
                    const source = hlsSource || streamData.sources[0];

                    if (source) {
                        setStreamUrl(source.url);
                    }
                    if (streamData.download) {
                        if (Array.isArray(streamData.download)) {
                            // Pick the highest quality or first one
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
    }, [currentEpisode]);

    // HLS Player Setup with Error Recovery
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        const video = videoRef.current;

        if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
            if (hlsRef.current) hlsRef.current.destroy();

            const hls = new Hls({
                enableWorker: true,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 3,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 3,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 3,
            });

            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hlsRef.current = hls;

            // Success handler
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest loaded');
                video.play().catch(err => {
                    console.log('Autoplay prevented:', err);
                });
            });

            // Error handler with recovery
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, attempting to recover...');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, attempting to recover...');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.error('Fatal error, cannot recover');
                            hls.destroy();
                            break;
                    }
                }
            });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(err => console.log('Autoplay prevented:', err));
            });
        } else {
            // Direct video
            video.src = streamUrl;
            video.play().catch(err => console.log('Autoplay prevented:', err));
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [streamUrl]);

    const handleEpisodeChange = (ep: AnimeEpisode) => {
        setCurrentEpisode(ep);
    };

    const handleDownload = () => {
        if (downloadUrl) {
            window.open(downloadUrl, '_blank');
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
                                    ) : (
                                        <>
                                            <div className="animate-spin h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full mb-4"></div>
                                            <p>Loading Stream...</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Controls / Info */}
                        <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white">
                                        Episode {currentEpisode?.number}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {animeData?.type} • {animeData?.status}
                                    </p>
                                </div>
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
