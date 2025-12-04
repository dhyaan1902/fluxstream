const { ANIME } = require('@consumet/extensions');

async function testMoreProviders() {
    console.log('Testing Additional ANIME Providers...\n');

    const providers = ['AnimeKai', 'KickAssAnime', 'AnimeSaturn', 'AnimeUnity'];

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
            console.log(`Results: ${searchResults.results?.length || 0}`);

            if (searchResults.results && searchResults.results.length > 0) {
                const firstResult = searchResults.results[0];
                console.log(`Found: ${firstResult.title}`);

                // Test Info
                console.log(`Fetching info...`);
                const info = await instance.fetchAnimeInfo(firstResult.id);
                console.log(`Episodes: ${info.episodes?.length || 0}`);

                if (info.episodes && info.episodes.length > 0) {
                    // Test Streaming
                    const episode = info.episodes[0];
                    console.log(`Fetching stream for episode ${episode.number}...`);
                    const sources = await instance.fetchEpisodeSources(episode.id);
                    console.log(`Sources: ${sources.sources?.length || 0}`);
                    if (sources.sources?.length > 0) {
                        console.log('Success!');
                    }
                }
            }
        } catch (e) {
            console.error(`${providerName} Error:`, e.message);
        }
    }
}

testMoreProviders();
