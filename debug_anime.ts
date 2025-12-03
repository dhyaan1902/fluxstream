
import { searchAnime, getAnimeInfo, getAnimeStream } from './services/animeService';

const testAnime = async () => {
    console.log("--- Testing Anime Search ---");
    const results = await searchAnime("Naruto");
    console.log("Search Results:", results.length);

    if (results.length > 0) {
        const first = results[0];
        console.log("First Result:", first.id, first.title);

        console.log("\n--- Testing Anime Info ---");
        const info = await getAnimeInfo(first.id);
        if (info) {
            console.log("Info Found:", info.title);
            console.log("Episodes:", info.episodes.length);

            if (info.episodes.length > 0) {
                const firstEp = info.episodes[0];
                console.log("\n--- Testing Anime Stream ---");
                console.log("Fetching stream for:", firstEp.id);
                const stream = await getAnimeStream(firstEp.id);
                if (stream) {
                    console.log("Stream Found:", stream.sources.length, "sources");
                    console.log("First Source:", stream.sources[0].url);
                } else {
                    console.error("Stream NOT Found");
                }
            } else {
                console.error("No episodes found in info");
            }
        } else {
            console.error("Info NOT Found");
        }
    } else {
        console.error("No search results");
    }
};

testAnime();
