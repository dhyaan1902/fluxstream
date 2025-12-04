const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const BASE_URL = 'http://localhost:3001';

async function testProviderSelection() {
    console.log('Testing Manual Provider Selection...\n');

    try {
        // 1. Get Providers
        console.log('1. Fetching available providers...');
        const providersRes = await fetch(`${BASE_URL}/anime/providers`);
        const providers = await providersRes.json();
        console.log('Providers:', providers);

        if (providers.length > 1) {
            const provider = providers[1]; // Try the second provider (e.g., Hianime)
            const title = 'Naruto';
            const episodeNumber = 1;

            // 2. Switch Provider
            console.log(`\n2. Switching to ${provider} for "${title}" Ep ${episodeNumber}...`);
            const res = await fetch(`${BASE_URL}/anime/watch-provider`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, title, episodeNumber })
            });

            const data = await res.json();

            if (res.ok) {
                console.log('✓ Success!');
                console.log(`Provider: ${data.provider}`);
                console.log(`Sources: ${data.sources?.length || 0}`);
                if (data.qualities) {
                    console.log(`Qualities: ${data.qualities.length}`);
                    console.log(`First URL: ${data.qualities[0].url.substring(0, 50)}...`);
                }
            } else {
                console.error('✗ Failed:', data.error);
            }
        }
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testProviderSelection();
