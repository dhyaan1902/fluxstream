import {  ANIME  } from "@consumet/extensions";

// Initialize Anime Providers with fallback priority
const animeProviders = [
    { name: 'AnimePahe', instance: new ANIME.AnimePahe() },
    { name: 'Hianime', instance: new ANIME.Hianime() }, // Zoro replacement
    { name: 'AnimeKai', instance: new ANIME.AnimeKai() },
    { name: 'KickAssAnime', instance: new ANIME.KickAssAnime() },
    { name: 'AnimeSaturn', instance: new ANIME.AnimeSaturn() },
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

/**
 * Get list of available anime providers
 * @returns {string[]} - List of provider names
 */
function getAnimeProviders() {
    return animeProviders.map(p => p.name);
}

/**
 * Get stream from a specific provider by searching for the title
 * @param {string} providerName - Name of the provider
 * @param {string} title - Anime title
 * @param {number} episodeNumber - Episode number
 * @returns {Promise} - Stream sources
 */
async function getStreamFromProvider(providerName, title, episodeNumber) {
    const providerObj = animeProviders.find(p => p.name === providerName);
    if (!providerObj) {
        throw new Error(`Provider ${providerName} not found`);
    }

    console.log(`[Anime Service] Manual switch to ${providerName} for "${title}" Ep ${episodeNumber}`);

    // 1. Search for the anime on the new provider
    console.log(`[Anime Service] Searching for "${title}" on ${providerName}...`);
    const searchResults = await providerObj.instance.search(title);

    if (!searchResults.results || searchResults.results.length === 0) {
        throw new Error(`Anime "${title}" not found on ${providerName}`);
    }

    // Assume the first result is the correct one (best match)
    const animeId = searchResults.results[0].id;
    console.log(`[Anime Service] Found ID: ${animeId}`);

    // 2. Fetch episodes
    console.log(`[Anime Service] Fetching episodes for ${animeId}...`);
    const info = await providerObj.instance.fetchAnimeInfo(animeId);

    if (!info.episodes || info.episodes.length === 0) {
        throw new Error(`No episodes found for "${title}" on ${providerName}`);
    }

    // 3. Find the matching episode
    const episode = info.episodes.find(ep => ep.number === parseInt(episodeNumber));

    if (!episode) {
        throw new Error(`Episode ${episodeNumber} not found on ${providerName}`);
    }

    console.log(`[Anime Service] Found Episode ID: ${episode.id}`);

    // 4. Fetch stream sources
    console.log(`[Anime Service] Fetching sources for episode ${episode.id}...`);
    const result = await providerObj.instance.fetchEpisodeSources(episode.id);

    // Enhance response
    const enhancedResponse = {
        ...result,
        provider: providerName,
        qualities: result.sources.map((source, index) => ({
            id: index,
            quality: source.quality || 'default',
            url: source.url,
            isM3U8: source.isM3U8,
            isDefault: index === 0
        })),
        sources: result.sources
    };

    return enhancedResponse;
}

export default {
    searchAnime,
    getAnimeInfo,
    getAnimeEpisodes,
    getAnimeStream,
    getAnimeProviders,
    getStreamFromProvider
};
