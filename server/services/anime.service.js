const { ANIME } = require('@consumet/extensions');

// Initialize Anime Providers with fallback priority
const animeProviders = [
    { name: 'AnimePahe', instance: new ANIME.AnimePahe() },
    { name: 'Hianime', instance: new ANIME.Hianime() }, // Zoro replacement
    // { name: 'Gogoanime', instance: new ANIME.Gogoanime() } // Currently unstable/missing
];

/**
 * Try providers in sequence until one succeeds
 * @param {Array} providers - Array of provider objects
 * @param {string} operation - Method name to call on provider
 * @param  {...any} args - Arguments to pass to the method
 * @returns {Promise} - Result from successful provider
 */
async function tryProviders(providers, operation, ...args) {
    let lastError = null;

    for (const provider of providers) {
        try {
            if (!provider.instance[operation]) {
                continue;
            }
            console.log(`[Anime Service] Trying ${provider.name} for ${operation}...`);
            const result = await provider.instance[operation](...args);

            // Check if result is valid (has results, episodes, or sources)
            if (result) {
                const hasResults = result.results && result.results.length > 0;
                const hasEpisodes = result.episodes && result.episodes.length > 0;
                const hasSources = result.sources && result.sources.length > 0;
                const isInfo = result.id && result.title; // For fetchAnimeInfo

                if (hasResults || hasEpisodes || hasSources || isInfo) {
                    console.log(`[Anime Service] ✓ ${provider.name} succeeded for ${operation}`);
                    return result;
                }
            }
        } catch (error) {
            console.error(`[Anime Service] ✗ ${provider.name} failed:`, error.message);
            lastError = error;
        }
    }

    throw lastError || new Error('All anime providers failed');
}

/**
 * Search for anime across providers
 * @param {string} query - Search query
 * @returns {Promise} - Search results
 */
async function searchAnime(query) {
    return tryProviders(animeProviders, 'search', query);
}

/**
 * Get anime information by ID
 * @param {string} id - Anime ID
 * @returns {Promise} - Anime info
 */
async function getAnimeInfo(id) {
    return tryProviders(animeProviders, 'fetchAnimeInfo', id);
}

/**
 * Get anime episodes by ID
 * @param {string} id - Anime ID
 * @returns {Promise} - Episode list
 */
async function getAnimeEpisodes(id) {
    const info = await tryProviders(animeProviders, 'fetchAnimeInfo', id);
    return info.episodes;
}

/**
 * Get streaming sources for an episode
 * @param {string} episodeId - Episode ID
 * @returns {Promise} - Stream sources with enhanced metadata
 */
async function getAnimeStream(episodeId) {
    let lastError = null;
    let successfulProvider = null;

    // Try each provider
    for (const provider of animeProviders) {
        try {
            if (!provider.instance.fetchEpisodeSources) {
                continue;
            }
            console.log(`[Anime Service] Trying ${provider.name} for fetchEpisodeSources...`);
            const result = await provider.instance.fetchEpisodeSources(episodeId);

            if (result && result.sources && result.sources.length > 0) {
                console.log(`[Anime Service] ✓ ${provider.name} succeeded for fetchEpisodeSources`);
                successfulProvider = provider.name;

                // Enhance the response with quality organization and metadata
                const enhancedResponse = {
                    ...result,
                    provider: successfulProvider,
                    qualities: result.sources.map((source, index) => ({
                        id: index,
                        quality: source.quality || 'default',
                        url: source.url,
                        isM3U8: source.isM3U8,
                        isDefault: index === 0 // First source is default
                    })),
                    // Keep original sources array for backward compatibility
                    sources: result.sources
                };

                return enhancedResponse;
            }
        } catch (error) {
            console.error(`[Anime Service] ✗ ${provider.name} failed:`, error.message);
            lastError = error;
        }
    }

    throw lastError || new Error('All anime providers failed');
}

module.exports = {
    searchAnime,
    getAnimeInfo,
    getAnimeEpisodes,
    getAnimeStream
};
