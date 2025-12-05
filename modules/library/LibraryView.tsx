import React, { useEffect, useState } from 'react';
import { Bookmark, Film, Tv, Zap, Loader2, Trash2 } from 'lucide-react';
import { libraryService, LibraryItem } from '../../services/libraryService';
import { MediaCard } from '../shared/components/MediaCard';
import { MediaType } from '../../types';

export const LibraryView: React.FC = () => {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [filter, setFilter] = useState<'all' | 'movie' | 'series' | 'anime'>('all');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, movies: 0, series: 0, anime: 0 });

    useEffect(() => {
        loadLibrary();
        loadStats();
    }, [filter]);

    const loadLibrary = async () => {
        setLoading(true);
        try {
            const data = filter === 'all'
                ? await libraryService.getAll()
                : await libraryService.getByType(filter);
            setItems(data);
        } catch (e) {
            console.error('Failed to load library:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const data = await libraryService.getStats();
            setStats(data);
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    };

    const filterTabs = [
        { id: 'all', label: 'All', icon: Bookmark, count: stats.total },
        { id: 'movie', label: 'Movies', icon: Film, count: stats.movies },
        { id: 'series', label: 'Series', icon: Tv, count: stats.series },
        { id: 'anime', label: 'Anime', icon: Zap, count: stats.anime }
    ] as const;

    // Convert LibraryItem to MediaItem for MediaCard
    const convertToMediaItem = (item: LibraryItem) => ({
        id: item.media_id,
        title: item.title,
        type: item.media_type as MediaType,
        poster: item.poster,
        year: item.year,
        rating: item.rating,
        genres: item.genres,
        description: item.description,
        imdbId: item.imdb_id
    });

    return (
        <div className="min-h-screen px-8 py-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-6">
                    <Bookmark className="w-8 h-8 text-cyan-400" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        My Library
                    </h1>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-3">
                    {filterTabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = filter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setFilter(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all ${isActive
                                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
                                    : 'glass-panel text-slate-300 hover:bg-white/10'
                                    }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span className="font-medium">{tab.label}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${isActive
                                    ? 'bg-white/20'
                                    : 'bg-white/10'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
                </div>
            ) : items.length === 0 ? (
                <div className="glass-panel p-12 text-center">
                    <Bookmark className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                    <h2 className="text-2xl font-semibold text-slate-300 mb-2">
                        Your library is empty
                    </h2>
                    <p className="text-slate-500">
                        Start adding movies, series, or anime to build your collection!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {items.map(item => (
                        <MediaCard
                            key={item.id}
                            item={convertToMediaItem(item)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
