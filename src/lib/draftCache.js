/**
 * Lightweight in-memory TTL cache for draft-related data.
 *
 * On Vercel serverless, the cache lives as long as the warm container does
 * (typically a few minutes). This still helps enormously during draft sessions
 * where multiple clients poll /draft/state every 5 seconds.
 *
 * Usage:
 *   import { draftCache } from '@/lib/draftCache';
 *   const positions = await draftCache.getOrFetch('positions', fetchPositionsFn, 5 * 60 * 1000);
 */

class TTLCache {
    constructor() {
        this._store = new Map();
    }

    /**
     * Get a cached value if it exists and hasn't expired.
     * @param {string} key
     * @returns {*|null}
     */
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this._store.delete(key);
            return null;
        }
        return entry.value;
    }

    /**
     * Set a value with the given TTL in milliseconds.
     * @param {string} key
     * @param {*} value
     * @param {number} ttlMs - Time-to-live in milliseconds
     */
    set(key, value, ttlMs) {
        this._store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    /**
     * Get a cached value, or fetch it using the provided async function and cache it.
     * Prevents thundering-herd: if multiple callers request the same key while
     * the fetch is in progress, they all await the same promise.
     *
     * @param {string} key
     * @param {() => Promise<*>} fetchFn - Async function that returns the value to cache
     * @param {number} ttlMs - Time-to-live in milliseconds
     * @returns {Promise<*>}
     */
    async getOrFetch(key, fetchFn, ttlMs) {
        const cached = this.get(key);
        if (cached !== null) return cached;

        // Check for in-flight promise (thundering herd protection)
        const inflightKey = `__inflight__${key}`;
        const inflight = this._store.get(inflightKey);
        if (inflight) {
            return inflight.value;
        }

        // Start the fetch and store the promise
        const promise = fetchFn().then(value => {
            this.set(key, value, ttlMs);
            this._store.delete(inflightKey);
            return value;
        }).catch(err => {
            this._store.delete(inflightKey);
            throw err;
        });

        this._store.set(inflightKey, { value: promise, expiresAt: Date.now() + 30000 });
        return promise;
    }

    /**
     * Invalidate a specific key or all keys matching a prefix.
     * @param {string} keyOrPrefix
     */
    invalidate(keyOrPrefix) {
        if (this._store.has(keyOrPrefix)) {
            this._store.delete(keyOrPrefix);
            return;
        }
        // Prefix invalidation
        for (const key of this._store.keys()) {
            if (key.startsWith(keyOrPrefix)) {
                this._store.delete(key);
            }
        }
    }

    /**
     * Clear the entire cache.
     */
    clear() {
        this._store.clear();
    }

    /**
     * Get current cache size (for debugging).
     */
    get size() {
        return this._store.size;
    }
}

// Singleton instance — survives across requests in the same warm container
export const draftCache = new TTLCache();

// Pre-defined TTL constants (in milliseconds)
export const CACHE_TTL = {
    POSITIONS: 5 * 60 * 1000,       // 5 minutes — positions rarely change
    LEAGUE_SETTINGS: 60 * 1000,      // 1 minute — settings are fixed during draft
    PLAYER_STATUS: 5 * 60 * 1000,    // 5 minutes
    SCHEDULE: 2 * 60 * 1000,         // 2 minutes
    PLAYER_LIST: 2 * 60 * 1000,      // 2 minutes
};
