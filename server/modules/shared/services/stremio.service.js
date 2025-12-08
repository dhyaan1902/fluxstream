import axios from "axios";

const ADDONS = [
    {
        id: 'torrentio',
        name: 'Torrentio',
        baseUrl: 'https://torrentio.strem.fun'
    },
    {
        id: 'torrentsdb',
        name: 'TorrentsDB',
        baseUrl: 'https://torrentsdb.com'
    },
    {
        id: 'comet',
        name: 'Comet',
        baseUrl: 'https://comet.elfhosted.com'
    },
    {
        id: 'knightcrawler',
        name: 'Knightcrawler',
        baseUrl: 'https://knightcrawler.elfhosted.com'
    }
];

class StremioService {
    constructor() {
        this.cache = new Map();
    }

    async getStreams(type, id, title = null, season = null, episode = null) {
        const cacheKey = `${type}:${id}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < 1000 * 60 * 15) { // 15 min cache
                return cached.data;
            }
        }

        console.log(`[Stremio] Searching by ID: ${type}/${id}`);
        const promises = ADDONS.map(addon => this.fetchFromAddon(addon, type, id));
        const results = await Promise.allSettled(promises);

        let allStreams = [];
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                allStreams = [...allStreams, ...result.value];
            }
        });

        // If no results and title is provided, try fallback search by title
        if (allStreams.length === 0 && title) {
            console.log(`[Stremio] No results by ID, trying fallback search by title: ${title}`);
            const fallbackStreams = await this.searchByTitle(title, type, season, episode);
            allStreams = fallbackStreams;
        }

        // Deduplicate based on infoHash
        const uniqueStreams = [];
        const seenHashes = new Set();

        allStreams.forEach(stream => {
            if (!stream.infoHash) return;

            if (!seenHashes.has(stream.infoHash)) {
                seenHashes.add(stream.infoHash);
                uniqueStreams.push(stream);
            } else {
                // Merge sources/trackers if needed, or just keep the first one
            }
        });

        // Sort by seeders (descending)
        uniqueStreams.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));

        console.log(`[Stremio] Total unique streams found: ${uniqueStreams.length}`);

        this.cache.set(cacheKey, {
            timestamp: Date.now(),
            data: uniqueStreams
        });

        return uniqueStreams;
    }

    async searchByTitle(title, type, season = null, episode = null) {
        // For series, format as "Title S01E01"
        let searchQuery = title;
        if (type === 'series' && season && episode) {
            const seasonStr = String(season).padStart(2, '0');
            const episodeStr = String(episode).padStart(2, '0');
            searchQuery = `${title} S${seasonStr}E${episodeStr}`;
        }

        console.log(`[Stremio] Fallback search query: ${searchQuery}`);

        // Try searching with constructed query
        // Note: Stremio addons typically don't have text search endpoints
        // This is a limitation, but we log it for debugging
        console.log(`[Stremio] Note: Stremio addons don't support text search, fallback limited`);

        // Return empty for now - the real fallback will happen via indexer service
        return [];
    }

    async fetchFromAddon(addon, type, id) {
        try {
            const url = `${addon.baseUrl}/stream/${type}/${id}.json`;
            console.log(`Fetching from ${addon.name}: ${url}`);

            const response = await axios.get(url, { timeout: 5000 });
            if (!response.data || !response.data.streams) return [];

            return response.data.streams.map(stream => this.parseStream(stream, addon));
        } catch (error) {
            console.error(`Error fetching from ${addon.name}:`, error.message);
            return [];
        }
    }

    parseStream(stream, addon) {
        // Extract infoHash
        const infoHash = stream.infoHash;

        // Parse title/description for metadata
        const rawTitle = stream.title || stream.description || stream.name || '';
        const name = stream.name || addon.name;

        // Extract file size
        let size = 'Unknown';
        let sizeBytes = 0;

        // Try behaviorHints first
        if (stream.behaviorHints && stream.behaviorHints.videoSize) {
            sizeBytes = stream.behaviorHints.videoSize;
            size = this.formatBytes(sizeBytes);
        } else {
            // Regex for size (e.g., 1.2 GB, 500 MB)
            const sizeMatch = rawTitle.match(/💾\s*([\d.]+\s*[GM]B)/i) ||
                rawTitle.match(/(\d+(?:\.\d+)?\s*[GM]B)/i);
            if (sizeMatch) {
                size = sizeMatch[1];
            }
        }

        // Extract seeders
        let seeders = 0;
        const seedersMatch = rawTitle.match(/👤\s*(\d+)/) ||
            rawTitle.match(/Seeds:\s*(\d+)/i) ||
            rawTitle.match(/S:\s*(\d+)/i);
        if (seedersMatch) {
            seeders = parseInt(seedersMatch[1], 10);
        }

        // Extract quality
        let quality = 'Unknown';
        if (rawTitle.includes('2160p') || rawTitle.includes('4K')) quality = '4K';
        else if (rawTitle.includes('1080p')) quality = '1080p';
        else if (rawTitle.includes('720p')) quality = '720p';
        else if (rawTitle.includes('480p')) quality = '480p';

        // Construct magnet if not present but infoHash is
        let magnet = stream.url;
        if (!magnet && infoHash) {
            magnet = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}`;
            if (stream.sources) {
                stream.sources.forEach(tracker => {
                    if (tracker.startsWith('udp') || tracker.startsWith('http')) {
                        magnet += `&tr=${encodeURIComponent(tracker)}`;
                    }
                });
            }
        }

        return {
            title: rawTitle.split('\n')[0], // First line usually has the release name
            fullTitle: rawTitle,
            size,
            seeders,
            leechers: 0, // Stremio addons often don't provide leechers
            magnet,
            infoHash,
            fileIdx: stream.fileIdx,
            indexer: addon.name,
            quality,
            behaviorHints: stream.behaviorHints
        };
    }

    formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }
}

export default new StremioService();
