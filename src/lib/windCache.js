/**
 * Shared Wind Cache with Aggressive Rate Limiting
 * - Cell-level cooldown: 2 minutes per cell
 * - Global rate limit: 500ms between ANY API call
 * - Instant rendering from cache (no blocking)
 * - Priority queue for visible cells
 */

const CONFIG = {
  GRID_RESOLUTION_DEG: 30,
  CELL_COOLDOWN_MS: 2 * 60 * 1000, // 2 minutes per cell
  GLOBAL_RATE_LIMIT_MS: 500, // 500ms between ANY fetch
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes
  MAX_CONCURRENT: 2, // Max 2 simultaneous fetches
  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
};

class SharedWindCache {
  constructor() {
    this.windCache = new Map(); // cellKey -> { u, v, speed, direction, ts }
    this.cellLastFetch = new Map(); // cellKey -> timestamp
    this.activeFetches = new Set(); // cellKeys currently being fetched
    this.lastGlobalFetch = 0; // Last fetch timestamp (global)
    this.fetchQueue = []; // Priority queue for cells
    this.stats = {
      windApiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      rateLimitBlocks: 0,
      cooldownBlocks: 0,
    };
  }

  /**
   * Get wind data from cache (instant, non-blocking)
   */
  getWind(cellKey) {
    const cached = this.windCache.get(cellKey);
    
    if (cached) {
      const age = Date.now() - cached.ts;
      if (age < CONFIG.CACHE_TTL_MS) {
        this.stats.cacheHits++;
        return cached;
      }
    }
    
    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Check if cell can be fetched (cooldown check)
   */
  canFetchCell(cellKey) {
    const lastFetch = this.cellLastFetch.get(cellKey);
    if (!lastFetch) return true;
    
    const elapsed = Date.now() - lastFetch;
    return elapsed >= CONFIG.CELL_COOLDOWN_MS;
  }

  /**
   * Check global rate limit
   */
  canFetchGlobal() {
    const elapsed = Date.now() - this.lastGlobalFetch;
    return elapsed >= CONFIG.GLOBAL_RATE_LIMIT_MS;
  }

  /**
   * Fetch wind data for a single cell (async, non-blocking)
   */
  async fetchWind(cellKey, bounds) {
    // Check if already fetching
    if (this.activeFetches.has(cellKey)) {
      return null;
    }

    // Check cell cooldown
    if (!this.canFetchCell(cellKey)) {
      this.stats.cooldownBlocks++;
      return this.windCache.get(cellKey) || null;
    }

    // Check global rate limit
    if (!this.canFetchGlobal()) {
      this.stats.rateLimitBlocks++;
      return this.windCache.get(cellKey) || null;
    }

    // Check concurrent limit
    if (this.activeFetches.size >= CONFIG.MAX_CONCURRENT) {
      this.stats.rateLimitBlocks++;
      return this.windCache.get(cellKey) || null;
    }

    this.activeFetches.add(cellKey);
    this.lastGlobalFetch = Date.now();
    this.cellLastFetch.set(cellKey, Date.now());

    try {
      const { centerLat, centerLon } = bounds;
      
      const url = `https://api.openweathermap.org/data/2.5/weather?` +
        `lat=${centerLat.toFixed(4)}&` +
        `lon=${centerLon.toFixed(4)}&` +
        `appid=${CONFIG.OPENWEATHER_API_KEY}&` +
        `units=metric`;

      const res = await fetch(url);
      
      if (!res.ok) {
        this.activeFetches.delete(cellKey);
        return null;
      }

      const data = await res.json();
      
      if (data?.wind) {
        const speed = data.wind.speed || 0;
        const direction = data.wind.deg || 0;
        
        // Convert to u/v components
        const dirRad = (270 - direction) * (Math.PI / 180);
        const u = speed * Math.cos(dirRad);
        const v = speed * Math.sin(dirRad);
        
        const windData = {
          cellKey,
          ...bounds,
          u,
          v,
          speed,
          direction,
          ts: Date.now(),
        };
        
        this.windCache.set(cellKey, windData);
        this.stats.windApiCalls++;
        
        console.log(`🌬️ Fetched ${cellKey}: ${speed.toFixed(1)}m/s @ ${direction}° (cache: ${this.windCache.size} cells)`);
        
        this.activeFetches.delete(cellKey);
        return windData;
      }
      
      this.activeFetches.delete(cellKey);
      return null;
      
    } catch (err) {
      console.error(`❌ Wind fetch failed for ${cellKey}:`, err.message);
      this.activeFetches.delete(cellKey);
      return null;
    }
  }

  /**
   * Batch fetch wind data (respects rate limits)
   */
  async batchFetchWind(cellKeys, boundsMap) {
    const cellsToFetch = cellKeys.filter(key => {
      // Skip if cached and fresh
      const cached = this.windCache.get(key);
      if (cached && (Date.now() - cached.ts < CONFIG.CACHE_TTL_MS)) {
        return false;
      }
      
      // Skip if on cooldown
      if (!this.canFetchCell(key)) {
        return false;
      }
      
      return true;
    });

    if (cellsToFetch.length === 0) {
      console.log(`✅ All ${cellKeys.length} cells cached or on cooldown`);
      return;
    }

    console.log(`🔄 Batch fetch: ${cellsToFetch.length}/${cellKeys.length} cells (${cellKeys.length - cellsToFetch.length} cached/cooldown)`);

    // Fetch cells with rate limiting
    for (let i = 0; i < cellsToFetch.length; i++) {
      const cellKey = cellsToFetch[i];
      const bounds = boundsMap.get(cellKey);
      
      if (!bounds) continue;

      // Wait for global rate limit
      while (!this.canFetchGlobal() || this.activeFetches.size >= CONFIG.MAX_CONCURRENT) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Fetch (non-blocking)
      this.fetchWind(cellKey, bounds);

      // Small delay between fetches
      if (i < cellsToFetch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.GLOBAL_RATE_LIMIT_MS));
      }
    }

    console.log(`✅ Batch complete: ${this.stats.windApiCalls} total API calls`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      windCacheSize: this.windCache.size,
      windApiCalls: this.stats.windApiCalls,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses + 1),
      rateLimitBlocks: this.stats.rateLimitBlocks,
      cooldownBlocks: this.stats.cooldownBlocks,
      activeFetches: this.activeFetches.size,
    };
  }

  /**
   * Clear expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, data] of this.windCache.entries()) {
      if (now - data.ts > CONFIG.CACHE_TTL_MS) {
        this.windCache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🧹 Cleaned ${removed} expired cache entries`);
    }
  }
}

// Helper functions
export const getGridCellKey = (lat, lon, resolution = CONFIG.GRID_RESOLUTION_DEG) => {
  const latCell = Math.floor(lat / resolution) * resolution;
  const lonCell = Math.floor(lon / resolution) * resolution;
  return `${latCell}_${lonCell}`;
};

export const getGridCellBounds = (cellKey, resolution = CONFIG.GRID_RESOLUTION_DEG) => {
  const [latStr, lonStr] = cellKey.split('_');
  const latMin = parseInt(latStr);
  const lonMin = parseInt(lonStr);
  
  return {
    latMin,
    latMax: latMin + resolution,
    lonMin,
    lonMax: lonMin + resolution,
    centerLat: latMin + resolution / 2,
    centerLon: lonMin + resolution / 2,
  };
};

// Singleton instance
export const sharedWindCache = new SharedWindCache();

// Auto-cleanup every 5 minutes
setInterval(() => {
  sharedWindCache.cleanCache();
}, 5 * 60 * 1000);
