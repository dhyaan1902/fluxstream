import express from "express";
const router = express.Router();

// This line makes the function names available as variables:
import { searchAnime, getAnimeInfo, getAnimeEpisodes, getAnimeStream, getProviders, getStreamFromProvider } from "../controllers/anime.controller.js";

// Search Anime
// ✅ Use the variable name directly
router.get('/search/:query', searchAnime);

// Get Anime Info
// ✅ Use the variable name directly
router.get('/info/:id', getAnimeInfo);

// Get Anime Episodes
// ✅ Use the variable name directly
router.get('/episodes/:id', getAnimeEpisodes);

// Get Stream Sources
// ✅ Use the variable name directly
router.get('/watch/:episodeId', getAnimeStream);

// Get Available Providers
// ✅ Use the variable name directly
router.get('/providers', getProviders);

// Get Stream from Specific Provider
// ✅ Use the variable name directly
router.post('/watch-provider', getStreamFromProvider);

export default router;