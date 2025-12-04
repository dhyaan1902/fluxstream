// Dynamic import for node-fetch
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testEndpoints() {
    console.log('Testing Anime Endpoints...\n');

    try {
        // 1. Search
        console.log('1. Searching for "Naruto"...');
        const searchRes = await fetch(`${BASE_URL}/anime/search/Naruto`);
        const searchData = await searchRes.json();
        console.log(`Search Status: ${searchRes.status}`);
        console.log(`Results: ${searchData.results?.length || 0}`);

        if (searchData.results && searchData.results.length > 0) {
            const animeId = searchData.results[0].id;
            console.log(`\nSelected Anime ID: ${animeId}`);

            // 2. Info
            console.log(`\n2. Fetching Info for ${animeId}...`);
            const infoRes = await fetch(`${BASE_URL}/anime/info/${animeId}`);
            const infoData = await infoRes.json();
            console.log(`Info Status: ${infoRes.status}`);
            console.log(`Episodes: ${infoData.episodes?.length || 0}`);

            if (infoData.episodes && infoData.episodes.length > 0) {
                const episodeId = infoData.episodes[0].id;
                console.log(`\nSelected Episode ID: ${episodeId}`);

                // 3. Stream Sources
                console.log(`\n3. Fetching Stream Sources for ${episodeId}...`);
                const streamRes = await fetch(`${BASE_URL}/anime/watch/${encodeURIComponent(episodeId)}`);
                const streamData = await streamRes.json();
                console.log(`Stream Status: ${streamRes.status}`);
                console.log(`Sources: ${streamData.sources?.length || 0}`);
                if (streamData.sources?.length > 0) {
                    console.log(`First Source: ${streamData.sources[0].url}`);
                }
            }
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Wait for server to start if running concurrently, but here we assume server is running
// We will run this script separately while server is running
testEndpoints();
