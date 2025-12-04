// Using local backend with @consumet/extensions
// API URL: Uses VITE_API_URL from .env or defaults to localhost for development
const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/anime`;

export interface AnimeSearchResult {
    id: string;
    title: {
        romaji: string;
        english: string;
        native: string;
    };
    image: string;
    cover: string;
    rating: number;
    releaseDate: number;
    type: string;
}

export interface AnimeEpisode {
    id: string;
    number: number;
    title: string;
    image: string;
    description: string;
}

export interface AnimeInfo {
    id: string;
    title: {
        romaji: string;
        english: string;
        native: string;
    };
    image: string;
    cover: string;
    description: string;
    rating: number;
    releaseDate: number;
    genres: string[];
    status: string;
    episodes: AnimeEpisode[];
    recommendations: AnimeSearchResult[];
}

export interface AnimeStreamSource {
    url: string;
    isM3U8: boolean;
    quality?: string;
}

export interface QualityOption {
    id: number;
    quality: string;
    url: string;
    isM3U8: boolean;
    isDefault: boolean;
}

export interface AnimeStreamData {
    headers: {
        Referer: string;
    };
    sources: AnimeStreamSource[];
    download: string | { url: string; quality: string; }[];
    qualities?: QualityOption[]; // Enhanced quality options
    provider?: string; // Provider that served the stream
}

export const searchAnime = async (query: string): Promise<AnimeSearchResult[]> => {
    try {
        const res = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = await res.json();
        return data.results || [];
    } catch (e) {
        console.error("Anime search failed:", e);
        return [];
    }
};

export const getAnimeInfo = async (animeId: string): Promise<AnimeInfo | null> => {
    try {
        const res = await fetch(`${API_BASE}/info/${animeId}`);
        if (!res.ok) throw new Error(`Info failed: ${res.status}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Anime info failed:", e);
        return null;
    }
};

export const getAnimeEpisodes = async (animeId: string): Promise<AnimeEpisode[]> => {
    try {
        const res = await fetch(`${API_BASE}/episodes/${animeId}`);
        if (!res.ok) throw new Error(`Episodes failed: ${res.status}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Anime episodes failed:", e);
        return [];
    }
};

export const getAnimeStream = async (episodeId: string): Promise<AnimeStreamData | null> => {
    try {
        const res = await fetch(`${API_BASE}/watch/${encodeURIComponent(episodeId)}`);
        if (!res.ok) throw new Error('Failed to fetch stream');
        return await res.json();
    } catch (e) {
        console.error("Anime stream failed:", e);
        return null;
    }
};

export const getAnimeProviders = async (): Promise<string[]> => {
    try {
        const res = await fetch(`${API_BASE}/providers`);
        if (!res.ok) throw new Error('Failed to fetch providers');
        return await res.json();
    } catch (e) {
        console.error("Fetch providers failed:", e);
        return [];
    }
};

export const getStreamFromProvider = async (provider: string, title: string, episodeNumber: number): Promise<AnimeStreamData | null> => {
    try {
        const res = await fetch(`${API_BASE}/watch-provider`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, title, episodeNumber })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Failed to fetch stream from provider');
        }
        return await res.json();
    } catch (e) {
        console.error(`Stream from ${provider} failed:`, e);
        throw e;
    }
};
