const express = require('express');
const cors = require('cors');
const torrentStream = require('torrent-stream');
const pump = require('pump');
const { META, ANIME, MOVIES } = require('@consumet/extensions');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Consumet Providers
// Using AnimePahe for speed and reliability
const animeProvider = new ANIME.AnimePahe();
// Using FlixHQ for Series/Movies
const flixhq = new MOVIES.FlixHQ();

// Store active torrents with metadata
const torrents = new Map(); // { id: { engine, files, lastAccessed, createdAt } }

// Helper function to update last accessed time
function touchTorrent(id) {
    const torrent = torrents.get(id);
    if (torrent) {
        torrent.lastAccessed = Date.now();
    }
}

// Cleanup inactive torrents (non-blocking)
function cleanupInactiveTorrents() {
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    let cleaned = 0;

    for (const [id, torrent] of torrents.entries()) {
        if (now - torrent.lastAccessed > THIRTY_MINUTES) {
            console.log(`🧹 Cleaning up inactive torrent: ${id}`);
            try {
                torrent.engine.destroy();
                torrents.delete(id);
                cleaned++;
            } catch (err) {
                console.error(`Error cleaning up torrent ${id}:`, err.message);
            }
        }
    }

    if (cleaned > 0) {
        console.log(`✓ Cleaned up ${cleaned} inactive torrent(s)`);
    }
}

// Monitor disk usage and cleanup if needed (non-blocking)
async function monitorDiskUsage() {
    try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);

        // Get /tmp size (Linux/Mac)
        const { stdout } = await execPromise('du -sb /tmp 2>/dev/null | cut -f1').catch(() => ({ stdout: '0' }));
        const tmpSize = parseInt(stdout.trim() || '0');
        const tmpSizeGB = (tmpSize / (1024 * 1024 * 1024)).toFixed(2);
        const MAX_SIZE = 1.5 * 1024 * 1024 * 1024; // 1.5GB

        console.log(`💾 /tmp/ size: ${tmpSizeGB} GB`);

        if (tmpSize > MAX_SIZE) {
            console.log(`⚠️  /tmp/ exceeds 1.5GB, cleaning up oldest torrents...`);
            cleanupOldestTorrents();
        }
    } catch (err) {
        console.error('Error monitoring disk usage:', err.message);
    }
}

// Cleanup oldest torrents when disk is full
function cleanupOldestTorrents() {
    const sortedTorrents = Array.from(torrents.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let cleaned = 0;
    const MAX_TO_CLEAN = 3; // Clean up to 3 oldest torrents at a time

    for (let i = 0; i < Math.min(MAX_TO_CLEAN, sortedTorrents.length); i++) {
        const [id, torrent] = sortedTorrents[i];
        const idleTime = (Date.now() - torrent.lastAccessed) / 60000; // minutes

        // Only clean if idle for at least 5 minutes
        if (idleTime > 5) {
            console.log(`🧹 Removing oldest torrent: ${id} (idle ${idleTime.toFixed(1)}m)`);
            try {
                torrent.engine.destroy();
                torrents.delete(id);
                cleaned++;
            } catch (err) {
                console.error(`Error removing torrent ${id}:`, err.message);
            }
        }
    }

    if (cleaned > 0) {
        console.log(`✓ Cleaned up ${cleaned} oldest torrent(s)`);
    }
}

// Graceful shutdown handler
function cleanupAllTorrents() {
    console.log('🛑 Cleaning up all torrents...');
    for (const [id, torrent] of torrents.entries()) {
        try {
            torrent.engine.destroy();
        } catch (err) {
            console.error(`Error destroying torrent ${id}:`, err.message);
        }
    }
    torrents.clear();
    console.log('✓ All torrents cleaned up');
}

// Periodic garbage collection (every 5 minutes)
setInterval(cleanupInactiveTorrents, 5 * 60 * 1000);

// Periodic disk usage monitoring (every 10 minutes)
setInterval(monitorDiskUsage, 10 * 60 * 1000);

// Initial disk usage check
setTimeout(monitorDiskUsage, 30 * 1000); // After 30 seconds

// Graceful shutdown
process.on('SIGINT', () => {
    cleanupAllTorrents();
    process.exit(0);
});

process.on('SIGTERM', () => {
    cleanupAllTorrents();
    process.exit(0);
});

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
        // Helper function to determine file type
        const getFileType = (filename) => {
            if (/\.(mp4|mkv|avi|webm|mov|flv|wmv)$/i.test(filename)) return 'video';
            if (/\.(srt|vtt)$/i.test(filename)) return 'subtitle';
            return 'other';
        };

        // Helper function to extract language from subtitle filename
        const extractLanguage = (filename) => {
            const langPatterns = [
                { regex: /\.(en|eng|english)\./, lang: 'en', label: 'English' },
                { regex: /\.(es|spa|spanish)\./, lang: 'es', label: 'Spanish' },
                { regex: /\.(fr|fra|french)\./, lang: 'fr', label: 'French' },
                { regex: /\.(de|ger|german)\./, lang: 'de', label: 'German' },
                { regex: /\.(it|ita|italian)\./, lang: 'it', label: 'Italian' },
                { regex: /\.(pt|por|portuguese)\./, lang: 'pt', label: 'Portuguese' },
                { regex: /\.(ja|jpn|japanese)\./, lang: 'ja', label: 'Japanese' },
                { regex: /\.(zh|chi|chinese)\./, lang: 'zh', label: 'Chinese' },
                { regex: /\.(ko|kor|korean)\./, lang: 'ko', label: 'Korean' },
                { regex: /\.(ar|ara|arabic)\./, lang: 'ar', label: 'Arabic' },
                { regex: /\.(hi|hin|hindi)\./, lang: 'hi', label: 'Hindi' },
            ];

            for (const { regex, lang, label } of langPatterns) {
                if (regex.test(filename.toLowerCase())) {
                    return { code: lang, label };
                }
            }
            return { code: 'unknown', label: 'Unknown' };
        };

        // Helper function to get base name without extension
        const getBaseName = (filename) => {
            return filename.replace(/\.[^.]+$/, '').toLowerCase();
        };

        // Map files with type information
        const files = engine.files.map((file, index) => ({
            index,
            name: file.name,
            length: file.length,
            path: file.path,
            type: getFileType(file.name)
        }));

        // Find all video and subtitle files
        const videoFiles = files.filter(f => f.type === 'video');
        const subtitleFiles = files.filter(f => f.type === 'subtitle');

        // Auto-match subtitles to videos
        const filesWithSubtitles = files.map(file => {
            if (file.type !== 'video') return file;

            const videoBaseName = getBaseName(file.name);
            const matchedSubtitles = subtitleFiles
                .filter(sub => {
                    const subBaseName = getBaseName(sub.name);
                    // Match if base names are similar (ignoring language codes)
                    return subBaseName.includes(videoBaseName) || videoBaseName.includes(subBaseName);
                })
                .map(sub => {
                    const language = extractLanguage(sub.name);
                    return {
                        index: sub.index,
                        name: sub.name,
                        language: language.code,
                        label: language.label
                    };
                });

            return {
                ...file,
                subtitles: matchedSubtitles
            };
        });

        torrents.set(torrentId, {
            engine,
            files: filesWithSubtitles,
            lastAccessed: Date.now(),
            createdAt: Date.now()
        });

        res.json({
            id: torrentId,
            files: filesWithSubtitles,
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
    touchTorrent(id); // Update last accessed time
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
    touchTorrent(id); // Update last accessed time
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
    touchTorrent(id); // Update last accessed time
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

// Stream subtitle file
app.get('/api/torrent/:id/subtitle/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id); // Update last accessed time
    const torrent = torrents.get(id);

    if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrent.engine.files[parseInt(fileIndex)];
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type based on file extension
    const contentType = file.name.endsWith('.vtt') ? 'text/vtt' : 'text/srt';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', file.length);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const stream = file.createReadStream();
    pump(stream, res);
});

// Transcode and stream file (for formats not natively supported by browsers)
app.get('/api/torrent/:id/transcode/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id); // Update last accessed time
    const torrent = torrents.get(id);

    if (!torrent) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrent.engine.files[parseInt(fileIndex)];
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    console.log(`Starting transcode for: ${file.name}`);

    // Set headers for streaming MP4
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'none'); // Seeking not supported during transcoding

    // Create a read stream from the torrent file
    const inputStream = file.createReadStream();

    // Start FFmpeg transcoding
    const ffmpegCommand = ffmpeg(inputStream)
        .videoCodec('libx264')
        .audioCodec('aac')
        .audioBitrate('128k')
        .videoBitrate('2000k')
        .outputOptions([
            '-preset veryfast',
            '-crf 23',
            '-movflags frag_keyframe+empty_moov',
            '-map 0:v',      // Map video
            '-map 0:a?',     // Map all audio tracks (? makes it optional)
        ])
        .format('mp4')
        .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
        })
        .on('error', (err) => {
            console.error('FFmpeg error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Transcoding failed' });
            }
        })
        .on('end', () => {
            console.log('Transcoding finished');
        });

    // Pipe the transcoded output to the response
    ffmpegCommand.pipe(res, { end: true });

    // Handle client disconnect
    req.on('close', () => {
        console.log('Client disconnected, killing FFmpeg process');
        ffmpegCommand.kill('SIGKILL');
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
