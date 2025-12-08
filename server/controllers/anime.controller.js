import animeService from "../services/anime.service.js";

/**
 * Search for anime
 * @route GET /anime/search/:query
 */
async function searchAnime(req, res) {
    try {
        const { query } = req.params;
        const results = await animeService.searchAnime(query);
        res.json(results);
    } catch (error) {
        console.error('[Anime Controller] Search error:', error);
        res.status(500).json({ error: 'Failed to search anime' });
    }
}

/**
 * Get anime information
 * @route GET /anime/info/:id
 */
async function getAnimeInfo(req, res) {
    try {
        const { id } = req.params;
        const info = await animeService.getAnimeInfo(id);
        res.json(info);
    } catch (error) {
        console.error('[Anime Controller] Info error:', error);
        res.status(500).json({ error: 'Failed to get anime info' });
    }
}

/**
 * Get anime episodes
 * @route GET /anime/episodes/:id
 */
async function getAnimeEpisodes(req, res) {
    try {
        const { id } = req.params;
        const episodes = await animeService.getAnimeEpisodes(id);
        res.json(episodes);
    } catch (error) {
        console.error('[Anime Controller] Episodes error:', error);
        res.status(500).json({ error: 'Failed to get anime episodes' });
    }
}

/**
 * Get anime stream sources
 * @route GET /anime/watch/:episodeId
 */
async function getAnimeStream(req, res) {
    try {
        const { episodeId } = req.params;
        const sources = await animeService.getAnimeStream(episodeId);
        res.json(sources);
    } catch (error) {
        console.error('[Anime Controller] Stream error:', error);
        res.status(500).json({ error: 'Failed to get stream sources' });
    }
}

/**
 * Get available anime providers
 * @route GET /anime/providers
 */
async function getProviders(req, res) {
    try {
        const providers = animeService.getAnimeProviders();
        res.json(providers);
    } catch (error) {
        console.error('[Anime Controller] Get providers error:', error);
        res.status(500).json({ error: 'Failed to get providers' });
    }
}

/**
 * Get stream from specific provider
 * @route POST /anime/watch-provider
 */
async function getStreamFromProvider(req, res) {
    try {
        const { provider, title, episodeNumber } = req.body;
        if (!provider || !title || !episodeNumber) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const sources = await animeService.getStreamFromProvider(provider, title, episodeNumber);
        res.json(sources);
    } catch (error) {
        console.error('[Anime Controller] Provider stream error:', error);
        res.status(500).json({ error: error.message || 'Failed to get stream from provider' });
    }
}

export default {
    searchAnime;,
    getAnimeInfo,
    getAnimeEpisodes,
    getAnimeStream,
    getProviders,
    getStreamFromProvider
};
