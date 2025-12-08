import { MediaItem } from '../types';

export interface LibraryItem {
    id: number;
    media_id: string;
    media_type: 'movie' | 'series' | 'anime';
    title: string;
    poster?: string;
    year?: number;
    rating?: number;
    genres?: string[];
    description?: string;
    imdb_id?: string;
    added_at: number;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const libraryService = {
    getAll: async (): Promise<LibraryItem[]> => {
        const res = await fetch(`${API_BASE}/api/library`);
        if (!res.ok) throw new Error('Failed to fetch library');
        return res.json();
    },

    getByType: async (type: string): Promise<LibraryItem[]> => {
        const res = await fetch(`${API_BASE}/api/library/type/${type}`);
        if (!res.ok) throw new Error(`Failed to fetch ${type} library`);
        return res.json();
    },

    add: async (item: MediaItem): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/library`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        if (!res.ok) throw new Error('Failed to add to library');
    },

    remove: async (mediaId: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/library/${mediaId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to remove from library');
    },

    exists: async (mediaId: string): Promise<boolean> => {
        const res = await fetch(`${API_BASE}/api/library/check/${mediaId}`);
        if (!res.ok) return false;
        const data = await res.json();
        return data.exists;
    },

    getStats: async (): Promise<{ total: number; movies: number; series: number; anime: number }> => {
        const res = await fetch(`${API_BASE}/api/library/stats`);
        if (!res.ok) throw new Error('Failed to fetch library stats');
        return res.json();
    }
};
