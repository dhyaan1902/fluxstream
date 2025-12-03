
const API_BASE = "http://localhost:3001/series";

export interface SeriesSearchResult {
    id: string;
    title: string;
    image: string;
    url: string;
    type: string;
}

export interface SeriesEpisode {
    id: string;
    title: string;
    season: number;
    number: number;
}

export interface SeriesInfo {
    id: string;
    title: string;
    image: string;
    cover: string;
    description: string;
    type: string;
    releaseDate: string;
    episodes: SeriesEpisode[];
    seasons?: number; // Helper for UI
}

export interface SeriesStreamSource {
    url: string;
    quality: string;
    isM3U8: boolean;
}

export interface SeriesStreamData {
    headers: {
        Referer: string;
    };
    sources: SeriesStreamSource[];
    subtitles?: { url: string; lang: string; }[];
}

export const searchSeries = async (query: string): Promise<SeriesSearchResult[]> => {
    try {
        const res = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        return data.results || [];
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const getSeriesInfo = async (id: string): Promise<SeriesInfo | null> => {
    try {
        const res = await fetch(`${API_BASE}/info/${id}`);
        if (!res.ok) throw new Error('Info failed');
        const data = await res.json();

        // Calculate max seasons if not provided
        let maxSeason = 0;
        if (data.episodes) {
            data.episodes.forEach((ep: SeriesEpisode) => {
                if (ep.season > maxSeason) maxSeason = ep.season;
            });
        }

        return {
            ...data,
            seasons: maxSeason
        };
    } catch (e) {
        console.error(e);
        return null;
    }
};

export const getSeriesStream = async (episodeId: string, mediaId: string): Promise<SeriesStreamData | null> => {
    try {
        const res = await fetch(`${API_BASE}/watch/${encodeURIComponent(episodeId)}/${encodeURIComponent(mediaId)}`);
        if (!res.ok) throw new Error('Stream failed');
        return await res.json();
    } catch (e) {
        console.error(e);
        return null;
    }
};
