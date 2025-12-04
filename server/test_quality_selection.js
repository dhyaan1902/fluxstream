const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testQualitySelection() {
    console.log('Testing Quality Selection Feature...\n');

    try {
        // 1. Search
        console.log('1. Searching for "Naruto"...');
        const searchRes = await fetch(`${BASE_URL}/anime/search/Naruto`);
        const searchData = await searchRes.json();
        console.log(`Results: ${searchData.results?.length || 0}`);

        if (searchData.results && searchData.results.length > 0) {
            const animeId = searchData.results[0].id;

            // 2. Get Info
            const infoRes = await fetch(`${BASE_URL}/anime/info/${animeId}`);
            const infoData = await infoRes.json();

            if (infoData.episodes && infoData.episodes.length > 0) {
                const episodeId = infoData.episodes[0].id;

                // 3. Get Stream Sources (with quality info)
                console.log(`\n2. Fetching stream sources for episode 1...`);
                const streamRes = await fetch(`${BASE_URL}/anime/watch/${encodeURIComponent(episodeId)}`);
                const streamData = await streamRes.json();

                console.log(`\n=== QUALITY SELECTION TEST ===`);
                console.log(`Provider: ${streamData.provider || 'N/A'}`);
                console.log(`\nAvailable Qualities:`);

                if (streamData.qualities && streamData.qualities.length > 0) {
                    streamData.qualities.forEach((q, idx) => {
                        console.log(`  ${idx + 1}. ${q.quality} (${q.isM3U8 ? 'HLS' : 'Direct'}) ${q.isDefault ? '✓ DEFAULT' : ''}`);
                        console.log(`     URL: ${q.url.substring(0, 80)}...`);
                    });
                    console.log(`\n✓ Quality selection feature working! ${streamData.qualities.length} qualities available.`);
                } else {
                    console.log('⚠ No enhanced quality data. Falling back to sources array:');
                    streamData.sources?.forEach((s, idx) => {
                        console.log(`  ${idx + 1}. ${s.quality || 'default'}`);
                    });
                }
            }
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testQualitySelection();
