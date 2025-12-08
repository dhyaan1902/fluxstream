import express from "express";
import cors from "cors";
import WebTorrent from 'webtorrent';
import pump from "pump";
import crypto from "crypto";
import fetch from "node-fetch";
import path from "path";
import axios from "axios";
import {  MOVIES  } from "@consumet/extensions";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from 'fs';
import natUpnp from 'nat-upnp';
// Import anime routes
import animeRouter from "./modules/anime/routes/anime.routes.js";

// Import database and cache services (still in original location)
// index.js (FIX)
import db from "./database.js";
const { watchHistory, metadataCache, preferences, downloadQueue, cacheStats, collections, library } = db;
import cacheService from "./modules/shared/services/cache.service.js";
import indexerService from "./modules/shared/services/indexer.service.js";
import stremioService from "./modules/shared/services/stremio.service.js";

// Subtitle service
import OpenSubtitlesService from "./services/opensubtitles.service.js";
const openSubtitlesService = new OpenSubtitlesService();

// Set FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;
// ============================================
// 1. BACKEND: index.js (Enhanced Torrent Endpoints)
// ============================================

// Replace WebTorrent client initialization with this:
const client = new WebTorrent({
    maxConns: 150,
    uploadLimit: -1,  // UNLIMITED (this is key!)
    downloadLimit: -1,
    dht: {
        bootstrap: [
            'router.bittorrent.com:6881',
            'router.utorrent.com:6881',
            'dht.transmissionbt.com:6881',
            'dht.aelitis.com:6881'
        ]
    },
    webSeeds: true,
    tracker: {
        wrtc: true,
        getAnnounceOpts: () => ({
            numwant: 80,
            uploaded: 0,
            downloaded: 0
        })
    }
});
// Enhanced global tracker list
const GLOBAL_TRACKERS = [
    // WebSocket trackers for WebRTC
    'wss://tracker.btorrent.xyz',
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.files.fm:7073/announce',
    
    // High-quality UDP trackers
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.moeking.me:6969/announce',
    'udp://explodie.org:6969/announce',
    'udp://tracker1.bt.moack.co.kr:80/announce',
    'udp://tracker.tiny-vps.com:6969/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
    'udp://9.rarbg.to:2710/announce',
    'udp://9.rarbg.me:2710/announce',
    'udp://tracker.leechers-paradise.org:6969/announce',
    'udp://tracker.internetwarriors.net:1337/announce',
    
    // HTTPS trackers
    'https://tracker.tamersunion.org:443/announce',
    'https://tracker.gbitt.info:443/announce',
    
    // HTTP trackers
    'http://tracker.openbittorrent.com:80/announce',
    'http://open.acgnxtracker.com:80/announce'
];



// Log stats every 30 seconds
setInterval(() => {
    const totalPeers = client.torrents.reduce((sum, t) => sum + t.numPeers, 0);
    const activeTorrents = client.torrents.filter(t => t.numPeers > 0).length;
    console.log(`📊 [WebTorrent] ${activeTorrents}/${client.torrents.length} torrents active | ${totalPeers} total peers connected`);
}, 30000);


app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Handle preflight OPTIONS requests
app.options('*', cors());

// Parse JSON bodies
app.use(express.json());


// Enhanced /api/torrent/add endpoint// Enhanced /api/torrent/add endpoint
app.post('/api/torrent/add', (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'Request body required' });
    }

    const { magnet } = req.body;

    if (!magnet) {
        return res.status(400).json({ error: 'Magnet link required' });
    }

    // Extract infoHash
    const infoHashMatch = magnet.match(/btih:([a-f0-9]{40})/i);
    const infoHash = infoHashMatch ? infoHashMatch[1].toLowerCase() : null;

    // Check for duplicates in our Map only
    if (infoHash) {
        for (const [id, data] of torrents.entries()) {
            if (data.torrent.infoHash === infoHash) {
                console.log(`♻️ [Torrent] Reusing: ${infoHash.substring(0, 8)}...`);
                touchTorrent(id);
                return res.json({
                    id,
                    files: data.files,
                    infoHash: data.torrent.infoHash,
                    magnetURI: data.torrent.magnetURI,
                    reused: true,
                    peers: data.torrent.numPeers
                });
            }
        }
    }

    const torrentId = Date.now().toString();
    let readyTimeout;
    let torrent;
    let peerDiscoveryTimeout;

    // Give 45 seconds for initial peer discovery
    readyTimeout = setTimeout(() => {
        console.error(`⏱️ [Torrent ${torrentId}] Timeout - no metadata received`);
        if (torrent) {
            torrent.destroy();
        }
        if (!res.headersSent) {
            res.status(504).json({ 
                error: 'Torrent connection timeout',
                suggestion: 'Try a different torrent source or check your connection'
            });
        }
    }, 45000);

    try {
        torrent = client.add(magnet, { 
            path: '/tmp/webtorrent',
            strategy: 'sequential',
            maxWebConns: 100,
            announce: GLOBAL_TRACKERS,
            private: false,
            destroyStoreOnDestroy: true
        });

        console.log(`🔄 [Torrent ${torrentId}] Added, discovering peers...`);

        // Track peer discovery
        let initialPeerCount = 0;
        peerDiscoveryTimeout = setInterval(() => {
            if (torrent.numPeers > initialPeerCount) {
                console.log(`🔗 [Torrent ${torrentId}] Found ${torrent.numPeers} peers`);
                initialPeerCount = torrent.numPeers;
            }
        }, 2000);

        torrent.on('ready', () => {
            clearTimeout(readyTimeout);
            clearInterval(peerDiscoveryTimeout);
            
            console.log(`✅ [Torrent ${torrentId}] Ready | ${torrent.files.length} files | ${torrent.numPeers} peers | ${(torrent.length / 1024 / 1024 / 1024).toFixed(2)} GB`);

            // File processing helpers
            const getFileType = (filename) => {
                if (/\.(mp4|mkv|avi|webm|mov|flv|wmv|m4v|3gp)$/i.test(filename)) return 'video';
                if (/\.(srt|vtt|ass|ssa|sub|idx)$/i.test(filename)) return 'subtitle';
                if (/\.(mp3|aac|flac|wav|ogg|m4a|wma)$/i.test(filename)) return 'audio';
                return 'other';
            };

            const extractLanguage = (filename) => {
                const patterns = [
                    { regex: /\b(en|eng|english)\b/i, code: 'en', label: 'English' },
                    { regex: /\b(es|spa|spanish|español)\b/i, code: 'es', label: 'Spanish' },
                    { regex: /\b(fr|fra|fre|french|français)\b/i, code: 'fr', label: 'French' },
                    { regex: /\b(de|ger|deu|german|deutsch)\b/i, code: 'de', label: 'German' },
                    { regex: /\b(it|ita|italian)\b/i, code: 'it', label: 'Italian' },
                    { regex: /\b(pt|por|portuguese)\b/i, code: 'pt', label: 'Portuguese' },
                    { regex: /\b(ja|jpn|japanese)\b/i, code: 'ja', label: 'Japanese' },
                    { regex: /\b(zh|chi|zho|chinese)\b/i, code: 'zh', label: 'Chinese' },
                    { regex: /\b(ko|kor|korean)\b/i, code: 'ko', label: 'Korean' },
                    { regex: /\b(ar|ara|arabic)\b/i, code: 'ar', label: 'Arabic' },
                    { regex: /\b(hi|hin|hindi)\b/i, code: 'hi', label: 'Hindi' },
                    { regex: /\b(ru|rus|russian)\b/i, code: 'ru', label: 'Russian' },
                ];

                for (const { regex, code, label } of patterns) {
                    if (regex.test(filename.toLowerCase())) {
                        return { code, label };
                    }
                }
                return { code: 'unknown', label: 'Unknown' };
            };

            const getBaseName = (filename) => {
                return filename.replace(/\.[^.]+$/, '').toLowerCase();
            };

            const arePathsRelated = (videoPath, subPath) => {
                const videoDir = path.dirname(videoPath);
                const subDir = path.dirname(subPath);
                if (videoDir === subDir) return true;
                if (subDir.startsWith(videoDir + path.sep)) {
                    const subFolderName = path.basename(subDir).toLowerCase();
                    return ['sub', 'subs', 'subtitle', 'subtitles', 'caption', 'captions', 'cc'].some(n => 
                        subFolderName.includes(n)
                    );
                }
                return false;
            };

            // Process files
            const files = torrent.files.map((file, index) => ({
                index,
                name: file.name,
                length: file.length,
                path: file.path,
                type: getFileType(file.name)
            }));

            const videoFiles = files.filter(f => f.type === 'video');
            const subtitleFiles = files.filter(f => f.type === 'subtitle');

            console.log(`📁 [Torrent ${torrentId}] ${videoFiles.length} videos, ${subtitleFiles.length} subtitles`);

            // Match subtitles to videos
            const filesWithSubtitles = files.map(file => {
                if (file.type !== 'video') return file;

                const videoFileName = path.basename(file.name);
                const videoBase = getBaseName(videoFileName);

                const matchedSubtitles = subtitleFiles
                    .filter(sub => {
                        const subFileName = path.basename(sub.name);
                        const subBase = getBaseName(subFileName);
                        const filenameSimilar = subBase.includes(videoBase) || 
                                               videoBase.includes(subBase) ||
                                               subBase.split(/[._-]/).some(part => 
                                                   videoBase.includes(part) && part.length > 3
                                               );
                        const pathRelated = arePathsRelated(file.path, sub.path);
                        return filenameSimilar || pathRelated;
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

                if (matchedSubtitles.length > 0) {
                    console.log(`  📝 ${file.name}: ${matchedSubtitles.length} subtitle(s) matched`);
                }

                return { ...file, subtitles: matchedSubtitles };
            });

            torrents.set(torrentId, {
                torrent,
                files: filesWithSubtitles,
                lastAccessed: Date.now(),
                createdAt: Date.now()
            });

            const largestFile = filesWithSubtitles.reduce((a, b) => a.length > b.length ? a : b);
            cacheStats.add(torrentId, largestFile.name, largestFile.length);

            if (!res.headersSent) {
                res.json({
                    id: torrentId,
                    files: filesWithSubtitles,
                    infoHash: torrent.infoHash,
                    magnetURI: torrent.magnetURI,
                    totalSize: torrent.length,
                    name: torrent.name,
                    peers: torrent.numPeers
                });
            }
        });

        // Enhanced event logging
        torrent.on('wire', (wire, addr) => {
            console.log(`🔗 [Torrent ${torrentId}] Peer: ${addr || 'WebRTC'}`);
        });

        let lastProgress = 0;
        torrent.on('download', () => {
            const currentProgress = Math.floor(torrent.progress * 100);
            if (currentProgress > lastProgress && currentProgress % 10 === 0) {
                console.log(`⬇️  [Torrent ${torrentId}] ${currentProgress}% | ${torrent.numPeers} peers | ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s`);
                lastProgress = currentProgress;
            }
        });

        torrent.on('error', (err) => {
            clearTimeout(readyTimeout);
            clearInterval(peerDiscoveryTimeout);
            console.error(`❌ [Torrent ${torrentId}]`, err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            }
        });

        torrent.on('warning', (err) => {
            console.warn(`⚠️  [Torrent ${torrentId}]`, err.message);
        });

    } catch (err) {
        clearTimeout(readyTimeout);
        clearInterval(peerDiscoveryTimeout);
        console.error('Failed to add torrent:', err);
        
        if (err.message && err.message.includes('duplicate torrent')) {
            const existing = Array.from(torrents.values()).find(t => 
                t.torrent && infoHash && t.torrent.infoHash === infoHash
            );
            
            if (existing) {
                const existingId = Array.from(torrents.entries())
                    .find(([_, data]) => data.torrent === existing.torrent)?.[0];
                    
                if (existingId) {
                    touchTorrent(existingId);
                    return res.json({
                        id: existingId,
                        files: existing.files,
                        infoHash: existing.torrent.infoHash,
                        magnetURI: existing.torrent.magnetURI,
                        reused: true,
                        peers: existing.torrent.numPeers
                    });
                }
            }
        }
        
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

// Using FlixHQ for Series/Movies
const flixhq = new MOVIES.FlixHQ();

// Store active torrents with metadata
const torrents = new Map(); // { id: { torrent, files, lastAccessed, createdAt } }

// In index.js, near the top, after app initialization
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});
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

    for (const [id, torrentData] of torrents.entries()) {
        if (now - torrentData.lastAccessed > THIRTY_MINUTES) {
            console.log(`🧹 Cleaning up inactive torrent: ${id}`);
            try {
                torrentData.torrent.destroy();
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
import { exec } from "child_process";
import util from "util";

const execPromise = util.promisify(exec);
const MAX_SIZE = 4 * 1024 * 1024 * 1024; // 4GB - Enhanced for local machine

// Fix 1: Corrected 'sync' to 'async'
async function monitorDiskUsage() {
    try {
        // Fix 2: Imports and utility setup moved to top-level scope

        // Get /tmp size (Linux/Mac)
        const { stdout } = await execPromise('du -sb /tmp 2>/dev/null | cut -f1').catch(() => ({ stdout: '0' }));
        const tmpSize = parseInt(stdout.trim() || '0');
        const tmpSizeGB = (tmpSize / MAX_SIZE).toFixed(2); // Using MAX_SIZE for calculation reference

        console.log(`💾 /tmp/ size: ${tmpSizeGB} GB`);

        if (tmpSize > MAX_SIZE) {
            console.log(`⚠️  /tmp/ exceeds 4GB, cleaning up oldest torrents...`);
            // Assuming cleanupOldestTorrents() is defined elsewhere
            cleanupOldestTorrents(); 
        }
    } catch (error) {
        console.error("Error monitoring disk usage:", error);
    }
}
// Cleanup oldest torrents when disk is full
function cleanupOldestTorrents() {
    const sortedTorrents = Array.from(torrents.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let cleaned = 0;
    const MAX_TO_CLEAN = 3; // Clean up to 3 oldest torrents at a time

    for (let i = 0; i < Math.min(MAX_TO_CLEAN, sortedTorrents.length); i++) {
        const [id, torrentData] = sortedTorrents[i];
        const idleTime = (Date.now() - torrentData.lastAccessed) / 60000; // minutes

        // Only clean if idle for at least 5 minutes
        if (idleTime > 5) {
            console.log(`🧹 Removing oldest torrent: ${id} (idle ${idleTime.toFixed(1)}m)`);
            try {
                torrentData.torrent.destroy();
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
    for (const [id, torrentData] of torrents.entries()) {
        try {
            torrentData.torrent.destroy();
        } catch (err) {
            console.error(`Error destroying torrent ${id}:`, err.message);
        }
    }
    torrents.clear();
    client.destroy(() => {
        console.log('✓ All torrents cleaned up');
    });
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
// Find this section (around line 542):
// app.use(cors());
// app.use(express.json());

// REPLACE WITH:

// Enhanced CORS configuration
// --- Anime Routes ---
app.use('/anime', animeRouter);

// --- Statistics & System Info ---
app.get('/api/stats', (req, res) => {
    const diskStats = cacheStats.getAll();
    const totalCacheSize = cacheStats.getTotalSize();
    const activeTorrents = torrents.size;
    const memoryStats = cacheService.getStats();

    res.json({
        cache: {
            totalSize: totalCacheSize,
            maxSize: 4 * 1024 * 1024 * 1024, // 4GB
            usagePercent: (totalCacheSize / (4 * 1024 * 1024 * 1024)) * 100,
            items: diskStats.length
        },
        torrents: {
            active: activeTorrents,
            total: diskStats.length
        },
        memory: memoryStats,
        uptime: process.uptime()
    });
});

// --- Watch History Routes ---
app.get('/api/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const history = watchHistory.getRecent(limit);
        res.json(history);
    } catch (error) {
        console.error('Failed to get watch history:', error);
        res.status(500).json({ error: 'Failed to get watch history' });
    }
});

app.post('/api/history', (req, res) => {
    try {
        const result = watchHistory.add(req.body);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Failed to add to watch history:', error);
        res.status(500).json({ error: 'Failed to add to watch history' });
    }
});

app.get('/api/history/:mediaId', (req, res) => {
    try {
        const { mediaId } = req.params;
        const { episodeId } = req.query;
        const item = watchHistory.getByMediaId(mediaId, episodeId);
        res.json(item || null);
    } catch (error) {
        console.error('Failed to get watch history item:', error);
        res.status(500).json({ error: 'Failed to get watch history item' });
    }
});

app.put('/api/history/:mediaId/position', (req, res) => {
    try {
        const { mediaId } = req.params;
        const { episodeId, position, duration } = req.body;
        watchHistory.updatePosition(mediaId, episodeId, position, duration);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to update playback position:', error);
        res.status(500).json({ error: 'Failed to update playback position' });
    }
});

app.delete('/api/history/:mediaId', (req, res) => {
    try {
        const { mediaId } = req.params;
        const { episodeId } = req.query;
        watchHistory.delete(mediaId, episodeId);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete watch history:', error);
        res.status(500).json({ error: 'Failed to delete watch history' });
    }
});

// --- Preferences Routes ---
app.get('/api/preferences', (req, res) => {
    try {
        const prefs = preferences.getAll();
        res.json(prefs);
    } catch (error) {
        console.error('Failed to get preferences:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

app.post('/api/preferences', (req, res) => {
    try {
        const { key, value } = req.body;
        preferences.set(key, value);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to set preference:', error);
        res.status(500).json({ error: 'Failed to set preference' });
    }
});

// --- Download Queue Routes ---
app.get('/api/downloads', (req, res) => {
    try {
        const downloads = downloadQueue.getAll();
        res.json(downloads);
    } catch (error) {
        console.error('Failed to get downloads:', error);
        res.status(500).json({ error: 'Failed to get downloads' });
    }
});

app.post('/api/downloads', (req, res) => {
    try {
        const result = downloadQueue.add(req.body);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Failed to add download:', error);
        res.status(500).json({ error: 'Failed to add download' });
    }
});

app.put('/api/downloads/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status, progress } = req.body;
        downloadQueue.updateStatus(parseInt(id), status, progress);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to update download:', error);
        res.status(500).json({ error: 'Failed to update download' });
    }
});

app.delete('/api/downloads/:id', (req, res) => {
    try {
        const { id } = req.params;
        downloadQueue.delete(parseInt(id));
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete download:', error);
        res.status(500).json({ error: 'Failed to delete download' });
    }
});

// --- Collections Routes ---
app.get('/api/collections', (req, res) => {
    try {
        const cols = collections.getAll();
        res.json(cols);
    } catch (error) {
        console.error('Failed to get collections:', error);
        res.status(500).json({ error: 'Failed to get collections' });
    }
});

app.post('/api/collections', (req, res) => {
    try {
        const { name, description } = req.body;
        const result = collections.create(name, description);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Failed to create collection:', error);
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

app.get('/api/collections/:id/items', (req, res) => {
    try {
        const { id } = req.params;
        const items = collections.getItems(parseInt(id));
        res.json(items);
    } catch (error) {
        console.error('Failed to get collection items:', error);
        res.status(500).json({ error: 'Failed to get collection items' });
    }
});

app.post('/api/collections/:id/items', (req, res) => {
    try {
        const { id } = req.params;
        const { mediaId, mediaType } = req.body;
        collections.addItem(parseInt(id), mediaId, mediaType);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to add to collection:', error);
        res.status(500).json({ error: 'Failed to add to collection' });
    }
});

app.delete('/api/collections/:id', (req, res) => {
    try {
        const { id } = req.params;
        collections.delete(parseInt(id));
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete collection:', error);
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

// ========================================
// LIBRARY ROUTES
// ========================================

// Get all library items
app.get('/api/library', (req, res) => {
    try {
        const items = library.getAll();
        res.json(items);
    } catch (error) {
        console.error('Failed to get library:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get library items by type
app.get('/api/library/type/:type', (req, res) => {
    try {
        const { type } = req.params;
        const items = library.getByType(type);
        res.json(items);
    } catch (error) {
        console.error('Failed to get library by type:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add item to library
app.post('/api/library', (req, res) => {
    try {
        const item = req.body;
        const result = library.add(item);
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Failed to add to library:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check if item exists in library
app.get('/api/library/check/:mediaId', (req, res) => {
    try {
        const { mediaId } = req.params;
        const exists = library.exists(mediaId);
        res.json({ exists });
    } catch (error) {
        console.error('Failed to check library:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove from library
app.delete('/api/library/:mediaId', (req, res) => {
    try {
        const { mediaId } = req.params;
        library.remove(mediaId);
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to remove from library:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get library stats
app.get('/api/library/stats', (req, res) => {
    try {
        const total = library.count();
        const movies = library.getByType('movie').length;
        const series = library.getByType('series').length;
        const anime = library.getByType('anime').length;
        res.json({ total, movies, series, anime });
    } catch (error) {
        console.error('Failed to get library stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Stremio Integration ---

app.get('/api/stremio/streams/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const { title, season, episode } = req.query;

        const streams = await stremioService.getStreams(
            type,
            id,
            title,
            season ? parseInt(season) : null,
            episode ? parseInt(episode) : null
        );

        res.json(streams);
    } catch (error) {
        console.error('Stremio stream error:', error);
        res.status(500).json({ error: 'Failed to fetch streams' });
    }
});

// --- Indexer Service Routes (Jackett/Prowlarr) ---
app.get('/api/indexer/status', async (req, res) => {
    try {
        const status = await indexerService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Failed to get indexer status:', error);
        res.status(500).json({ error: 'Failed to get indexer status' });
    }
});

app.get('/api/indexer/search', async (req, res) => {
    try {
        const { query, type } = req.query;
        let results = [];

        if (type === 'movie') {
            results = await indexerService.searchMovies(query);
        } else if (type === 'series') {
            results = await indexerService.searchSeries(query);
        } else if (type === 'anime') {
            results = await indexerService.searchAnime(query);
        } else {
            results = await indexerService.search(query);
        }

        res.json(results);
    } catch (error) {
        console.error('Indexer search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});


// --- Series Streaming ---
// Series now use the Torrentio addon system (same as movies/anime) via /api/stremio/streams
// Cloud embed providers (FlixHQ, Goku, etc.) were removed due to geo-blocking/timeouts
// Frontend uses fetchAddonStreams() which fetches from Stremio addons including Torrentio


// --- Torrent Routes ---

// Add magnet and get torrent ID

// Stream file with range support
app.get('/api/torrent/:id/stream/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id); // Update last accessed time
    cacheStats.touch(id); // Update database stats
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrentData.torrent.files[parseInt(fileIndex)];
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    const range = req.headers.range;
    const fileSize = file.length;

    // Determine content type based on file extension
    const getContentType = (filename) => {
        if (/\.mp4$/i.test(filename)) return 'video/mp4';
        if (/\.webm$/i.test(filename)) return 'video/webm';
        if (/\.mkv$/i.test(filename)) return 'video/x-matroska';
        if (/\.avi$/i.test(filename)) return 'video/x-msvideo';
        if (/\.mov$/i.test(filename)) return 'video/quicktime';
        return 'video/mp4'; // default
    };

    const contentType = getContentType(file.name);

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = file.createReadStream({ start, end });
        pump(stream, res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'
        });

        const stream = file.createReadStream();
        pump(stream, res);
    }
});

// Download file
app.get('/api/torrent/:id/download/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id); // Update last accessed time
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrentData.torrent.files[parseInt(fileIndex)];
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
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const torrent = torrentData.torrent;

    res.json({
        downloaded: torrent.downloaded,
        uploaded: torrent.uploaded,
        downloadSpeed: torrent.downloadSpeed,
        uploadSpeed: torrent.uploadSpeed,
        peers: torrent.numPeers,
        progress: torrent.progress,
        files: torrentData.files
    });
});

// Stream subtitle file
app.get('/api/torrent/:id/subtitle/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id); // Update last accessed time
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrentData.torrent.files[parseInt(fileIndex)];
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

//
// Get video metadata (duration, dimensions, codec)
app.get('/api/torrent/:id/metadata/:fileIndex', async (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id);
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrentData.torrent.files[parseInt(fileIndex)];
    if (!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        // Create a temporary file path for ffprobe
        const tempFilePath = path.join('/tmp', `metadata-${id}-${fileIndex}.tmp`);
        const writeStream = fs.createWriteStream(tempFilePath);

        // Stream first 10MB to temp file for metadata extraction
        const readStream = file.createReadStream({ start: 0, end: 1024 * 1024 * 10 });
        
        readStream.pipe(writeStream);

        writeStream.on('finish', () => {
            // Now use ffprobe on the temp file
            ffmpeg.ffprobe(tempFilePath, (err, metadata) => {
                // Clean up temp file
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) console.error('Failed to delete temp file:', unlinkErr);
                });

                if (err) {
                    console.error('FFprobe error:', err);
                    return res.status(500).json({ error: 'Failed to read metadata' });
                }

                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const audioStreams = metadata.streams.filter(s => s.codec_type === 'audio');

                res.json({
                    duration: parseFloat(metadata.format.duration) || 0,
                    size: parseInt(metadata.format.size) || file.length,
                    bitrate: parseInt(metadata.format.bit_rate) || 0,
                    width: videoStream?.width || 0,
                    height: videoStream?.height || 0,
                    codec: videoStream?.codec_name || 'unknown',
                    fps: videoStream?.r_frame_rate || '0',
                    audioTracks: audioStreams.length,
                    format: metadata.format.format_name || 'unknown'
                });
            });
        });

        writeStream.on('error', (error) => {
            console.error('Write stream error:', error);
            res.status(500).json({ error: 'Failed to extract metadata' });
        });

        readStream.on('error', (error) => {
            console.error('Read stream error:', error);
            writeStream.destroy();
            res.status(500).json({ error: 'Failed to read file' });
        });

    } catch (error) {
        console.error('Metadata extraction error:', error);
        res.status(500).json({ error: error.message });
    }
});
//
// Series metadata endpoint using OMDB API
app.get('/api/series/metadata/:imdbId', async (req, res) => {
    const { imdbId } = req.params;

    try {
        const OMDB_API_KEY = '80cc49c8';
        console.log(`[Series Metadata] Fetching for IMDB ID: ${imdbId}`);

        // Get basic series info
        const seriesResponse = await axios.get(`http://www.omdbapi.com/?i=${imdbId}&type=series&apikey=${OMDB_API_KEY}`);
        const seriesData = seriesResponse.data;

        if (seriesData.Response === 'False') {
            console.error(`[Series Metadata] OMDB returned error:`, seriesData.Error);
            return res.status(404).json({ error: seriesData.Error });
        }

        const totalSeasons = parseInt(seriesData.totalSeasons) || 1;
        console.log(`[Series Metadata] Total seasons: ${totalSeasons}`);

        // Fetch episode counts for each season
        const seasonData = [];
        const episodesPerSeason = {};

        for (let season = 1; season <= totalSeasons; season++) {
            try {
                const seasonResponse = await axios.get(
                    `http://www.omdbapi.com/?i=${imdbId}&Season=${season}&apikey=${OMDB_API_KEY}`,
                    { timeout: 5000 }
                );

                if (seasonResponse.data.Response !== 'False' && seasonResponse.data.Episodes) {
                    const episodeCount = seasonResponse.data.Episodes.length;
                    episodesPerSeason[season] = episodeCount;
                    seasonData.push(season);
                    console.log(`[Series Metadata] Season ${season}: ${episodeCount} episodes`);
                } else {
                    // Default fallback
                    episodesPerSeason[season] = 24;
                    seasonData.push(season);
                    console.warn(`[Series Metadata] Season ${season}: Using default 24 episodes`);
                }
            } catch (seasonError) {
                console.error(`[Series Metadata] Error fetching season ${season}:`, seasonError.message);
                episodesPerSeason[season] = 24;
                seasonData.push(season);
            }
        }
        res.json({
            seasons: seasonData,
            episodesPerSeason
        });

    } catch (error) {
        console.error('[Series Metadata] Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch series metadata' });
    }
});

// ========================================
// SUBTITLE ROUTES
// ========================================

// Get subtitles for movies (IMDB-based)
app.get('/api/subtitles/movie/:imdbId/:language?', async (req, res) => {
    const { imdbId, language = 'en' } = req.params;

    try {
        console.log(`[Subtitles] Movie request: ${imdbId}, lang: ${language}`);

        const vttContent = await openSubtitlesService.searchByImdb(imdbId, language);

        if (vttContent) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(vttContent);
        } else {
            res.status(404).json({ error: 'No subtitles found' });
        }
    } catch (error) {
        console.error('[Subtitles] Movie error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get subtitles for series
app.get('/api/subtitles/series/:imdbId/:season/:episode/:language?', async (req, res) => {
    const { imdbId, season, episode, language = 'en' } = req.params;

    try {
        console.log(`[Subtitles] Series: ${imdbId} S${season}E${episode}, lang: ${language}`);

        const vttContent = await openSubtitlesService.searchSeries(
            imdbId,
            parseInt(season),
            parseInt(episode),
            language
        );

        if (vttContent) {
            res.setHeader('Content-Type', 'text/vtt');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(vttContent);
        } else {
            res.status(404).json({ error: 'No subtitles found' });
        }
    } catch (error) {
        console.error('[Subtitles] Series error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get subtitles for torrents
app.get('/api/subtitles/torrent/:torrentId/:fileIndex', async (req, res) => {
    const { torrentId, fileIndex } = req.params;
    const { imdbId, language = 'en' } = req.query;

    try {
        console.log(`[Subtitles] Torrent: ${torrentId}, file: ${fileIndex}, imdbId: ${imdbId}`);

        if (imdbId) {
            const vttContent = await openSubtitlesService.searchByImdb(imdbId, language);

            if (vttContent) {
                res.setHeader('Content-Type', 'text/vtt');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.send(vttContent);
            } else {
                res.status(404).json({ error: 'No subtitles found' });
            }
        } else {
            res.status(400).json({ error: 'IMDB ID required for torrent subtitles' });
        }
    } catch (error) {
        console.error('[Subtitles] Torrent error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Transcode and stream file (for formats not natively supported by browsers)
app.get('/api/torrent/:id/transcode/:fileIndex', (req, res) => {
    const { id, fileIndex } = req.params;
    touchTorrent(id); // Update last accessed time
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    const file = torrentData.torrent.files[parseInt(fileIndex)];
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
    const torrentData = torrents.get(id);

    if (!torrentData) {
        return res.status(404).json({ error: 'Torrent not found' });
    }

    torrentData.torrent.destroy(() => {
        torrents.delete(id);
        res.json({ message: 'Torrent removed' });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Network access enabled on 0.0.0.0:${PORT}`);
});