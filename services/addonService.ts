import { MediaType } from '../types';

export interface StremioAddon {
    id: string;
    name: string;
    version: string;
    description: string;
    manifestUrl: string;
    transportUrl: string;
    logo?: string;
}

export interface StremioStream {
    name?: string;
    title?: string;
    infoHash?: string;
    url?: string;
    behaviorHints?: {
        bingeGroup?: string;
        filename?: string;
    };
    addonName: string;
}

const TORRENTIO_MANIFEST_URL = "https://torrentio.strem.fun/manifest.json";

// Helper to convert manifest URL to transport URL (usually just removing /manifest.json if it ends with it, but Stremio addons are flexible)
// Actually, for standard addons, the transport URL is the base URL.
// If manifest is at https://example.com/manifest.json, transport is https://example.com
const getTransportUrl = (manifestUrl: string) => {
    return manifestUrl.replace('/manifest.json', '');
};

const DEFAULT_ADDONS: StremioAddon[] = [
    {
        id: 'com.stremio.torrentio.addon',
        name: 'Torrentio',
        version: '0.0.15',
        description: 'Provides torrent streams from scraped torrent providers.',
        manifestUrl: TORRENTIO_MANIFEST_URL,
        transportUrl: 'https://torrentio.strem.fun',
        logo: 'https://torrentio.strem.fun/images/logo_v1.png'
    }
];

const STORAGE_KEY = 'stremio_addons';

export const getAddons = (): StremioAddon[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const userAddons: StremioAddon[] = stored ? JSON.parse(stored) : [];

    // Merge default and user addons, ensuring no duplicates by ID
    const all = [...DEFAULT_ADDONS];
    userAddons.forEach(addon => {
        if (!all.find(a => a.id === addon.id)) {
            all.push(addon);
        }
    });
    return all;
};

export const addAddon = async (manifestUrl: string): Promise<StremioAddon> => {
    try {
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error('Failed to fetch manifest');
        const manifest = await response.json();

        if (!manifest.id || !manifest.name) {
            throw new Error('Invalid manifest: missing id or name');
        }

        const newAddon: StremioAddon = {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version || '0.0.0',
            description: manifest.description || '',
            manifestUrl,
            transportUrl: getTransportUrl(manifestUrl),
            logo: manifest.logo
        };

        const stored = localStorage.getItem(STORAGE_KEY);
        const userAddons: StremioAddon[] = stored ? JSON.parse(stored) : [];

        // Check if already exists
        if (userAddons.find(a => a.id === newAddon.id) || DEFAULT_ADDONS.find(a => a.id === newAddon.id)) {
            throw new Error('Addon already installed');
        }

        userAddons.push(newAddon);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userAddons));

        return newAddon;
    } catch (error) {
        console.error('Error adding addon:', error);
        throw error;
    }
};

export const removeAddon = (addonId: string) => {
    // Cannot remove default addons
    if (DEFAULT_ADDONS.find(a => a.id === addonId)) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    let userAddons: StremioAddon[] = JSON.parse(stored);
    userAddons = userAddons.filter(a => a.id !== addonId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userAddons));
};

export const fetchAddonStreams = async (
    type: MediaType,
    imdbId: string,
    season?: number,
    episode?: number
): Promise<StremioStream[]> => {
    const addons = getAddons();
    const streams: StremioStream[] = [];

    // Stremio type mapping
    const stremioType = type === MediaType.MOVIE ? 'movie' : 'series';
    // For anime, it might be 'series' or 'movie' depending on the item, but usually 'series' for shows.
    // The user's app distinguishes ANIME, but Stremio usually treats them as series/movie.
    // We'll map ANIME to series for now if it has seasons, or movie if not? 
    // Actually, usually it's just 'series' for TV anime.
    const finalType = type === MediaType.ANIME ? 'series' : stremioType;

    const idString = finalType === 'movie'
        ? imdbId
        : `${imdbId}:${season}:${episode}`;

    const promises = addons.map(async (addon) => {
        try {
            const url = `${addon.transportUrl}/stream/${finalType}/${idString}.json`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();

            if (data.streams && Array.isArray(data.streams)) {
                data.streams.forEach((s: any) => {
                    streams.push({
                        ...s,
                        addonName: addon.name
                    });
                });
            }
        } catch (e) {
            console.error(`Failed to fetch streams from ${addon.name}`, e);
        }
    });

    await Promise.all(promises);
    return streams;
};
