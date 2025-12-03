const { MOVIES } = require('@consumet/extensions');

async function testProviders() {
    console.log('Testing available MOVIES providers...\n');

    const providers = Object.keys(MOVIES);
    console.log('Available providers:', providers);

    // Test FlixHQ
    try {
        console.log('\n=== Testing FlixHQ ===');
        const flixhq = new MOVIES.FlixHQ();
        const results = await flixhq.search('Breaking Bad');
        console.log('FlixHQ Search Results:', results.results?.length || 0, 'items');
        if (results.results && results.results[0]) {
            console.log('First result:', results.results[0]);
        }
    } catch (e) {
        console.error('FlixHQ Error:', e.message);
    }

    // Test other providers
    for (const providerName of providers) {
        if (providerName === 'FlixHQ') continue;

        try {
            console.log(`\n=== Testing ${providerName} ===`);
            const Provider = MOVIES[providerName];
            const instance = new Provider();

            if (typeof instance.search === 'function') {
                const results = await instance.search('Breaking Bad');
                console.log(`${providerName} Search Results:`, results.results?.length || 0, 'items');
                if (results.results && results.results[0]) {
                    console.log('First result:', results.results[0]);
                }
            } else {
                console.log(`${providerName} does not support search`);
            }
        } catch (e) {
            console.error(`${providerName} Error:`, e.message);
        }
    }
}

testProviders();
