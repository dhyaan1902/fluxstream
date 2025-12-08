import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Download, Zap, TrendingUp, Film, Cloud } from 'lucide-react';
import { TorrentPlayer } from '../../shared/players/TorrentPlayer';
import { EmbedStreamPlayer } from '../../shared/players/EmbedStreamPlayer';
import { fetchSeriesMetadata } from '../../../services/geminiService';
import { AddToLibraryButton } from '../../shared/components/AddToLibraryButton';
import toast from 'react-hot-toast';

interface SeriesDetailsViewProps {
    item: any;
    onClose: () => void;
}

interface TorrentResult {
    title: string;
    magnet: string;
    size: string;
    seeders: number;
    leechers: number;
    indexer: string;
    quality: string;
}

export const SeriesDetailsView: React.FC<SeriesDetailsViewProps> = ({ item, onClose }) => {
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [streamingMethod, setStreamingMethod] = useState<'torrent' | 'embed'>('torrent');
    const [torrentResults, setTorrentResults] = useState<TorrentResult[]>([]);
    const [selectedTorrent, setSelectedTorrent] = useState<string | null>(null);
    const [indexerStatus, setIndexerStatus] = useState<any>(null);
    const [seriesMetadata, setSeriesMetadata] = useState<{
        seasons: number[];
        episodesPerSeason: { [key: number]: number };
    } | null>(null);
    const [loadingMetadata, setLoadingMetadata] = useState(true);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const checkIndexerStatus = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/indexer/status`);
            if (res.ok) {
                const status = await res.json();
                setIndexerStatus(status);
            }
        } catch (err) {
            console.error('Failed to check indexer status:', err);
        }
    };

    useEffect(() => {
        const fetchMetadata = async () => {
            console.log('🔍 [SeriesDetails] Starting metadata fetch for:', item.title);
            console.log('🔍 [SeriesDetails] item.id:', item.id);
            console.log('🔍 [SeriesDetails] item.imdbId:', item.imdbId);

            setLoadingMetadata(true);

            // For series, the ID field is actually the IMDB ID (e.g., tt0944947)
            const seriesImdbId = item.imdbId || item.id;

            console.log(`🔍 [SeriesDetails] Using IMDB ID: ${seriesImdbId} for ${item.title}`);

            if (seriesImdbId && seriesImdbId.startsWith('tt')) {
                console.log(`🌐 [SeriesDetails] Calling fetchSeriesMetadata...`);
                const metadata = await fetchSeriesMetadata(seriesImdbId);
                console.log(`🌐 [SeriesDetails] fetchSeriesMetadata returned:`, metadata);

                if (metadata) {
                    setSeriesMetadata(metadata);
                    console.log(`✅ [SeriesDetails] Loaded ${metadata.seasons.length} seasons for ${item.title}:`, metadata.episodesPerSeason);
                } else {
                    console.warn('⚠️ [SeriesDetails] Failed to fetch series metadata from TMDB, using defaults');
                }
            } else {
                console.warn(`⚠️ [SeriesDetails] No valid IMDB ID for ${item.title}, using defaults`);
            }

            setLoadingMetadata(false);
            console.log('🔍 [SeriesDetails] Metadata fetch complete, loadingMetadata set to false');
        };

        fetchMetadata();
        checkIndexerStatus();
    }, [item.id, item.imdbId]);

    const searchTorrents = async (episode: any) => {
        setLoading(true);
        try {
            const query = `${item.title} S${String(selectedSeason).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;

            // Fetch from Jackett/Prowlarr
            const jackettPromise = fetch(`${API_BASE}/api/indexer/search?query=${encodeURIComponent(query)}&type=series`)
                .then(res => res.ok ? res.json() : [])
                .catch(() => []);

            // Fetch from Stremio Addons (TorrentsDB, Comet)
            const imdbId = item.imdbId;

            let stremioPromise = Promise.resolve([]);
            if (imdbId) {
                const stremioId = `${imdbId}:${selectedSeason}:${episode.number}`;
                const params = new URLSearchParams({
                    title: item.title,
                    season: selectedSeason.toString(),
                    episode: episode.number.toString()
                });
                stremioPromise = fetch(`${API_BASE}/api/stremio/streams/series/${stremioId}?${params.toString()}`)
                    .then(res => res.ok ? res.json() : [])
                    .catch(() => []);
            }

            const [jackettResults, stremioResults] = await Promise.all([jackettPromise, stremioPromise]);

            const allResults = [...stremioResults, ...jackettResults];
            setTorrentResults(allResults);

            if (allResults.length === 0) {
                toast.error('No torrents found. Try provider streaming instead.');
            } else {
                toast.success(`Found ${allResults.length} torrents`);
            }
        } catch (err) {
            console.error('Torrent search error:', err);
            toast.error('Failed to search torrents');
        } finally {
            setLoading(false);
        }
    };

    const playEpisode = async (episode: any, method: 'torrent' | 'embed' = 'torrent') => {
        console.log(`[SeriesDetailsView] Playing episode:`, { episode, method, season: selectedSeason });

        setSelectedEpisode(episode);
        setStreamingMethod(method);
        setSelectedTorrent(null);

        if (method === 'torrent') {
            console.log(`[SeriesDetailsView] Searching torrents for S${selectedSeason}E${episode.number}`);
            await searchTorrents(episode);
        } else if (method === 'embed') {
            console.log(`[SeriesDetailsView] Using embed streaming for S${selectedSeason}E${episode.number}`);
            toast.success('Opening cloud stream...');
        }
    };

    const playTorrent = (magnet: string) => {
        setSelectedTorrent(magnet);
        toast.success('Starting torrent stream...');
    };

    // Generate episode list based on TMDB metadata or use fallback
    const seasons = seriesMetadata?.seasons || [1, 2, 3, 4, 5, 6, 7, 8];
    const episodeCount = seriesMetadata?.episodesPerSeason[selectedSeason] || 24;
    const seasonEpisodes = Array.from({ length: episodeCount }, (_, i) => ({
        number: i + 1,
        title: `Episode ${i + 1}`,
        id: `${item.id}-s${selectedSeason}-e${i + 1}`
    }));

    const getQualityColor = (quality: string) => {
        if (quality.includes('2160p') || quality.includes('4K')) return 'text-purple-400';
        if (quality.includes('1080p')) return 'text-cyan-400';
        if (quality.includes('720p')) return 'text-green-400';
        return 'text-slate-400';
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-7xl max-h-[90vh] overflow-hidden glass-panel"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>

                    <div className="overflow-y-auto max-h-[90vh] custom-scrollbar">
                        {/* Header */}
                        <div className="relative h-64 bg-gradient-to-b from-slate-900 to-transparent">
                            {item.backdropUrl && (
                                <img
                                    src={item.backdropUrl}
                                    alt={item.title}
                                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-8">
                                <h1 className="text-4xl font-bold mb-2">{item.title}</h1>
                                <div className="flex items-center gap-4 text-sm text-slate-300">
                                    <span>{item.year}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <TrendingUp className="w-4 h-4" />
                                        {item.rating}/10
                                    </span>
                                    <span>•</span>
                                    <span>{seasons.length} Season{seasons.length > 1 ? 's' : ''}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8">
                            {/* Embed Stream Player */}
                            {streamingMethod === 'embed' && selectedEpisode && (
                                <EmbedStreamPlayer
                                    title={item.title}
                                    tmdbId={item.id}
                                    season={selectedSeason}
                                    episode={selectedEpisode.number}
                                    type="series"
                                    onClose={() => {
                                        setSelectedEpisode(null);
                                        setStreamingMethod('torrent');
                                    }}
                                />
                            )}

                            {/* Video Player */}
                            {streamingMethod !== 'embed' && (
                                <div className="mb-8">
                                    {selectedEpisode && (
                                        <div className="glass-panel p-4 mb-4">
                                            <h3 className="font-semibold mb-2">
                                                Now Playing: Season {selectedSeason} Episode {selectedEpisode?.number}
                                            </h3>
                                            <p className="text-sm text-slate-400">{selectedEpisode?.title}</p>
                                        </div>
                                    )}
                                    {loading && (
                                        <div className="aspect-video bg-slate-800 rounded-xl flex flex-col items-center justify-center">
                                            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mb-4" />
                                            <p className="text-slate-300">Loading stream...</p>
                                            <div className="flex gap-3 flex-wrap">
                                                <AddToLibraryButton item={item} className="flex-shrink-0" />
                                                <button
                                                    onClick={() => playEpisode(selectedEpisode, 'embed')}
                                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-white hover:shadow-glow transition-all"
                                                >
                                                    Try Cloud Streaming
                                                </button>
                                                <button
                                                    onClick={() => playEpisode(selectedEpisode, 'torrent')}
                                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-glow-purple transition-all"
                                                >
                                                    Try Torrents
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!loading && selectedTorrent && streamingMethod === 'torrent' && (
                                        <TorrentPlayer
                                            magnet={selectedTorrent}
                                            title={`${item.title} S${selectedSeason}E${selectedEpisode?.number}`}
                                            imdbId={item.imdbId || item.id}
                                        />
                                    )}

                                    {!loading && !selectedTorrent && selectedEpisode && streamingMethod === 'torrent' && (
                                        <div className="aspect-video bg-slate-800 rounded-xl flex flex-col items-center justify-center p-8 text-center">
                                            <p className="text-xl text-slate-300 mb-4">No stream available</p>
                                            <p className="text-sm text-slate-400 mb-6">Try selecting a different streaming method</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Streaming Method Toggle */}
                            <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-2">
                                <button
                                    onClick={() => setStreamingMethod('torrent')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${streamingMethod === 'torrent'
                                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-glow-purple'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                    disabled={!indexerStatus?.activeService}
                                >
                                    <Zap className="w-4 h-4" />
                                    Torrent Streaming
                                    {indexerStatus?.activeService && (
                                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded">
                                            {indexerStatus.activeService}
                                        </span>
                                    )}
                                    <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded text-green-300">Recommended</span>
                                </button>
                                <button
                                    onClick={() => setStreamingMethod('embed')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${streamingMethod === 'embed'
                                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-glow'
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                >
                                    <Cloud className="w-4 h-4" />
                                    Cloud Streaming
                                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Backup</span>
                                </button>
                            </div>

                            {/* Torrent Results */}
                            {streamingMethod === 'torrent' && torrentResults.length > 0 && (
                                <div className="mb-8">
                                    <h3 className="text-lg font-bold mb-4">Available Torrents</h3>
                                    <div className="space-y-2">
                                        {torrentResults.map((torrent, idx) => (
                                            <div
                                                key={idx}
                                                className="glass-panel p-4 hover:shadow-glow transition-all cursor-pointer"
                                                onClick={() => playTorrent(torrent.magnet)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h4 className="font-medium text-sm mb-1 line-clamp-1">{torrent.title}</h4>
                                                        <div className="flex items-center gap-3 text-xs text-slate-400">
                                                            <span className={getQualityColor(torrent.quality)}>{torrent.quality}</span>
                                                            <span>•</span>
                                                            <span>{torrent.size}</span>
                                                            <span>•</span>
                                                            <span className="text-green-400">↑ {torrent.seeders}</span>
                                                            <span className="text-red-400">↓ {torrent.leechers}</span>
                                                            <span>•</span>
                                                            <span className="text-cyan-400">{torrent.indexer}</span>
                                                        </div>
                                                    </div>
                                                    <button className="p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors">
                                                        <Play className="w-4 h-4 text-purple-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Season Selector */}
                            {loadingMetadata ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500 mr-3" />
                                    <p className="text-sm text-slate-400">Loading season info...</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                                    {seasons.map(season => (
                                        <button
                                            key={season}
                                            onClick={() => setSelectedSeason(season)}
                                            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-all ${selectedSeason === season
                                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-glow'
                                                : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            Season {season}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Episodes Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {seasonEpisodes.map(episode => (
                                    <div
                                        key={episode.id}
                                        className="glass-panel p-4 hover:shadow-glow transition-all cursor-pointer group"
                                        onClick={() => playEpisode(episode, streamingMethod)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white">
                                                {episode.number}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-semibold text-sm mb-1 line-clamp-1 group-hover:text-cyan-400 transition-colors">
                                                    {episode.title || `Episode ${episode.number}`}
                                                </h4>
                                                <p className="text-xs text-slate-400 line-clamp-2">
                                                    Click to search and play torrents for this episode
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {loading && (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
