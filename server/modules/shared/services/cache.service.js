import NodeCache from "node-cache";

// In-memory cache for hot data (TTL: 5 minutes)
const memoryCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

class CacheService {
    constructor() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0
        };
    }

    /**
     * Get value from cache
     */
    get(key) {
        const value = memoryCache.get(key);
        if (value !== undefined) {
            this.stats.hits++;
            return value;
        }
        this.stats.misses++;
        return null;
    }

    /**
     * Set value in cache
     */
    set(key, value, ttl = 300) {
        this.stats.sets++;
        return memoryCache.set(key, value, ttl);
    }

    /**
     * Delete value from cache
     */
    delete(key) {
        return memoryCache.del(key);
    }

    /**
     * Clear all cache
     */
    clear() {
        return memoryCache.flushAll();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const keys = memoryCache.keys();
        return {
            ...this.stats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            totalKeys: keys.length,
            memoryUsage: process.memoryUsage()
        };
    }

    /**
     * Wrap async function with caching
     */
    async wrap(key, fn, ttl = 300) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const result = await fn();
        this.set(key, result, ttl);
        return result;
    }

    /**
     * Cache warming - preload popular content
     */
    async warmCache(items) {
        console.log(`🔥 Warming cache with ${items.length} items...`);
        for (const item of items) {
            if (item.key && item.fn) {
                try {
                    await this.wrap(item.key, item.fn, item.ttl || 300);
                } catch (err) {
                    console.error(`Failed to warm cache for ${item.key}:`, err.message);
                }
            }
        }
        console.log('✓ Cache warming complete');
    }
}

export default new CacheService();
