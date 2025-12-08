import Database from "better-sqlite3";
import fs from "fs";


// 1. Add top-level imports for required modules
import os from 'os';
import path from 'path';

// ... other imports ...

// 2. Corrected logic for Line 6
const DB_DIR = process.env.DB_PATH || path.join(os.homedir(), '.fluxstream'); 
// ... rest of database.js





// Database path - store in user's home directory for persistence
const DB_PATH = path.join(DB_DIR, 'fluxstream.db');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better performance for concurrent access

// Initialize schema
function initializeSchema() {
    db.exec(`
        -- Watch History
        CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id TEXT NOT NULL,
            media_type TEXT NOT NULL,
            title TEXT NOT NULL,
            poster TEXT,
            last_watched INTEGER NOT NULL,
            playback_position REAL DEFAULT 0,
            duration REAL DEFAULT 0,
            episode_id TEXT,
            episode_number INTEGER,
            season_number INTEGER,
            completed BOOLEAN DEFAULT 0,
            UNIQUE(media_id, episode_id)
        );

        -- Metadata Cache
        CREATE TABLE IF NOT EXISTS metadata_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cache_key TEXT UNIQUE NOT NULL,
            cache_type TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );

        -- User Preferences
        CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- Download Queue
        CREATE TABLE IF NOT EXISTS download_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id TEXT NOT NULL,
            media_type TEXT NOT NULL,
            title TEXT NOT NULL,
            magnet TEXT NOT NULL,
            status TEXT DEFAULT 'queued',
            priority INTEGER DEFAULT 0,
            progress REAL DEFAULT 0,
            file_size INTEGER,
            download_path TEXT,
            created_at INTEGER NOT NULL,
            started_at INTEGER,
            completed_at INTEGER
        );

        -- Collections/Playlists
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collection_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL,
            media_id TEXT NOT NULL,
            media_type TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        );

        -- Cache Statistics
        CREATE TABLE IF NOT EXISTS cache_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            torrent_id TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            last_accessed INTEGER NOT NULL,
            access_count INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL
        );

        -- User Library (Personal Watchlist)
        CREATE TABLE IF NOT EXISTS library (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id TEXT NOT NULL UNIQUE,
            media_type TEXT NOT NULL,
            title TEXT NOT NULL,
            poster TEXT,
            year INTEGER,
            rating REAL,
            genres TEXT,
            description TEXT,
            imdb_id TEXT,
            added_at INTEGER NOT NULL
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_watch_history_media ON watch_history(media_id);
        CREATE INDEX IF NOT EXISTS idx_watch_history_last_watched ON watch_history(last_watched DESC);
        CREATE INDEX IF NOT EXISTS idx_metadata_cache_key ON metadata_cache(cache_key);
        CREATE INDEX IF NOT EXISTS idx_metadata_cache_expires ON metadata_cache(expires_at);
        CREATE INDEX IF NOT EXISTS idx_download_queue_status ON download_queue(status);
        CREATE INDEX IF NOT EXISTS idx_cache_stats_last_accessed ON cache_stats(last_accessed);
        CREATE INDEX IF NOT EXISTS idx_library_type ON library(media_type);
        CREATE INDEX IF NOT EXISTS idx_library_added ON library(added_at DESC);
    `);

    console.log('✓ Database schema initialized');
}

// Watch History Operations
const watchHistory = {
    add: (item) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO watch_history 
            (media_id, media_type, title, poster, last_watched, playback_position, duration, episode_id, episode_number, season_number, completed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            item.media_id,
            item.media_type,
            item.title,
            item.poster,
            Date.now(),
            item.playback_position || 0,
            item.duration || 0,
            item.episode_id || null,
            item.episode_number || null,
            item.season_number || null,
            item.completed || 0
        );
    },

    getRecent: (limit = 20) => {
        const stmt = db.prepare(`
            SELECT * FROM watch_history 
            WHERE completed = 0
            ORDER BY last_watched DESC 
            LIMIT ?
        `);
        return stmt.all(limit);
    },

    getByMediaId: (mediaId, episodeId = null) => {
        if (episodeId) {
            const stmt = db.prepare('SELECT * FROM watch_history WHERE media_id = ? AND episode_id = ?');
            return stmt.get(mediaId, episodeId);
        }
        const stmt = db.prepare('SELECT * FROM watch_history WHERE media_id = ?');
        return stmt.get(mediaId);
    },

    updatePosition: (mediaId, episodeId, position, duration) => {
        const completed = duration > 0 && position / duration > 0.9 ? 1 : 0;
        const stmt = db.prepare(`
            UPDATE watch_history 
            SET playback_position = ?, duration = ?, completed = ?, last_watched = ?
            WHERE media_id = ? AND (episode_id = ? OR episode_id IS NULL)
        `);
        return stmt.run(position, duration, completed, Date.now(), mediaId, episodeId);
    },

    delete: (mediaId, episodeId = null) => {
        if (episodeId) {
            const stmt = db.prepare('DELETE FROM watch_history WHERE media_id = ? AND episode_id = ?');
            return stmt.run(mediaId, episodeId);
        }
        const stmt = db.prepare('DELETE FROM watch_history WHERE media_id = ?');
        return stmt.run(mediaId);
    }
};

// Metadata Cache Operations
const metadataCache = {
    set: (key, type, data, ttlSeconds = 3600) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO metadata_cache (cache_key, cache_type, data, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        return stmt.run(key, type, JSON.stringify(data), now, now + (ttlSeconds * 1000));
    },

    get: (key) => {
        const stmt = db.prepare('SELECT * FROM metadata_cache WHERE cache_key = ? AND expires_at > ?');
        const result = stmt.get(key, Date.now());
        return result ? JSON.parse(result.data) : null;
    },

    delete: (key) => {
        const stmt = db.prepare('DELETE FROM metadata_cache WHERE cache_key = ?');
        return stmt.run(key);
    },

    cleanup: () => {
        const stmt = db.prepare('DELETE FROM metadata_cache WHERE expires_at < ?');
        return stmt.run(Date.now());
    }
};

// Preferences Operations
const preferences = {
    set: (key, value) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO preferences (key, value, updated_at)
            VALUES (?, ?, ?)
        `);
        return stmt.run(key, JSON.stringify(value), Date.now());
    },

    get: (key, defaultValue = null) => {
        const stmt = db.prepare('SELECT value FROM preferences WHERE key = ?');
        const result = stmt.get(key);
        return result ? JSON.parse(result.value) : defaultValue;
    },

    getAll: () => {
        const stmt = db.prepare('SELECT key, value FROM preferences');
        const results = stmt.all();
        return results.reduce((acc, row) => {
            acc[row.key] = JSON.parse(row.value);
            return acc;
        }, {});
    },

    delete: (key) => {
        const stmt = db.prepare('DELETE FROM preferences WHERE key = ?');
        return stmt.run(key);
    }
};

// Download Queue Operations
const downloadQueue = {
    add: (item) => {
        const stmt = db.prepare(`
            INSERT INTO download_queue (media_id, media_type, title, magnet, priority, file_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            item.media_id,
            item.media_type,
            item.title,
            item.magnet,
            item.priority || 0,
            item.file_size || null,
            Date.now()
        );
    },

    getAll: () => {
        const stmt = db.prepare('SELECT * FROM download_queue ORDER BY priority DESC, created_at ASC');
        return stmt.all();
    },

    getByStatus: (status) => {
        const stmt = db.prepare('SELECT * FROM download_queue WHERE status = ? ORDER BY priority DESC');
        return stmt.all(status);
    },

    updateStatus: (id, status, progress = null) => {
        const updates = { status };
        if (status === 'downloading' && !progress) {
            updates.started_at = Date.now();
        } else if (status === 'completed') {
            updates.completed_at = Date.now();
            updates.progress = 100;
        }

        let sql = 'UPDATE download_queue SET status = ?';
        const params = [status];

        if (progress !== null) {
            sql += ', progress = ?';
            params.push(progress);
        }
        if (updates.started_at) {
            sql += ', started_at = ?';
            params.push(updates.started_at);
        }
        if (updates.completed_at) {
            sql += ', completed_at = ?';
            params.push(updates.completed_at);
        }

        sql += ' WHERE id = ?';
        params.push(id);

        const stmt = db.prepare(sql);
        return stmt.run(...params);
    },

    delete: (id) => {
        const stmt = db.prepare('DELETE FROM download_queue WHERE id = ?');
        return stmt.run(id);
    }
};

// Cache Statistics Operations
const cacheStats = {
    add: (torrentId, fileName, fileSize) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO cache_stats (torrent_id, file_name, file_size, last_accessed, access_count, created_at)
            VALUES (?, ?, ?, ?, COALESCE((SELECT access_count + 1 FROM cache_stats WHERE torrent_id = ?), 1), ?)
        `);
        return stmt.run(torrentId, fileName, fileSize, Date.now(), torrentId, Date.now());
    },

    touch: (torrentId) => {
        const stmt = db.prepare(`
            UPDATE cache_stats 
            SET last_accessed = ?, access_count = access_count + 1
            WHERE torrent_id = ?
        `);
        return stmt.run(Date.now(), torrentId);
    },

    getAll: () => {
        const stmt = db.prepare('SELECT * FROM cache_stats ORDER BY last_accessed DESC');
        return stmt.all();
    },

    getTotalSize: () => {
        const stmt = db.prepare('SELECT SUM(file_size) as total FROM cache_stats');
        const result = stmt.get();
        return result.total || 0;
    },

    getOldest: (limit = 10) => {
        const stmt = db.prepare('SELECT * FROM cache_stats ORDER BY last_accessed ASC LIMIT ?');
        return stmt.all(limit);
    },

    delete: (torrentId) => {
        const stmt = db.prepare('DELETE FROM cache_stats WHERE torrent_id = ?');
        return stmt.run(torrentId);
    }
};

// Collections Operations
const collections = {
    create: (name, description = '') => {
        const stmt = db.prepare(`
            INSERT INTO collections (name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        `);
        const now = Date.now();
        return stmt.run(name, description, now, now);
    },

    getAll: () => {
        const stmt = db.prepare('SELECT * FROM collections ORDER BY updated_at DESC');
        return stmt.all();
    },

    addItem: (collectionId, mediaId, mediaType) => {
        const stmt = db.prepare(`
            INSERT INTO collection_items (collection_id, media_id, media_type, added_at)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(collectionId, mediaId, mediaType, Date.now());
    },

    getItems: (collectionId) => {
        const stmt = db.prepare('SELECT * FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC');
        return stmt.all(collectionId);
    },

    delete: (collectionId) => {
        const stmt = db.prepare('DELETE FROM collections WHERE id = ?');
        return stmt.run(collectionId);
    }
};

// Library Operations
const library = {
    add: (item) => {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO library 
            (media_id, media_type, title, poster, year, rating, genres, description, imdb_id, added_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            item.id,
            item.type,
            item.title,
            item.poster || null,
            item.year || null,
            item.rating || null,
            item.genres ? JSON.stringify(item.genres) : null,
            item.description || null,
            item.imdbId || null,
            Date.now()
        );
    },

    getAll: () => {
        const stmt = db.prepare('SELECT * FROM library ORDER BY added_at DESC');
        const results = stmt.all();
        return results.map(row => ({
            ...row,
            genres: row.genres ? JSON.parse(row.genres) : []
        }));
    },

    getByType: (type) => {
        const stmt = db.prepare('SELECT * FROM library WHERE media_type = ? ORDER BY added_at DESC');
        const results = stmt.all(type);
        return results.map(row => ({
            ...row,
            genres: row.genres ? JSON.parse(row.genres) : []
        }));
    },

    exists: (mediaId) => {
        const stmt = db.prepare('SELECT id FROM library WHERE media_id = ?');
        return stmt.get(mediaId) !== undefined;
    },

    remove: (mediaId) => {
        const stmt = db.prepare('DELETE FROM library WHERE media_id = ?');
        return stmt.run(mediaId);
    },

    count: () => {
        const stmt = db.prepare('SELECT COUNT(*) as total FROM library');
        return stmt.get().total;
    }
};

// Initialize schema on load
initializeSchema();

// Periodic cleanup of expired cache
setInterval(() => {
    const deleted = metadataCache.cleanup();
    if (deleted.changes > 0) {
        console.log(`🧹 Cleaned up ${deleted.changes} expired cache entries`);
    }
}, 60 * 60 * 1000); // Every hour

export default {
    db,
    watchHistory,
    metadataCache,
    preferences,
    downloadQueue,
    cacheStats,
    collections,
    library
};
