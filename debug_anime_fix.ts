
const API_BASE = "http://localhost:3001/anime";

async function testAnimeFlow() {
    try {
        console.log("1. Searching for 'Naruto'...");
        const searchRes = await fetch(`${API_BASE}/search/Naruto`);
        const searchData = await searchRes.json();

        if (!searchData.results || searchData.results.length === 0) {
            console.error("Search returned no results");
            return;
        }

        const animeId = searchData.results[0].id;
        console.log(`Found anime: ${animeId}`);

        console.log(`2. Getting info for ${animeId}...`);
        const infoRes = await fetch(`${API_BASE}/info/${animeId}`);
        const infoData = await infoRes.json();

        if (!infoData.episodes || infoData.episodes.length === 0) {
            console.error("No episodes found");
            return;
        }

        const episodeId = infoData.episodes[0].id;
        console.log(`Found episode: ${episodeId}`);

        console.log(`3. Getting stream for ${episodeId}...`);
        const streamRes = await fetch(`${API_BASE}/watch/${encodeURIComponent(episodeId)}`);
        const streamData = await streamRes.json();

        console.log("Stream Data:", JSON.stringify(streamData, null, 2));

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testAnimeFlow();
