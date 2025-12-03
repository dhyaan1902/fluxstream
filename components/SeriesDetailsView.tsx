
import React, { useEffect, useState, useRef } from 'react';
import { X, Play, Star, Calendar, Clock, Download, ChevronLeft, ChevronRight, MonitorPlay, List, Film } from 'lucide-react';
import { MediaItem } from '../types';
import { searchSeries, getSeriesInfo, getSeriesStream, SeriesInfo, SeriesEpisode } from '../services/seriesService';
import Hls from 'hls.js';

interface SeriesDetailsViewProps {
    item: MediaItem;
    onClose: () => void;
}

export const SeriesDetailsView: React.FC<SeriesDetailsViewProps> = ({ item, onClose }) => {
    const [seriesData, setSeriesData] = useState<SeriesInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentSeason, setCurrentSeason] = useState(1);
    const [currentEpisode, setCurrentEpisode] = useState<SeriesEpisode | null>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [streamLoading, setStreamLoading] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);

    // 1. Search and Load Series Info
    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                // First search to get the ID
                const searchResults = await searchSeries(item.title);
                if (searchResults.length > 0) {
                    // Try to find exact match or pick first
                    const match = searchResults.find(s => s.title.toLowerCase() === item.title.toLowerCase()) || searchResults[0];

                    // Get full info
                    const info = await getSeriesInfo(match.id);
                    setSeriesData(info);

                    // Set initial episode (S1 E1)
                    if (info?.episodes?.length) {
                        const firstEp = info.episodes.find(e => e.season === 1 && e.number === 1) || info.episodes[0];
                        setCurrentEpisode(firstEp);
                        setCurrentSeason(firstEp.season);
                    }
                }
            } catch (e) {
                console.error("Failed to load series:", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [item.title]);

    // 2. Load Stream when Episode Changes
    useEffect(() => {
        if (!currentEpisode || !seriesData) return;

        const loadStream = async () => {
            setStreamLoading(true);
            setStreamUrl(null);
            try {
                const streamData = await getSeriesStream(currentEpisode.id, seriesData.id);
                if (streamData && streamData.sources.length > 0) {
                    // Prefer M3U8 (HLS)
                    const hlsSource = streamData.sources.find(s => s.isM3U8) || streamData.sources[0];
                    setStreamUrl(hlsSource.url);
                }
            } catch (e) {
                console.error("Failed to load stream:", e);
            } finally {
                setStreamLoading(false);
            }
        };
        loadStream();
    }, [currentEpisode, seriesData]);

    // 3. Initialize Player
    useEffect(() => {
        if (!streamUrl || !videoRef.current) return;

        if (Hls.isSupported() && streamUrl.includes('.m3u8')) {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(videoRef.current);
            hlsRef.current = hls;
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current?.play().catch(() => { });
            });
        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = streamUrl;
            videoRef.current.addEventListener('loadedmetadata', () => {
                videoRef.current?.play().catch(() => { });
            });
        } else {
            videoRef.current.src = streamUrl;
            videoRef.current.play().catch(() => { });
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, [streamUrl]);

    // Filter episodes for current season
    const seasonEpisodes = seriesData?.episodes?.filter(e => e.season === currentSeason) || [];
    const seasons = seriesData?.seasons ? Array.from({ length: seriesData.seasons }, (_, i) => i + 1) : [1];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-2 md:p-4 overflow-hidden">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md" onClick={onClose}></div>

            <div className="relative w-full max-w-7xl bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-800 h-full max-h-[98vh] flex flex-col">

                {/* Header */}
                <div className="relative h-48 sm:h-64 shrink-0 bg-slate-950">
                    <div className="absolute inset-0">
                        <img
                            src={seriesData?.cover || item.backdropUrl || item.posterUrl}
                            alt={item.title}
                            className="w-full h-full object-cover opacity-40"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
                    </div>

                    <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 hover:bg-white/10 text-slate-200">
                        <X className="h-6 w-6" />
                    </button>

                    <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end">
                        <div className="hidden md:block w-24 h-36 mr-6 -mb-12 rounded-lg shadow-2xl border-2 border-slate-800 overflow-hidden relative z-10 bg-slate-800">
                            <img src={seriesData?.image || item.posterUrl} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 mb-2">
                            <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-2 text-shadow-lg">{item.title}</h1>
                            <div className="flex items-center gap-4 text-xs md:text-sm text-slate-300">
                                <span className="flex items-center text-yellow-400 font-bold">
                                    <Star className="h-4 w-4 mr-1 fill-current" />
                                    {item.rating.toFixed(1)}
                                </span>
                                <span className="flex items-center">
                                    <Calendar className="h-4 w-4 mr-1.5 opacity-70" />
                                    {seriesData?.releaseDate || item.year}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900 p-4 md:p-8 pt-12">
                    <div className="flex flex-col lg:flex-row gap-8">

                        {/* Left: Player */}
                        <div className="lg:w-3/4 space-y-6">
                            <div className="bg-black rounded-xl overflow-hidden aspect-video border border-slate-800 relative shadow-2xl">
                                {streamLoading ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-cyan-500">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current"></div>
                                        <span className="ml-3 font-bold">Loading Stream...</span>
                                    </div>
                                ) : streamUrl ? (
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full"
                                        controls
                                        autoPlay
                                        poster={seriesData?.cover || item.backdropUrl}
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                                        <Film className="h-12 w-12 mb-4 opacity-50" />
                                        <p>{loading ? 'Loading Series Info...' : 'Select an episode to play'}</p>
                                    </div>
                                )}
                            </div>

                            {/* Episode Info */}
                            {currentEpisode && (
                                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                                    <h3 className="text-lg font-bold text-white mb-1">
                                        S{currentEpisode.season} E{currentEpisode.number}: {currentEpisode.title}
                                    </h3>
                                    <p className="text-slate-400 text-sm">{seriesData?.description}</p>
                                </div>
                            )}
                        </div>

                        {/* Right: Episodes List */}
                        <div className="lg:w-1/4 flex flex-col h-[600px] bg-slate-800/20 rounded-xl border border-slate-800 overflow-hidden">
                            {/* Season Selector */}
                            <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Season</label>
                                <div className="flex flex-wrap gap-2">
                                    {seasons.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => setCurrentSeason(s)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${currentSeason === s
                                                    ? 'bg-cyan-500 text-black'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Episodes */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                                {seasonEpisodes.map(ep => (
                                    <button
                                        key={ep.id}
                                        onClick={() => setCurrentEpisode(ep)}
                                        className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all text-left group ${currentEpisode?.id === ep.id
                                                ? 'bg-cyan-500/10 border border-cyan-500/50'
                                                : 'bg-slate-800/50 border border-transparent hover:bg-slate-700'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${currentEpisode?.id === ep.id ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'
                                            }`}>
                                            {currentEpisode?.id === ep.id ? <Play className="h-4 w-4 fill-current" /> : <span className="text-xs font-bold">{ep.number}</span>}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-medium truncate ${currentEpisode?.id === ep.id ? 'text-cyan-400' : 'text-slate-200'}`}>
                                                {ep.title}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
