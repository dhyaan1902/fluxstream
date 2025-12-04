const { ANIME } = require('@consumet/extensions');

async function testAnimeSources() {
    console.log('Testing Anime Source Structure...\n');

    try {
        const animepahe = new ANIME.AnimePahe();

        // Search for Naruto
        console.log('1. Searching for "Naruto"...');
        const results = await animepahe.search('Naruto');

        if (results.results && results.results.length > 0) {
            const anime = results.results[0];
            console.log(`Found: ${anime.title}`);
            console.log(`ID: ${anime.id}\n`);

            // Get anime info
            console.log('2. Fetching anime info...');
            const info = await animepahe.fetchAnimeInfo(anime.id);
            console.log(`Episodes: ${info.episodes?.length || 0}\n`);

            if (info.episodes && info.episodes.length > 0) {
                const episode = info.episodes[0];
                console.log(`Testing Episode: ${episode.title || episode.number}`);
                console.log(`Episode ID: ${episode.id}\n`);

                // Get episode sources
                console.log('3. Fetching episode sources...');
                const sources = await animepahe.fetchEpisodeSources(episode.id);

                console.log('\n=== SOURCE STRUCTURE ===');
                console.log(JSON.stringify(sources, null, 2));

                console.log('\n=== SUMMARY ===');
                console.log(`Total sources: ${sources.sources?.length || 0}`);
                if (sources.sources) {
                    sources.sources.forEach((source, idx) => {
                        console.log(`\nSource ${idx + 1}:`);
                        console.log(`  URL: ${source.url}`);
                        console.log(`  Quality: ${source.quality || 'default'}`);
                        console.log(`  isM3U8: ${source.isM3U8}`);
                    });
                }

                console.log('\n=== HEADERS ===');
                console.log(JSON.stringify(sources.headers, null, 2));

                console.log('\n=== DOWNLOAD ===');
                console.log(JSON.stringify(sources.download, null, 2));
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAnimeSources();
