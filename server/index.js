const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const pump = require('pump');
const { META, ANIME, MOVIES } = require('@consumet/extensions');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Consumet Providers
// Using AnimePahe for speed and reliability
const animeProvider = new ANIME.AnimePahe();
// Using FlixHQ for Series/Movies
const flixhq = new MOVIES.FlixHQ();

// Store active torrents
const torrents = new Map();

app.use(cors());
app.use(express.json());

// --- Anime Routes ---

// Search Anime
app.get('/anime/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const results = await animeProvider.search(query);
        res.json(results);
    } catch (error) {
        console.error('Anime search error:', error);
        res.status(500).json({ error: 'Failed to search anime' });
    }
});

// Get Anime Info
app.get('/anime/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const info = await animeProvider.fetchAnimeInfo(id);
        res.json(info);
    } catch (error) {
        console.error('Anime info error:', error);
        res.status(500).json({ error: 'Failed to get anime info' });
    }
});

// Get Anime Episodes
app.get('/anime/episodes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const info = await animeProvider.fetchAnimeInfo(id);
        res.json(info.episodes);
    } catch (error) {
        console.error('Anime episodes error:', error);
        res.status(500).json({ error: 'Failed to get anime episodes' });
    }
});

// Get Stream Sources
app.get('/anime/watch/:episodeId', async (req, res) => {
    try {
        const { episodeId } = req.params;
        const sources = await animeProvider.fetchEpisodeSources(episodeId);
        res.json(sources);
    } catch (error) {
        console.error('Anime stream error:', error);
        res.status(500).json({ error: 'Failed to get stream sources' });
    }
});


// --- Series Routes with Multi-Provider Fallback ---

// Initialize multiple providers for reliability
const seriesProviders = [
    { name: 'FlixHQ', instance: new MOVIES.FlixHQ() },
    { name: 'DramaCool', instance: new MOVIES.DramaCool() },
    { name: 'Goku', instance: new MOVIES.Goku() }
];

// Helper to try providers in sequence
async function tryProviders(operation, ...args) {
    let lastError = null;

    for (const provider of seriesProviders) {
        try {
            console.log(`Trying ${provider.name} for ${operation}...`);
            const result = await provider.instance[operation](...args);
            if (result && (result.results?.length > 0 || result.episodes?.length > 0 || result.sources?.length > 0)) {
                console.log(`✓ ${provider.name} succeeded for ${operation}`);
                return result;
            }
        } catch (error) {
            console.error(`✗ ${provider.name} failed:`, error.message);
            lastError = error;
        }
    }

    throw lastError || new Error('All providers failed');
}

// Search Series
app.get('/series/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const results = await tryProviders('search', query);
        res.json(results);
    } catch (error) {
        console.error('All series search providers failed:', error);
        res.status(500).json({ error: 'Failed to search series from all providers' });
    }
});

// Get Series Info
app.get('/series/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const info = await tryProviders('fetchMediaInfo', id);
        res.json(info);
    } catch (error) {
        console.error('All series info providers failed:', error);
        res.status(500).json({ error: 'Failed to get series info from all providers' });
    }
});

// Get Series Stream Sources
app.get('/series/watch/:episodeId/:mediaId', async (req, res) => {
    try {
        const { episodeId, mediaId } = req.params;
        const sources = await tryProviders('fetchEpisodeSources', episodeId, mediaId);
        res.json(sources);
    } catch (error) {
        console.error('All series stream providers failed:', error);
        res.status(500).json({ error: 'Failed to get stream sources from all providers' });
    }
});


// --- Torrent Routes ---

// Add magnet and get torrent ID
app.post('/api/torrent/add', (req, res) => {
    const { magnet } = req.body;

    if (!magnet) {
        return res.status(400).json({ error: 'Magnet link required' });
    }

    const engine = torrentStream(magnet, {
        connections: 100,
        uploads: 10,
        verify: true
    });

    const torrentId = Date.now().toString();

    engine.on('ready', () => {
        const files = engine.files.map((file, index) => ({
            index,
            name: file.name,
            length: file.length,
            path: file.path
        }));

        torrents.set(torrentId, { engine, files });

        res.json({
            id: torrentId,
            files,
            infoHash: engine.infoHash
        });
    });

    engine.on('error', (err) => {
        console.error('Torrent error:', err);
        res.status(500).json({ error: err.message });
    });
});

// Stream file with range support
app.get('/api/torrent/:id/stream/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    const torrent = torrents.get(id);

    if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrent.engine.files[parseInt(fileIndex)];
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    const range = req.headers.range;
    const fileSize = file.length;

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': 'video/mp4'
        });

        const stream = file.createReadStream({ start, end });
        pump(stream, res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4'
        });

        const stream = file.createReadStream();
        pump(stream, res);
    }
});

// Download file
app.get('/api/torrent/:id/download/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    const torrent = torrents.get(id);

    if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrent.engine.files[parseInt(fileIndex)];
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', file.length);

    const stream = file.createReadStream();
    pump(stream, res);
});

// Get torrent status
app.get('/api/torrent/:id/status', (req, res) => {
    const { id } = req.params;
    const torrent = torrents.get(id);

    if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const swarm = torrent.engine.swarm;

    res.json({
        downloaded: swarm.downloaded,
        uploaded: swarm.uploaded,
        downloadSpeed: swarm.downloadSpeed(),
        uploadSpeed: swarm.uploadSpeed(),
        peers: swarm.wires.length,
        files: torrent.files
    });
});

// Remove torrent
app.delete('/api/torrent/:id', (req, res) => {
    const { id } = req.params;
    const torrent = torrents.get(id);

    if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    torrent.engine.destroy(() => {
        torrents.delete(id);
        res.json({ message: 'Torrent removed' });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
