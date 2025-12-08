import animeService from "../services/anime.service.js";

/**
 * Search for anime
 */
// 🛑 Changed from 'async;' to 'async '
export const searchAnime = async (req, res) => {
    try {
        // NOTE: req.params is for URL segments (e.g., /anime/search/dragonball). 
        // If you are using query parameters (e.g., /anime/search?query=dragonball), you should use req.query.query or req.query.q
        const { query } = req.params; 
        console.log(`[Anime Controller] Searching for: "${query}"`);
        const results = await animeService.searchAnime(query);
        res.json(results);
    } catch (error) {
        console.error('[Anime Controller] Search error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to search anime' });
    }
};

/**
 * Get anime information by ID
 */
// 🛑 Changed from 'async;' to 'async '
export const getAnimeInfo = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[Anime Controller] Getting info for ID: ${id}`);
        const info = await animeService.getAnimeInfo(id);
        res.json(info);
    } catch (error) {
        console.error('[Anime Controller] Info error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get anime info' });
    }
};

/**
 * Get anime episodes by ID
 */
// 🛑 Changed from 'async;' to 'async '
export const getAnimeEpisodes = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[Anime Controller] Getting episodes for ID: ${id}`);
        const episodes = await animeService.getAnimeEpisodes(id);
        res.json(episodes);
    } catch (error) {
        console.error('[Anime Controller] Episodes error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get episodes' });
    }
};

/**
 * Get stream sources for an episode
 */
// 🛑 Changed from 'async;' to 'async '
export const getAnimeStream = async (req, res) => {
    try {
        const { episodeId } = req.params;
        console.log(`[Anime Controller] Getting stream for episode: ${episodeId}`);
        const stream = await animeService.getAnimeStream(episodeId);
        res.json(stream);
    } catch (error) {
        console.error('[Anime Controller] Stream error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get stream sources' });
    }
};

/**
 * Get list of available providers
 */
// 🛑 Changed from 'async;' to 'async '
export const getProviders = async (req, res) => {
    try {
        console.log('[Anime Controller] Getting providers list');
        // NOTE: If getAnimeProviders() uses await inside, this should be awaited as well.
        // If it returns a Promise, you must use 'await'. If it returns a simple array, 'await' is optional.
        const providers = animeService.getAnimeProviders(); 
        res.json(providers);
    } catch (error) {
        console.error('[Anime Controller] Providers error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get providers' });
    }
};

/**
 * Get stream from a specific provider
 */
// 🛑 Changed from 'async;' to 'async '
export const getStreamFromProvider = async (req, res) => {
    try {
        const { provider, title, episodeNumber } = req.body;
        console.log(`[Anime Controller] Getting stream from ${provider} for "${title}" Ep ${episodeNumber}`);

        if (!provider || !title || !episodeNumber) {
            return res.status(400).json({ error: 'Provider, title, and episodeNumber are required' });
        }

        const stream = await animeService.getStreamFromProvider(provider, title, episodeNumber);
        res.json(stream);
    } catch (error) {
        console.error('[Anime Controller] Provider stream error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to get stream from provider' });
    }
};