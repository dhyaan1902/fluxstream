const { ANIME } = require('@consumet/extensions');

async function testAnimeProviders() {
    console.log('Testing available ANIME providers...\n');

    const providers = ['Gogoanime', 'Zoro', 'AnimePahe', 'NineAnime', 'Hianime'];

    for (const providerName of providers) {
        try {
            console.log(`\n=== Testing ${providerName} ===`);
            if (!ANIME[providerName]) {
                console.log(`${providerName} not found in ANIME`);
                continue;
            }

            const instance = new ANIME[providerName]();

            // Test Search
            console.log('Searching for "Naruto"...');
            const searchResults = await instance.search('Naruto');
            console.log(`Results: ${searchResults.results?.length || 0} items`);

            if (searchResults.results && searchResults.results.length > 0) {
                const firstResult = searchResults.results[0];
                console.log('First result:', firstResult.title);

                // Test Info
                console.log(`Fetching info for ${firstResult.id}...`);
                const info = await instance.fetchAnimeInfo(firstResult.id);
                console.log(`Episodes: ${info.episodes?.length || 0}`);

                if (info.episodes && info.episodes.length > 0) {
                    // Test Streaming Link
                    const firstEpisode = info.episodes[0];
                    console.log(`Fetching stream for episode ${firstEpisode.id}...`);
                    const sources = await instance.fetchEpisodeSources(firstEpisode.id);
                    console.log(`Sources: ${sources.sources?.length || 0}`);
                    if (sources.sources?.length > 0) {
                        console.log('First source:', sources.sources[0].url);
                    }
                }
            }
        } catch (e) {
            console.error(`${providerName} Error:`, e.message);
        }
    }
}

testAnimeProviders();
