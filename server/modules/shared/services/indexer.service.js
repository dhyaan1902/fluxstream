import axios from "axios";

/**
 * Jackett/Prowlarr Integration Service
 * Supports both Jackett and Prowlarr for torrent indexing
 */

class TorrentIndexerService {
    constructor() {
        // Configuration - can be set via environment variables or user preferences
        this.jackettUrl = process.env.JACKETT_URL || 'http://localhost:9117';
        this.jackettApiKey = process.env.JACKETT_API_KEY || '';
        this.prowlarrUrl = process.env.PROWLARR_URL || 'http://localhost:9696';
        this.prowlarrApiKey = process.env.PROWLARR_API_KEY || '';

        // Preferred service: 'jackett', 'prowlarr', or 'auto'
        this.preferredService = process.env.INDEXER_SERVICE || 'auto';
    }

    /**
     * Check if Jackett is available
     */
    async isJackettAvailable() {
        if (!this.jackettApiKey) return false;
        try {
            const response = await axios.get(`${this.jackettUrl}/api/v2.0/indexers/all/results/torznab/api`, {
                params: { apikey: this.jackettApiKey, t: 'caps' },
                timeout: 3000
            });
            return response.status === 200;
        } catch (err) {
            return false;
        }
    }

    /**
     * Check if Prowlarr is available
     */
    async isProwlarrAvailable() {
        if (!this.prowlarrApiKey) return false;
        try {
            const response = await axios.get(`${this.prowlarrUrl}/api/v1/indexer`, {
                headers: { 'X-Api-Key': this.prowlarrApiKey },
                timeout: 3000
            });
            return response.status === 200;
        } catch (err) {
            return false;
        }
    }

    /**
     * Determine which service to use
     */
    async getActiveService() {
        if (this.preferredService === 'jackett') {
            return await this.isJackettAvailable() ? 'jackett' : null;
        } else if (this.preferredService === 'prowlarr') {
            return await this.isProwlarrAvailable() ? 'prowlarr' : null;
        } else {
            // Auto mode - try Prowlarr first (recommended), then Jackett
            if (await this.isProwlarrAvailable()) return 'prowlarr';
            if (await this.isJackettAvailable()) return 'jackett';
            return null;
        }
    }

    /**
     * Search torrents via Jackett
     */
    async searchJackett(query, category = null) {
        try {
            const params = {
                apikey: this.jackettApiKey,
                t: 'search',
                q: query
            };

            if (category) {
                // Torznab categories: 2000=Movies, 5000=TV, 5070=Anime
                params.cat = category;
            }

            const response = await axios.get(`${this.jackettUrl}/api/v2.0/indexers/all/results/torznab/api`, {
                params,
                timeout: 10000
            });

            return this.parseJackettResults(response.data);
        } catch (err) {
            console.error('Jackett search error:', err.message);
            return [];
        }
    }

    /**
     * Search torrents via Prowlarr
     */
    async searchProwlarr(query, categories = null) {
        try {
            const params = {
                query,
                type: 'search'
            };

            if (categories) {
                params.categories = Array.isArray(categories) ? categories.join(',') : categories;
            }

            const response = await axios.get(`${this.prowlarrUrl}/api/v1/search`, {
                headers: { 'X-Api-Key': this.prowlarrApiKey },
                params,
                timeout: 10000
            });

            return this.parseProwlarrResults(response.data);
        } catch (err) {
            console.error('Prowlarr search error:', err.message);
            return [];
        }
    }

    /**
     * Parse Jackett XML/RSS results
     */
    parseJackettResults(data) {
        // Jackett returns Torznab XML format
        // This is a simplified parser - in production, use xml2js
        const results = [];

        // For now, return empty array - full XML parsing would require xml2js
        // In production, parse the XML and extract torrent info
        console.log('Jackett results received, XML parsing needed');
        return results;
    }

    /**
     * Parse Prowlarr JSON results
     */
    parseProwlarrResults(data) {
        if (!Array.isArray(data)) return [];

        return data.map(item => ({
            title: item.title,
            magnet: item.magnetUrl || item.downloadUrl,
            size: this.formatBytes(item.size),
            seeders: item.seeders || 0,
            leechers: item.leechers || 0,
            indexer: item.indexer,
            publishDate: item.publishDate,
            infoHash: item.infoHash,
            quality: this.extractQuality(item.title),
            category: item.categories?.[0] || 'Unknown'
        }));
    }

    /**
     * Universal search method
     */
    async search(query, options = {}) {
        const service = await this.getActiveService();

        if (!service) {
            console.log('No indexer service available, using fallback providers');
            return [];
        }

        console.log(`Using ${service} for torrent search: ${query}`);

        if (service === 'jackett') {
            return await this.searchJackett(query, options.category);
        } else {
            return await this.searchProwlarr(query, options.categories);
        }
    }

    /**
     * Search for movies
     */
    async searchMovies(title, year = null) {
        const query = year ? `${title} ${year}` : title;
        return await this.search(query, {
            category: '2000', // Jackett movie category
            categories: [2000, 2010, 2020, 2030, 2040, 2045, 2050, 2060] // Prowlarr movie categories
        });
    }

    /**
     * Search for TV shows
     */
    async searchSeries(title, season = null, episode = null) {
        let query = title;
        if (season && episode) {
            query += ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        } else if (season) {
            query += ` S${String(season).padStart(2, '0')}`;
        }

        return await this.search(query, {
            category: '5000', // Jackett TV category
            categories: [5000, 5010, 5020, 5030, 5040, 5045, 5050, 5060, 5070, 5080] // Prowlarr TV categories
        });
    }

    /**
     * Search for anime
     */
    async searchAnime(title, episode = null) {
        const query = episode ? `${title} ${episode}` : title;
        return await this.search(query, {
            category: '5070', // Jackett anime category
            categories: [5070] // Prowlarr anime category
        });
    }

    /**
     * Extract quality from title
     */
    extractQuality(title) {
        const qualities = ['2160p', '4K', '1080p', '720p', '480p', 'WEB-DL', 'BluRay', 'HDRip', 'WEBRip'];
        for (const quality of qualities) {
            if (title.toUpperCase().includes(quality.toUpperCase())) {
                return quality;
            }
        }
        return 'Unknown';
    }

    /**
     * Format bytes to human-readable size
     */
    formatBytes(bytes) {
        if (!bytes) return 'Unknown';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    }

    /**
     * Get service status
     */
    async getStatus() {
        const jackettAvailable = await this.isJackettAvailable();
        const prowlarrAvailable = await this.isProwlarrAvailable();
        const activeService = await this.getActiveService();

        return {
            jackett: {
                configured: !!this.jackettApiKey,
                available: jackettAvailable,
                url: this.jackettUrl
            },
            prowlarr: {
                configured: !!this.prowlarrApiKey,
                available: prowlarrAvailable,
                url: this.prowlarrUrl
            },
            activeService,
            preferredService: this.preferredService
        };
    }
}

export default new TorrentIndexerService();
