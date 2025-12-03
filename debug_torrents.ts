
const PROXY_LIST = [
    "https://corsproxy.io/?",
    "https://api.allorigins.win/raw?url=",
];

const fetchProxied = async (url) => {
    for (const proxy of PROXY_LIST) {
        try {
            const target = `${proxy}${encodeURIComponent(url)}`;
            console.log(`Fetching: ${target}`);
            const res = await fetch(target);
            if (!res.ok) {
                console.log(`Failed: ${res.status}`);
                continue;
            }
            const text = await res.text();
            return text;
        } catch (e) {
            console.log(`Error: ${e.message}`);
            continue;
        }
    }
    return null;
};

const runDebug = async () => {
    console.log("Starting Extended Network Debug...");

    // 1. Test YTS (API)
    const ytsUrl = "https://yts.mx/api/v2/list_movies.json?query_term=Inception";
    console.log("\n--- Testing YTS ---");
    // YTS is direct, but let's try proxied just in case user blocks it, though code uses direct.
    // The code uses fetchDirect for YTS. Let's try direct first.
    try {
        const res = await fetch(ytsUrl);
        if (res.ok) {
            const json = await res.json();
            console.log("YTS Direct Success:", json.status);
            console.log("Movies found:", json.data.movie_count);
        } else {
            console.log("YTS Direct Failed:", res.status);
        }
    } catch (e) {
        console.log("YTS Direct Error:", e.message);
    }

    // 2. Test BitSearch
    const bitUrl = "https://bitsearch.to/search?q=Inception";
    console.log("\n--- Testing BitSearch ---");
    const bitHtml = await fetchProxied(bitUrl);
    if (bitHtml) {
        console.log("BitSearch Response Length:", bitHtml.length);
        if (bitHtml.includes("search-result")) {
            console.log("SUCCESS: Found search-result in BitSearch.");
        } else {
            console.log("FAILURE: Did not find search-result in BitSearch.");
        }
    } else {
        console.log("FAILURE: Could not fetch BitSearch.");
    }

    // 3. Test Nyaa (RSS)
    const nyaaUrl = "https://nyaa.si/?page=rss&q=Naruto";
    console.log("\n--- Testing Nyaa ---");
    const nyaaXml = await fetchProxied(nyaaUrl);
    if (nyaaXml) {
        console.log("Nyaa Response Length:", nyaaXml.length);
        if (nyaaXml.includes("<item>")) {
            console.log("SUCCESS: Found items in Nyaa XML.");
        } else {
            console.log("FAILURE: Did not find items in Nyaa XML.");
        }
    } else {
        console.log("FAILURE: Could not fetch Nyaa.");
    }
};

runDebug();
