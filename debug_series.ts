
const API_BASE = "http://localhost:3001/series";

async function testSeriesFlow() {
    try {
        console.log("1. Searching for 'Breaking Bad'...");
        const searchRes = await fetch(`${API_BASE}/search/Breaking%20Bad`);
        const searchData = await searchRes.json();

        if (!searchData.results || searchData.results.length === 0) {
            console.error("Search returned no results");
            return;
        }

        const seriesId = searchData.results[0].id;
        console.log(`Found series: ${seriesId}`);

        console.log(`2. Getting info for ${seriesId}...`);
        const infoRes = await fetch(`${API_BASE}/info/${seriesId}`);
        const infoData = await infoRes.json();

        if (!infoData.episodes || infoData.episodes.length === 0) {
            console.error("No episodes found");
            return;
        }

        const episode = infoData.episodes[0];
        console.log(`Found episode: S${episode.season} E${episode.number} (${episode.id})`);

        console.log(`3. Getting stream for ${episode.id}...`);
        const streamRes = await fetch(`${API_BASE}/watch/${encodeURIComponent(episode.id)}/${encodeURIComponent(seriesId)}`);
        const streamData = await streamRes.json();

        console.log("Stream Data:", JSON.stringify(streamData, null, 2));

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testSeriesFlow();
