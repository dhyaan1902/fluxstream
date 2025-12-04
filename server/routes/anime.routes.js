const express = require('express');
const router = express.Router();
const animeController = require('../controllers/anime.controller');

// Search Anime
router.get('/search/:query', animeController.searchAnime);

// Get Anime Info
router.get('/info/:id', animeController.getAnimeInfo);

// Get Anime Episodes
router.get('/episodes/:id', animeController.getAnimeEpisodes);

// Get Stream Sources
router.get('/watch/:episodeId', animeController.getAnimeStream);

module.exports = router;
