import React, { useEffect, useRef, useState } from 'react';
  import 'ol/ol.css';
  import OLMap from 'ol/Map.js';
  import View from 'ol/View.js';
  import TileLayer from 'ol/layer/Tile.js';
  import OSM from 'ol/source/OSM.js';
  import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';
  import { fromLonLat, toLonLat } from 'ol/proj.js';
  import NavBar from './components/navbar/navbar.jsx';
  import { clamp, lerp, kmhToMs, meteoToUV } from './lib/math.js';
  import { usePreferences } from './hooks/usePreferences.js';
  import { convertTemperature, getTemperatureSymbol } from './lib/math.js';
  import { sharedWindCache, getGridCellKey as getCellKey, getGridCellBounds as getCellBounds } from './lib/windCache.js';

  // CONFIG: Optimized for OpenWeather API with grid-based wind fetching
  const CONFIG = {
    // Grid Resolution (degrees) - Controls map division granularity
    GRID_RESOLUTION_DEG: 30, // 30° x 30° cells (12 x 6 = 72 cells globally)
    // Lower values = more cells, more API calls, higher accuracy
    // Higher values = fewer cells, fewer API calls, lower accuracy
    // Recommended: 15-45 degrees (20, 30, or 45)
    
    // Particles
    DENSITY_PER_PIXEL: 0.0008,
    COUNT_MIN: 800,
    COUNT_MAX: 2000,
    DOT_RADIUS_PX: 1.5, 
    COLOR: '#ffffff',
    SHADOW_COLOR: 'rgba(0,0,0,0.6)',
    SHADOW_BLUR: 2,

    // Lifetime/respawn
    LIFE_MIN_S: 15.0,
    LIFE_MAX_S: 25.0,
    VIEW_RESPAWN_PADDING_DEG: 1.0,

    // OpenWeather API settings (WIND ONLY)
    OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
    WIND_CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes for wind
    
    // Open-Meteo API settings (TEMPERATURE ONLY)
    TEMPERATURE_CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour for temperature (hourly data)
    
    // Animation
    MAX_DT_S: 0.05,
    TRAIL_FADE_ALPHA: 0.92,
    
    // Wind amplification
    WIND_SPEED_MULTIPLIER: 5000,
    
    // API Rate limiting
    MIN_FETCH_INTERVAL_MS: 1500,
    MAX_RETRIES: 2,
    RETRY_DELAY_MS: 3000,
    
    // Grid fetching
    MAX_CONCURRENT_FETCHES: 4, // Limit parallel API calls
    GRID_FETCH_BATCH_DELAY_MS: 500, // Delay between batches
  };

  /**
   * Generate grid cell key from lat/lon coordinates
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @returns {string} Grid cell key (e.g., "30_60" for lat 30-60, lon 60-90)
   */
  const getGridCellKey = (lat, lon) => {
    const resolution = CONFIG.GRID_RESOLUTION_DEG;
    const latCell = Math.floor(lat / resolution) * resolution;
    const lonCell = Math.floor(lon / resolution) * resolution;
    return `${latCell}_${lonCell}`;
  };

  /**
   * Get grid cell bounds from key
   * @param {string} key - Grid cell key (e.g., "30_60")
   * @returns {object} Cell bounds { latMin, latMax, lonMin, lonMax, centerLat, centerLon }
   */
  const getGridCellBounds = (key) => {
    const [latStr, lonStr] = key.split('_');
    const latMin = parseInt(latStr);
    const lonMin = parseInt(lonStr);
    const resolution = CONFIG.GRID_RESOLUTION_DEG;
    
    return {
      latMin,
      latMax: latMin + resolution,
      lonMin,
      lonMax: lonMin + resolution,
      centerLat: latMin + resolution / 2,
      centerLon: lonMin + resolution / 2,
    };
  };

  /**
   * Get all grid cells visible in current viewport
   * @param {object} bounds - Viewport bounds { latMin, latMax, lonMin, lonMax }
   * @returns {Array<string>} Array of grid cell keys
   */
  const getVisibleGridCells = (bounds) => {
    const resolution = CONFIG.GRID_RESOLUTION_DEG;
    const cells = new Set();
    
    // Clamp bounds to valid ranges
    const latMin = Math.max(-90, Math.min(bounds.latMin, bounds.latMax));
    const latMax = Math.min(90, Math.max(bounds.latMin, bounds.latMax));
    const lonMin = Math.max(-180, Math.min(bounds.lonMin, bounds.lonMax));
    const lonMax = Math.min(180, Math.max(bounds.lonMin, bounds.lonMax));
    
    // Iterate through all cells in viewport
    for (let lat = Math.floor(latMin / resolution) * resolution; lat < latMax; lat += resolution) {
      for (let lon = Math.floor(lonMin / resolution) * resolution; lon < lonMax; lon += resolution) {
        const key = getGridCellKey(lat, lon);
        cells.add(key);
      }
    }
    
    return Array.from(cells);
  };

  const LiveMap = () => {
    // State for layer toggles
    const [layers, setLayers] = useState({
      wind: false,
      temperature: false,
      precipitation: false,
      clouds: false,
    });

    // ADDED: Mouse position and hover temperature state
    const [mousePos, setMousePos] = useState(null);
    const [hoveredTemp, setHoveredTemp] = useState(null);

    const { preferences } = usePreferences();

    const mapRef = useRef(null);
    const canvasRef = useRef(null);

    const mapObjRef = useRef(null);
    const ctxRef = useRef(null);
    const rafRef = useRef(0);
    const particlesRef = useRef([]);
    const lastTimeRef = useRef(0);
    const dprRef = useRef(window.devicePixelRatio || 1);

    // Temperature overlay canvas
    const tempCanvasRef = useRef(null);
    const tempCtxRef = useRef(null);

    // Precipitation overlay canvas
    const precipCanvasRef = useRef(null);
    const precipCtxRef = useRef(null);

    // Clouds overlay canvas
    const cloudsCanvasRef = useRef(null);
    const cloudsCtxRef = useRef(null);

    // SEPARATE CACHES: Wind (OpenWeather) and Weather layers (Open-Meteo)
    const windGridCacheRef = useRef(new Map()); // Wind data only
    const temperatureGridCacheRef = useRef(new Map()); // Temperature data (hourly)
    const precipitationGridCacheRef = useRef(new Map()); // ADDED: Precipitation data (hourly)
    const cloudsGridCacheRef = useRef(new Map()); // ADDED: Cloud cover data (hourly)
    const activeFetchesRef = useRef(new Set());
    const activeTemperatureFetchesRef = useRef(new Set());
    const activePrecipitationFetchesRef = useRef(new Set()); // ADDED
    const activeCloudsFetchesRef = useRef(new Set()); // ADDED
    const lastZoomRef = useRef(null);

    // Rate limiting and concurrency control
    const lastFetchAttemptRef = useRef(0);
    const activeFetchCountRef = useRef(0);
    const lastViewportFetchRef = useRef(0);
    const windGridDataRef = useRef(null);
    const lastApiFetchRef = useRef(0);
    const apiCallCountRef = useRef(0);
    const retryCountRef = useRef(0);

    // ADDED: Track if wind rendering is active
    const isWindActiveRef = useRef(false);

    // Ensure refs are initialized before any code runs
    // Simplified defensive helpers
    const cacheOps = {
      has: (key) => ensureJSMap(windCacheRef).has(key),
      get: (key) => ensureJSMap(windCacheRef).get(key),
      set: (key, val) => ensureJSMap(windCacheRef).set(key, val),
      delete: (key) => ensureJSMap(windCacheRef).delete(key),
    };

    const inflightOps = {
      has: (key) => ensureJSSet(inflightRef).has(key),
      add: (key) => ensureJSSet(inflightRef).add(key),
      delete: (key) => ensureJSSet(inflightRef).delete(key),
    };

    // Utilities
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = mapRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const { clientWidth: w, clientHeight: h } = container;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = ctxRef.current;
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const getViewLonLatBounds = () => {
      const map = mapObjRef.current;
      if (!map) return { lonMin: -180, lonMax: 180, latMin: -85, latMax: 85 };
      const view = map.getView();
      const extent = view.calculateExtent(map.getSize());
      const minLonLat = toLonLat([extent[0], extent[1]]);
      const maxLonLat = toLonLat([extent[2], extent[3]]);
      const pad = CONFIG.VIEW_RESPAWN_PADDING_DEG;
      return {
        lonMin: Math.max(-180, Math.min(minLonLat[0], maxLonLat[0]) - pad),
        lonMax: Math.min(180, Math.max(minLonLat[0], maxLonLat[0]) + pad),
        latMin: Math.max(-85, Math.min(minLonLat[1], maxLonLat[1]) - pad),
        latMax: Math.min(85, Math.max(minLonLat[1], maxLonLat[1]) + pad),
      };
    };

    const computeTargetCount = () => {
      const map = mapObjRef.current;
      if (!map) return CONFIG.COUNT_MIN;
      const viewport = map.getViewport();
      const vw = viewport.clientWidth || 800;
      const vh = viewport.clientHeight || 600;
      const target = Math.round(vw * vh * CONFIG.DENSITY_PER_PIXEL);
      return clamp(target, CONFIG.COUNT_MIN, CONFIG.COUNT_MAX);
    };

    const respawnParticle = (p) => {
      const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
      p.lon = lerp(lonMin, lonMax, Math.random());
      p.lat = lerp(latMin, latMax, Math.random());
      p.age = 0;
      p.life = lerp(CONFIG.LIFE_MIN_S, CONFIG.LIFE_MAX_S, Math.random());
    };

    const initOrResizeParticles = () => {
      const particles = particlesRef.current;
      const target = computeTargetCount();
      if (particles.length === 0) {
        for (let i = 0; i < target; i++) {
          particles.push({ lon: 0, lat: 0, age: 0, life: 1 });
          respawnParticle(particles[i]);
        }
      } else if (particles.length < target) {
        const toAdd = target - particles.length;
        for (let i = 0; i < toAdd; i++) {
          const p = { lon: 0, lat: 0, age: 0, life: 1 };
          respawnParticle(p);
          particles.push(p);
        }
      } else if (particles.length > target) {
        particles.splice(target);
      }
    };

    /**
     * Detect if user zoomed out (scroll out)
     * Returns true if zoom level decreased
     */
    const detectScrollOut = (currentZoom, previousZoom) => {
      if (previousZoom === null || previousZoom === undefined) return false;
      const zoomDiff = currentZoom - previousZoom;
      console.log(`🔍 Zoom detection: prev=${previousZoom.toFixed(2)}, curr=${currentZoom.toFixed(2)}, diff=${zoomDiff.toFixed(2)}`);
      return zoomDiff < -0.01; // Threshold to avoid floating point errors
    };

    /**
     * Reset all particles immediately by expiring them
     * Forces them to respawn in new viewport bounds
     */
    const resetParticles = () => {
      const particles = particlesRef.current;
      if (!particles || particles.length === 0) return;
      
      console.log(`🔄 Resetting ${particles.length} particles`);
      
      // Immediately expire all particles
      particles.forEach((p) => {
        p.age = p.life; // Force expiration
      });
      
      // Adjust particle count for new zoom level
      initOrResizeParticles();
    };

    /**
     * FIXED: Get all world copies currently visible on screen
     * OpenLayers allows infinite horizontal scrolling (world wrapping)
     * We need to render overlays for each visible copy
     */
    const getVisibleWorldCopies = () => {
      const map = mapObjRef.current;
      if (!map) return [0];
      
      const view = map.getView();
      const extent = view.calculateExtent(map.getSize());
      
      const [minX, minY, maxX, maxY] = extent;
      const minLonLat = toLonLat([minX, minY]);
      const maxLonLat = toLonLat([maxX, maxY]);
      
      const minWorldCopy = Math.floor(minLonLat[0] / 360);
      const maxWorldCopy = Math.floor(maxLonLat[0] / 360);
      
      const worldCopies = [];
      for (let i = minWorldCopy; i <= maxWorldCopy; i++) {
        worldCopies.push(i);
      }
      
      return worldCopies.length > 0 ? worldCopies : [0];
    };

    /**
     * Get temperature color from value (Celsius)
     * Blue (cold) -> Cyan -> Green -> Yellow -> Orange -> Red (hot)
     */
    const getTemperatureColor = (tempC) => {
      if (tempC <= -30) return 'rgb(0, 0, 255)';
      if (tempC >= 50) return 'rgb(255, 0, 0)';
      
      const normalized = (tempC + 30) / 80;
      const clamped = Math.max(0, Math.min(1, normalized));
      
      const colors = [
        { pos: 0.0, r: 0, g: 0, b: 255 },
        { pos: 0.2, r: 0, g: 100, b: 255 },
        { pos: 0.35, r: 0, g: 200, b: 255 },
        { pos: 0.5, r: 0, g: 255, b: 100 },
        { pos: 0.65, r: 255, g: 255, b: 0 },
        { pos: 0.8, r: 255, g: 150, b: 0 },
        { pos: 1.0, r: 255, g: 0, b: 0 },
      ];
      
      let i = 0;
      while (i < colors.length - 1 && clamped > colors[i + 1].pos) {
        i++;
      }
      
      const c1 = colors[i];
      const c2 = colors[Math.min(i + 1, colors.length - 1)];
      const range = c2.pos - c1.pos || 1;
      const t = (clamped - c1.pos) / range;
      
      const r = Math.round(c1.r + (c2.r - c1.r) * t);
      const g = Math.round(c1.g + (c2.g - c1.g) * t);
      const b = Math.round(c1.b + (c2.b - c1.b) * t);
      
      return `rgb(${r}, ${g}, ${b})`;
    };

    /**
     * Get precipitation color from value (mm/hour)
     */
    const getPrecipitationColor = (precipMm) => {
      if (precipMm <= 0.1) return 'rgba(100, 150, 255, 0)';
      if (precipMm >= 20) return 'rgb(0, 0, 139)';
      
      const normalized = Math.min(precipMm / 20, 1);
      
      const colors = [
        { pos: 0.0, r: 100, g: 150, b: 255, a: 0.3 },
        { pos: 0.2, r: 70, g: 130, b: 255, a: 0.5 },
        { pos: 0.5, r: 30, g: 100, b: 220, a: 0.7 },
        { pos: 0.8, r: 10, g: 50, b: 180, a: 0.85 },
        { pos: 1.0, r: 0, g: 0, b: 139, a: 0.95 },
      ];
      
      let i = 0;
      while (i < colors.length - 1 && normalized > colors[i + 1].pos) {
        i++;
      }
      
      const c1 = colors[i];
      const c2 = colors[Math.min(i + 1, colors.length - 1)];
      const range = c2.pos - c1.pos || 1;
      const t = (normalized - c1.pos) / range;
      
      const r = Math.round(c1.r + (c2.r - c1.r) * t);
      const g = Math.round(c1.g + (c2.g - c1.g) * t);
      const b = Math.round(c1.b + (c2.b - c1.b) * t);
      const a = c1.a + (c2.a - c1.a) * t;
      
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    /**
     * Get cloud cover color from percentage (0-100%)
     */
    const getCloudsColor = (cloudPercent) => {
      if (cloudPercent <= 5) return 'rgba(255, 255, 255, 0)';
      if (cloudPercent >= 95) return 'rgba(200, 200, 200, 0.85)';
      
      const normalized = cloudPercent / 100;
      const alpha = 0.1 + (normalized * 0.75);
      const grayValue = Math.round(255 - (normalized * 55));
      
      return `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${alpha})`;
    };

    // NOW render functions can use the color functions
    const renderTemperatureOverlay = () => {
      if (!layers.temperature) {
        const canvas = tempCanvasRef.current;
        const ctx = tempCtxRef.current;
        if (canvas && ctx) {
          const dpr = dprRef.current;
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
        return;
      }
      
      const map = mapObjRef.current;
      const canvas = tempCanvasRef.current;
      const ctx = tempCtxRef.current;
      
      if (!map || !canvas || !ctx) return;
      
      const dpr = dprRef.current;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      
      ctx.clearRect(0, 0, width, height);
      
      const worldCopies = getVisibleWorldCopies();
      
      worldCopies.forEach((worldOffset) => {
        const lonOffset = worldOffset * 360;
        
        temperatureGridCacheRef.current.forEach((cellData) => {
          if (cellData.temp === undefined || cellData.temp === null) return;
          
          const { latMin, latMax, lonMin, lonMax, temp } = cellData;
          
          const offsetLonMin = lonMin + lonOffset;
          const offsetLonMax = lonMax + lonOffset;
          
          const topLeft = map.getPixelFromCoordinate(fromLonLat([offsetLonMin, latMax]));
          const bottomRight = map.getPixelFromCoordinate(fromLonLat([offsetLonMax, latMin]));
          
          if (!topLeft || !bottomRight) return;
          
          const x = topLeft[0];
          const y = topLeft[1];
          const w = bottomRight[0] - topLeft[0];
          const h = bottomRight[1] - topLeft[1];
          
          if (Math.abs(w) < 1 || Math.abs(h) < 1) return;
          
          const color = getTemperatureColor(temp);
          
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(x, y, w, h);
        });
      });
      
      ctx.globalAlpha = 1.0;
    };

    /**
     * FIXED: Render precipitation overlay with world wrapping support
     * MUST BE DEFINED BEFORE fetchGridCellPrecipitation
     */
    const renderPrecipitationOverlay = () => {
      if (!layers.precipitation) {
        const canvas = precipCanvasRef.current;
        const ctx = precipCtxRef.current;
        if (canvas && ctx) {
          const dpr = dprRef.current;
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
        return;
      }
      
      const map = mapObjRef.current;
      const canvas = precipCanvasRef.current;
      const ctx = precipCtxRef.current;
      
      if (!map || !canvas || !ctx) return;
      
      const dpr = dprRef.current;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      
      ctx.clearRect(0, 0, width, height);
      
      const worldCopies = getVisibleWorldCopies();
      
      worldCopies.forEach((worldOffset) => {
        const lonOffset = worldOffset * 360;
        
        precipitationGridCacheRef.current.forEach((cellData) => {
          if (cellData.precipitation === undefined || cellData.precipitation === null) return;
          
          const { latMin, latMax, lonMin, lonMax, precipitation } = cellData;
          
          const offsetLonMin = lonMin + lonOffset;
          const offsetLonMax = lonMax + lonOffset;
          
          const topLeft = map.getPixelFromCoordinate(fromLonLat([offsetLonMin, latMax]));
          const bottomRight = map.getPixelFromCoordinate(fromLonLat([offsetLonMax, latMin]));
          
          if (!topLeft || !bottomRight) return;
          
          const x = topLeft[0];
          const y = topLeft[1];
          const w = bottomRight[0] - topLeft[0];
          const h = bottomRight[1] - topLeft[1];
          
          if (Math.abs(w) < 1 || Math.abs(h) < 1) return;
          
          const color = getPrecipitationColor(precipitation);
          
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
        });
      });
    };

    /**
     * FIXED: Render clouds overlay with world wrapping support
     * MUST BE DEFINED BEFORE fetchGridCellClouds
     */
    const renderCloudsOverlay = () => {
      if (!layers.clouds) {
        const canvas = cloudsCanvasRef.current;
        const ctx = cloudsCtxRef.current;
        if (canvas && ctx) {
          const dpr = dprRef.current;
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
        return;
      }
      
      const map = mapObjRef.current;
      const canvas = cloudsCanvasRef.current;
      const ctx = cloudsCtxRef.current;
      
      if (!map || !canvas || !ctx) return;
      
      const dpr = dprRef.current;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      
      ctx.clearRect(0, 0, width, height);
      
      const worldCopies = getVisibleWorldCopies();
      
      worldCopies.forEach((worldOffset) => {
        const lonOffset = worldOffset * 360;
        
        cloudsGridCacheRef.current.forEach((cellData) => {
          if (cellData.cloudCover === undefined || cellData.cloudCover === null) return;
          
          const { latMin, latMax, lonMin, lonMax, cloudCover } = cellData;
          
          const offsetLonMin = lonMin + lonOffset;
          const offsetLonMax = lonMax + lonOffset;
          
          const topLeft = map.getPixelFromCoordinate(fromLonLat([offsetLonMin, latMax]));
          const bottomRight = map.getPixelFromCoordinate(fromLonLat([offsetLonMax, latMin]));
          
          if (!topLeft || !bottomRight) return;
          
          const x = topLeft[0];
          const y = topLeft[1];
          const w = bottomRight[0] - topLeft[0];
          const h = bottomRight[1] - topLeft[1];
          
          if (Math.abs(w) < 1 || Math.abs(h) < 1) return;
          
          const color = getCloudsColor(cloudCover);
          
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
        });
      });
    };

    // NOW fetch functions can safely call render functions
    // OPTIMIZED: Fetch wind data from OpenWeather with strict rate limiting
    const fetchWindDataOpenWeather = async () => {
      const now = Date.now();
      
      // STRICT rate limit: 1.5 seconds between ANY API call
      const timeSinceLastFetch = now - lastApiFetchRef.current;
      if (timeSinceLastFetch < CONFIG.MIN_FETCH_INTERVAL_MS) {
        console.log(`Rate limit: ${(CONFIG.MIN_FETCH_INTERVAL_MS - timeSinceLastFetch) / 1000}s cooldown remaining`);
        return windGridDataRef.current;
      }

      // Check if cached data is still valid
      if (windGridDataRef.current && (now - windGridDataRef.current.ts < CONFIG.WIND_CACHE_TTL_MS)) {
        const age = ((now - windGridDataRef.current.ts) / 1000 / 60).toFixed(1);
        console.log(`Using cached data (${age} min old)`);
        return windGridDataRef.current;
      }

      const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
      const centerLon = clamp((lonMin + lonMax) / 2, -180, 180);
      const centerLat = clamp((latMin + latMax) / 2, -85, 85);
      
      lastApiFetchRef.current = now;
      apiCallCountRef.current++;

      console.log(`[API Call #${apiCallCountRef.current}] Fetching wind for: ${centerLat.toFixed(2)}, ${centerLon.toFixed(2)}`);

      try {
        // OpenWeather Current Weather API
        const url = `https://api.openweathermap.org/data/2.5/weather?` +
          `lat=${centerLat.toFixed(4)}&` +
          `lon=${centerLon.toFixed(4)}&` +
          `appid=${CONFIG.OPENWEATHER_API_KEY}&` +
          `units=metric`;

        const res = await fetch(url);
        
        // Handle rate limiting
        if (res.status === 429) {
          console.error('⚠️ API rate limited! (429)');
          retryCountRef.current++;
          
          if (retryCountRef.current < CONFIG.MAX_RETRIES) {
            console.log(`Retrying in ${CONFIG.RETRY_DELAY_MS / 1000}s... (attempt ${retryCountRef.current}/${CONFIG.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
            return fetchWindDataOpenWeather(); // Retry
          }
          
          return windGridDataRef.current; // Return cached data
        }
        
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        
        const data = await res.json();
        
        // Extract wind data
        if (data?.wind) {
          const speedMs = data.wind.speed || 0; // Already in m/s
          const direction = data.wind.deg || 0; // Meteorological direction
          const gust = data.wind.gust || speedMs; // Gust speed if available
          
          console.log(`✅ Wind: ${speedMs.toFixed(1)} m/s at ${direction}° (gust: ${gust.toFixed(1)} m/s)`);
          
          // Convert to u/v components
          const { u, v } = meteoToUV(speedMs, direction);
          
          // Store comprehensive data
          windGridDataRef.current = {
            centerLon,
            centerLat,
            lonMin,
            lonMax,
            latMin,
            latMax,
            u,
            v,
            speed: speedMs,
            direction,
            gust,
            ts: now,
            // Additional weather data for potential future use
            temp: data.main?.temp,
            humidity: data.main?.humidity,
            pressure: data.main?.pressure,
            conditions: data.weather?.[0]?.main,
          };
          
          retryCountRef.current = 0; // Reset retry count on success
          
          console.log(`Cached: u=${u.toFixed(2)}, v=${v.toFixed(2)} m/s | Valid for ${CONFIG.CACHE_TTL_MS / 1000 / 60} min`);
          
          return windGridDataRef.current;
        } else {
          console.warn('No wind data in OpenWeather response');
          return windGridDataRef.current;
        }
      } catch (err) {
        console.error('Wind fetch failed:', err.message);
        return windGridDataRef.current; // Return cached data on error
      }
    };

    /**
     * Fetch temperature data for a grid cell from Open-Meteo (hourly data)
     */
    const fetchGridCellTemperature = async (cellKey) => {
      const now = Date.now();
      
      // Check cache first (1 hour TTL)
      const cached = temperatureGridCacheRef.current.get(cellKey);
      if (cached && (now - cached.ts < CONFIG.TEMPERATURE_CACHE_TTL_MS)) {
        return cached;
      }
      
      // Prevent duplicate fetches
      if (activeTemperatureFetchesRef.current.has(cellKey)) {
        return cached || null;
      }
      
      const bounds = getGridCellBounds(cellKey);
      const { centerLat, centerLon } = bounds;
      
      // Validate coordinates
      if (!isFinite(centerLat) || !isFinite(centerLon) ||
          centerLat < -90 || centerLat > 90 ||
          centerLon < -180 || centerLon > 180) {
        return cached || null;
      }
      
      activeTemperatureFetchesRef.current.add(cellKey);
      
      try {
        // Open-Meteo API (no API key needed, free hourly data)
        const url = `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${centerLat.toFixed(4)}&` +
          `longitude=${centerLon.toFixed(4)}&` +
          `hourly=temperature_2m&` +
          `forecast_days=1&` +
          `timezone=auto`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
          activeTemperatureFetchesRef.current.delete(cellKey);
          return cached || null;
        }
        
        const data = await res.json();
        
        if (data?.hourly?.temperature_2m && data.hourly.temperature_2m.length > 0) {
          // Get current hour's temperature (first value is current hour)
          const temp = data.hourly.temperature_2m[0];
          
          const cellData = {
            cellKey,
            ...bounds,
            temp,
            ts: now,
          };
          
          temperatureGridCacheRef.current.set(cellKey, cellData);
          
          console.log(`🌡️ ${cellKey}: ${temp}°C (Open-Meteo hourly, cached for 1h)`);
          
          activeTemperatureFetchesRef.current.delete(cellKey);
          
          // Trigger immediate render
          if (layers.temperature) {
            requestAnimationFrame(() => renderTemperatureOverlay());
          }
          
          return cellData;
        }
        
        activeTemperatureFetchesRef.current.delete(cellKey);
        return cached || null;
        
      } catch (err) {
        console.error(`❌ Temperature fetch failed for ${cellKey}:`, err.message);
        activeTemperatureFetchesRef.current.delete(cellKey);
        return cached || null;
      }
    };

    /**
     * Fetch precipitation data for a grid cell from Open-Meteo (hourly data)
     */
    const fetchGridCellPrecipitation = async (cellKey) => {
      const now = Date.now();
      
      const cached = precipitationGridCacheRef.current.get(cellKey);
      if (cached && (now - cached.ts < CONFIG.TEMPERATURE_CACHE_TTL_MS)) {
        return cached;
      }
      
      if (activePrecipitationFetchesRef.current.has(cellKey)) {
        return cached || null;
      }
      
      const bounds = getGridCellBounds(cellKey);
      const { centerLat, centerLon } = bounds;
      
      // Validate coordinates
      if (!isFinite(centerLat) || !isFinite(centerLon) ||
          centerLat < -90 || centerLat > 90 ||
          centerLon < -180 || centerLon > 180) {
        return cached || null;
      }
      
      activePrecipitationFetchesRef.current.add(cellKey);
      
      try {
        const url = `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${centerLat.toFixed(4)}&` +
          `longitude=${centerLon.toFixed(4)}&` +
          `hourly=precipitation,rain,showers,snowfall&` +
          `forecast_days=1&` +
          `timezone=auto`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
          activePrecipitationFetchesRef.current.delete(cellKey);
          return cached || null;
        }
        
        const data = await res.json();
        
        if (data?.hourly) {
          // Sum all precipitation types (current hour)
          const precipitation = (data.hourly.precipitation?.[0] || 0);
          const rain = (data.hourly.rain?.[0] || 0);
          const showers = (data.hourly.showers?.[0] || 0);
          const snow = (data.hourly.snowfall?.[0] || 0);
          const total = precipitation + rain + showers + snow;
          
          const cellData = {
            cellKey,
            ...bounds,
            precipitation: total,
            ts: now,
          };
          
          precipitationGridCacheRef.current.set(cellKey, cellData);
          
          console.log(`💧 ${cellKey}: ${total.toFixed(1)}mm (Open-Meteo hourly, cached for 1h)`);
          
          activePrecipitationFetchesRef.current.delete(cellKey);
          
          if (layers.precipitation) {
            requestAnimationFrame(() => renderPrecipitationOverlay());
          }
          
          return cellData;
        }
        
        activePrecipitationFetchesRef.current.delete(cellKey);
        return cached || null;
        
      } catch (err) {
        console.error(`❌ Precipitation fetch failed for ${cellKey}:`, err.message);
        activePrecipitationFetchesRef.current.delete(cellKey);
        return cached || null;
      }
    };

    /**
     * Fetch cloud cover data for a grid cell from Open-Meteo (hourly data)
     */
    const fetchGridCellClouds = async (cellKey) => {
      const now = Date.now();
      
      const cached = cloudsGridCacheRef.current.get(cellKey);
      if (cached && (now - cached.ts < CONFIG.TEMPERATURE_CACHE_TTL_MS)) {
        return cached;
      }
      
      if (activeCloudsFetchesRef.current.has(cellKey)) {
        return cached || null;
      }
      
      const bounds = getGridCellBounds(cellKey);
      const { centerLat, centerLon } = bounds;
      
      // Validate coordinates
      if (!isFinite(centerLat) || !isFinite(centerLon) ||
          centerLat < -90 || centerLat > 90 ||
          centerLon < -180 || centerLon > 180) {
        return cached || null;
      }
      
      activeCloudsFetchesRef.current.add(cellKey);
      
      try {
        const url = `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${centerLat.toFixed(4)}&` +
          `longitude=${centerLon.toFixed(4)}&` +
          `hourly=cloud_cover&` +
          `forecast_days=1&` +
          `timezone=auto`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
          activeCloudsFetchesRef.current.delete(cellKey);
          return cached || null;
        }
        
        const data = await res.json();
        
        if (data?.hourly?.cloud_cover && data.hourly.cloud_cover.length > 0) {
          const cloudCover = data.hourly.cloud_cover[0]; // 0-100%
          
          const cellData = {
            cellKey,
            ...bounds,
            cloudCover,
            ts: now,
          };
          
          cloudsGridCacheRef.current.set(cellKey, cellData);
          
          console.log(`☁️ ${cellKey}: ${cloudCover}% (Open-Meteo hourly, cached for 1h)`);
          
          activeCloudsFetchesRef.current.delete(cellKey);
          
          if (layers.clouds) {
            requestAnimationFrame(() => renderCloudsOverlay());
          }
          
          return cellData;
        }
        
        activeCloudsFetchesRef.current.delete(cellKey);
        return cached || null;
        
      } catch (err) {
        console.error(`❌ Clouds fetch failed for ${cellKey}:`, err.message);
        activeCloudsFetchesRef.current.delete(cellKey);
        return cached || null;
      }
    };

    /**
     * Fetch temperature for all visible cells
     */
    const fetchVisibleTemperatures = async () => {
      const bounds = getViewLonLatBounds();
      const visibleCells = getVisibleGridCells(bounds);
      
      const now = Date.now();
      const cellsToFetch = visibleCells.filter(cellKey => {
        const cached = temperatureGridCacheRef.current.get(cellKey);
        return !cached || (now - cached.ts > CONFIG.TEMPERATURE_CACHE_TTL_MS);
      });
      
      if (cellsToFetch.length === 0) {
        console.log('✅ All temperature cells cached');
        if (layers.temperature) {
          renderTemperatureOverlay();
        }
        return;
      }
      
      console.log(`🌡️ Fetching temperature for ${cellsToFetch.length} cells from Open-Meteo...`);
      
      // Fetch in batches (faster, no rate limit on Open-Meteo)
      const batchSize = 8; // Higher batch size since Open-Meteo is faster
      for (let i = 0; i < cellsToFetch.length; i += batchSize) {
        const batch = cellsToFetch.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(cellKey => fetchGridCellTemperature(cellKey)));
        
        if (i + batchSize < cellsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 200)); // Shorter delay
        }
      }
      
      console.log(`✅ Temperature cache: ${temperatureGridCacheRef.current.size} cells`);
    };

    /**
     * Fetch precipitation for all visible cells
     */
    const fetchVisiblePrecipitation = async () => {
      const bounds = getViewLonLatBounds();
      const visibleCells = getVisibleGridCells(bounds);
      
      const now = Date.now();
      const cellsToFetch = visibleCells.filter(cellKey => {
        const cached = precipitationGridCacheRef.current.get(cellKey);
        return !cached || (now - cached.ts > CONFIG.TEMPERATURE_CACHE_TTL_MS);
      });
      
      if (cellsToFetch.length === 0) {
        console.log('✅ All precipitation cells cached');
        if (layers.precipitation) {
          renderPrecipitationOverlay();
        }
        return;
      }
      
      console.log(`💧 Fetching precipitation for ${cellsToFetch.length} cells from Open-Meteo...`);
      
      const batchSize = 8;
      for (let i = 0; i < cellsToFetch.length; i += batchSize) {
        const batch = cellsToFetch.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(cellKey => fetchGridCellPrecipitation(cellKey)));
        
        if (i + batchSize < cellsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`✅ Precipitation cache: ${precipitationGridCacheRef.current.size} cells`);
    };

    /**
     * Fetch clouds for all visible cells
     */
    const fetchVisibleClouds = async () => {
      const bounds = getViewLonLatBounds();
      const visibleCells = getVisibleGridCells(bounds);
      
      const now = Date.now();
      const cellsToFetch = visibleCells.filter(cellKey => {
        const cached = cloudsGridCacheRef.current.get(cellKey);
        return !cached || (now - cached.ts > CONFIG.TEMPERATURE_CACHE_TTL_MS);
      });
      
      if (cellsToFetch.length === 0) {
        console.log('✅ All clouds cells cached');
        if (layers.clouds) {
          renderCloudsOverlay();
        }
        return;
      }
      
      console.log(`Fetching clouds for ${cellsToFetch.length} cells from Open-Meteo...`);
      
      const batchSize = 8;
      for (let i = 0; i < cellsToFetch.length; i += batchSize) {
        const batch = cellsToFetch.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(cellKey => fetchGridCellClouds(cellKey)));
        
        if (i + batchSize < cellsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`✅ Clouds cache: ${cloudsGridCacheRef.current.size} cells`);
    };

    /**
     * Pre-fetch visible cells (full map version)
     */
    const prefetchVisibleCells = async () => {
      const bounds = getViewLonLatBounds();
      const visibleCells = getVisibleGridCells(bounds);
      
      const boundsMap = new Map();
      visibleCells.forEach(key => {
        boundsMap.set(key, getCellBounds(key, CONFIG.GRID_RESOLUTION_DEG));
      });
      
      await sharedWindCache.batchFetchWind(visibleCells, boundsMap);
    };

    /**
     * Sample wind using shared cache (synchronous)
     */
    const sampleWindUV = (lon, lat) => {
      const cellKey = getCellKey(lat, lon, CONFIG.GRID_RESOLUTION_DEG);
      const cellData = sharedWindCache.getWind(cellKey);
      
      if (!cellData) {
        const bounds = getCellBounds(cellKey, CONFIG.GRID_RESOLUTION_DEG);
        sharedWindCache.fetchWind(cellKey, bounds);
        return { u: 0, v: 0 };
      }
      
      return {
        u: cellData.u * CONFIG.WIND_SPEED_MULTIPLIER,
        v: cellData.v * CONFIG.WIND_SPEED_MULTIPLIER,
      };
    };

    /**
     * Animation loop (now synchronous)
     */
    const animate = (ts) => {
      const map = mapObjRef.current;
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;

      if (!map || !ctx || !canvas) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      // Wind particle rendering (only if active)
      if (isWindActiveRef.current) {
        if (!lastTimeRef.current) lastTimeRef.current = ts;
        const dt = Math.min((ts - lastTimeRef.current) / 1000, CONFIG.MAX_DT_S);
        lastTimeRef.current = ts;

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0,0,0,${1 - CONFIG.TRAIL_FADE_ALPHA})`;
        ctx.fillRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
        ctx.globalCompositeOperation = 'source-over';

        const particles = particlesRef.current;
        const bounds = getViewLonLatBounds();

        ctx.shadowColor = CONFIG.SHADOW_COLOR;
        ctx.shadowBlur = CONFIG.SHADOW_BLUR;
        ctx.fillStyle = CONFIG.COLOR;

        let movedCount = 0;

        // FIXED: Process particles with async wind sampling
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];

          p.age += dt;
          if (p.age >= p.life) {
            respawnParticle(p);
            continue;
          }

          // FIXED: Synchronous wind sampling
          const { u, v } = sampleWindUV(p.lon, p.lat);
          
          if (u === 0 && v === 0) continue;
          
          movedCount++;
          
          const coord3857 = fromLonLat([p.lon, p.lat]);
          const newX = coord3857[0] + u * dt;
          const newY = coord3857[1] + v * dt;
          const newLonLat = toLonLat([newX, newY]);

          if (!isFinite(newLonLat[0]) || !isFinite(newLonLat[1])) {
            respawnParticle(p);
            continue;
          }

          const outOfBounds =
            newLonLat[0] < bounds.lonMin ||
            newLonLat[0] > bounds.lonMax ||
            newLonLat[1] < bounds.latMin ||
            newLonLat[1] > bounds.latMax;

          if (outOfBounds) {
            respawnParticle(p);
            continue;
          }

          p.lon = newLonLat[0];
          p.lat = newLonLat[1];

          const px = map.getPixelFromCoordinate([newX, newY]);
          if (!px) continue;

          ctx.beginPath();
          ctx.arc(px[0], px[1], CONFIG.DOT_RADIUS_PX, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;

        if (Math.floor(ts / 5000) !== Math.floor((ts - 16) / 5000)) {
          const stats = sharedWindCache.getStats();
          console.log(`🌬️ Full map: ${particles.length} particles | ${movedCount} moved | Cache: ${stats.windCacheSize} cells | API calls: ${stats.windApiCalls} | Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
        }
      }

      // Render all active weather overlays
      renderTemperatureOverlay();
      renderPrecipitationOverlay();
      renderCloudsOverlay();
      
      rafRef.current = requestAnimationFrame(animate);
    };

    // Ensure map and canvases are initialized before any code runs
    useEffect(() => {
      if (!mapRef.current) return;

      const map = new OLMap({
        target: mapRef.current,
        layers: [new TileLayer({ source: new OSM() })],
        view: new View({ center: [0, 0], zoom: 2 }),
        interactions: defaultInteractions().extend([
          new MouseWheelZoom({ delta: 7, duration: 250, constrainResolution: true }),
        ]),
      });
      mapObjRef.current = map;

      // Initialize lastZoomRef with the initial zoom level
      lastZoomRef.current = map.getView().getZoom();
      console.log(`🗺️ Initial zoom level: ${lastZoomRef.current.toFixed(2)}`);
      console.log(`📐 Grid resolution: ${CONFIG.GRID_RESOLUTION_DEG}° x ${CONFIG.GRID_RESOLUTION_DEG}°`);
      console.log(`📊 Global grid: ${360 / CONFIG.GRID_RESOLUTION_DEG} cells longitude × ${180 / CONFIG.GRID_RESOLUTION_DEG} cells latitude`);
      console.log(`📦 Total possible cells: ${(360 / CONFIG.GRID_RESOLUTION_DEG) * (180 / CONFIG.GRID_RESOLUTION_DEG)}`);

      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '15'; // Wind particles highest
      canvasRef.current = canvas;

      const viewport = map.getViewport();
      viewport.style.position = 'relative';
      viewport.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      ctxRef.current = ctx;

      // Create temperature overlay canvas
      const tempCanvas = document.createElement('canvas');
      tempCanvas.style.position = 'absolute';
      tempCanvas.style.left = '0';
      tempCanvas.style.top = '0';
      tempCanvas.style.pointerEvents = 'none';
      tempCanvas.style.zIndex = '12'; // Temperature overlay above map, below wind
      tempCanvasRef.current = tempCanvas;

      viewport.appendChild(tempCanvas);

      const tempCtx = tempCanvas.getContext('2d');
      tempCtxRef.current = tempCtx;

      // Create precipitation overlay canvas
      const precipCanvas = document.createElement('canvas');
      precipCanvas.style.position = 'absolute';
      precipCanvas.style.left = '0';
      precipCanvas.style.top = '0';
      precipCanvas.style.pointerEvents = 'none';
      precipCanvas.style.zIndex = '11'; // Below temperature
      precipCanvasRef.current = precipCanvas;

      viewport.appendChild(precipCanvas);

      const precipCtx = precipCanvas.getContext('2d');
      precipCtxRef.current = precipCtx;

      // Create clouds overlay canvas
      const cloudsCanvas = document.createElement('canvas');
      cloudsCanvas.style.position = 'absolute';
      cloudsCanvas.style.left = '0';
      cloudsCanvas.style.top = '0';
      cloudsCanvas.style.pointerEvents = 'none';
      cloudsCanvas.style.zIndex = '10'; // Lowest overlay
      cloudsCanvasRef.current = cloudsCanvas;

      viewport.appendChild(cloudsCanvas);

      const cloudsCtx = cloudsCanvas.getContext('2d');
      cloudsCtxRef.current = cloudsCtx;

      // FIXED: Resize function that properly handles both canvases
      const onResize = () => {
        // Resize wind canvas
        if (canvas && mapRef.current) {
          const dpr = window.devicePixelRatio || 1;
          dprRef.current = dpr;
          const { clientWidth: w, clientHeight: h } = mapRef.current;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          const ctx = ctxRef.current;
          if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        
        // Resize temperature canvas
        if (tempCanvas && mapRef.current) {
          const dpr = window.devicePixelRatio || 1;
          const { clientWidth: w, clientHeight: h } = mapRef.current;
          tempCanvas.style.width = `${w}px`;
          tempCanvas.style.height = `${h}px`;
          tempCanvas.width = Math.round(w * dpr);
          tempCanvas.height = Math.round(h * dpr);
          if (tempCtx) tempCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          
          console.log(`🔧 Temperature canvas resized: ${w}x${h}px (${tempCanvas.width}x${tempCanvas.height} physical)`);
        }
        
        // Resize precipitation canvas
        if (precipCanvas && mapRef.current) {
          const dpr = window.devicePixelRatio || 1;
          const { clientWidth: w, clientHeight: h } = mapRef.current;
          precipCanvas.style.width = `${w}px`;
          precipCanvas.style.height = `${h}px`;
          precipCanvas.width = Math.round(w * dpr);
          precipCanvas.height = Math.round(h * dpr);
          if (precipCtx) precipCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // Resize clouds canvas
        if (cloudsCanvas && mapRef.current) {
          const dpr = window.devicePixelRatio || 1;
          const { clientWidth: w, clientHeight: h } = mapRef.current;
          cloudsCanvas.style.width = `${w}px`;
          cloudsCanvas.style.height = `${h}px`;
          cloudsCanvas.width = Math.round(w * dpr);
          cloudsCanvas.height = Math.round(h * dpr);
          if (cloudsCtx) cloudsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        
        initOrResizeParticles();
        
        if (layers.temperature) {
          // Force re-render after resize
          setTimeout(() => renderTemperatureOverlay(), 100);
        }
        if (layers.precipitation) {
          setTimeout(() => renderPrecipitationOverlay(), 100);
        }
        if (layers.clouds) {
          setTimeout(() => renderCloudsOverlay(), 100);
        }
      };
      
      // CRITICAL: Initial resize must happen BEFORE any rendering
      onResize();
      
      window.addEventListener('resize', onResize);

      initOrResizeParticles();
      
      // Initial data check
      if (!CONFIG.OPENWEATHER_API_KEY || CONFIG.OPENWEATHER_API_KEY === 'demo') {
        console.error('OPENWEATHER_API_KEY not set! Add it to .env.local');
        console.log('Get your free API key at: https://openweathermap.org/api');
      }

      // Add mouse event listeners for temperature hover
      viewport.addEventListener('mousemove', handleMapMouseMove);
      viewport.addEventListener('mouseleave', handleMapMouseLeave);

      // Enhanced moveend handler
      let moveEndTimeout;
      const onMoveEnd = () => {
        clearTimeout(moveEndTimeout);
        
        const currentZoom = map.getView().getZoom();
        const previousZoom = lastZoomRef.current;
        
        const scrolledOut = detectScrollOut(currentZoom, previousZoom);
        
        if (scrolledOut) {
          console.log(`ZOOM OUT: ${previousZoom?.toFixed(2)} → ${currentZoom.toFixed(2)}`);
          resetParticles();
          lastZoomRef.current = currentZoom;
        } else if (previousZoom !== null && Math.abs(currentZoom - previousZoom) > 0.01) {
          console.log(`ZOOM IN: ${previousZoom?.toFixed(2)} → ${currentZoom.toFixed(2)}`);
          lastZoomRef.current = currentZoom;
        }
        
        moveEndTimeout = setTimeout(() => {
          if (!scrolledOut && previousZoom !== null && currentZoom !== previousZoom) {
            const ps = particlesRef.current;
            ps.forEach((p) => (p.age = p.life * 0.8));
          }
          
          if (layers.temperature) {
            console.log('🔄 Re-fetching and re-rendering temperature after move');
            fetchVisibleTemperatures().then(() => {
              renderTemperatureOverlay();
            });
          }
          if (layers.precipitation) {
            console.log('🔄 Re-fetching precipitation after move');
            fetchVisiblePrecipitation().then(() => {
              renderPrecipitationOverlay();
            });
          }
          if (layers.clouds) {
            console.log('🔄 Re-fetching clouds after move');
            fetchVisibleClouds().then(() => {
              renderCloudsOverlay();
            });
          }
          
          // Pre-fetch new viewport cells
          if (layers.wind || isWindActiveRef.current) {
            prefetchVisibleCells();
          }
        }, 2000);
      };
      
      map.on('moveend', onMoveEnd);

      const onResolutionChange = () => {
        const currentZoom = map.getView().getZoom();
        const previousZoom = lastZoomRef.current;
        
        if (previousZoom !== null && previousZoom !== undefined) {
          const scrolledOut = detectScrollOut(currentZoom, previousZoom);
          
          if (scrolledOut) {
            console.log(`⚡ INSTANT ZOOM OUT: ${previousZoom.toFixed(2)} → ${currentZoom.toFixed(2)}`);
            resetParticles();
            lastZoomRef.current = currentZoom;
          } else if (Math.abs(currentZoom - previousZoom) > 0.01) {
            lastZoomRef.current = currentZoom;
          }
        }
      };

      map.getView().on('change:resolution', onResolutionChange);

      // IMPORTANT: Start animation loop immediately
      rafRef.current = requestAnimationFrame(animate);

      // FIXED: Proper cleanup
      return () => {
        console.log(`📊 Session stats:`);
        console.log(`  - Total API calls: ${apiCallCountRef.current}`);
        console.log(`  - Cached cells: ${windGridCacheRef.current.size}`);
        console.log(`  - Cache contents:`);
        
        windGridCacheRef.current.forEach((cellData, cellKey) => {
          console.log(`    ${cellKey}: ${cellData.speed.toFixed(1)}m/s @ ${cellData.direction}° (${cellData.location || 'unknown'})`);
        });
        
        // Clear timeout
        if (moveEndTimeout) clearTimeout(moveEndTimeout);
        
        // Cancel animation
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        
        // Remove event listeners properly
        window.removeEventListener('resize', onResize);
        
        // ADDED: Remove mouse event listeners
        viewport.removeEventListener('mousemove', handleMapMouseMove);
        viewport.removeEventListener('mouseleave', handleMapMouseLeave);
        
        if (map) {
          map.un('moveend', onMoveEnd);
          
          // Only remove the resolution listener if the view still exists
          const view = map.getView();
          if (view) {
            view.un('change:resolution', onResolutionChange);
          }
        }
        
        // Clean up canvas
        if (canvas && canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        
        // Clean up temperature canvas
        if (tempCanvas && tempCanvas.parentElement) {
          tempCanvas.parentElement.removeChild(tempCanvas);
        }
        
        // Clean up precipitation canvas
        if (precipCanvas && precipCanvas.parentElement) {
          precipCanvas.parentElement.removeChild(precipCanvas);
        }

        // Clean up clouds canvas
        if (cloudsCanvas && cloudsCanvas.parentElement) {
          cloudsCanvas.parentElement.removeChild(cloudsCanvas);
        }
        
        // Dispose map
        if (map) {
          map.setTarget(null);
        }
        
        mapObjRef.current = null;
      };
    }, [layers.temperature, layers.precipitation, layers.clouds, preferences.temperature_unit]); // FIXED: Add dependencies

    // FIXED: Modified toggle handler with exclusive weather layer logic
    const handleLayerToggle = (layerName) => {
      setLayers(prev => {
        const newLayers = { ...prev };
        
        // Wind layer is independent
        if (layerName === 'wind') {
          newLayers.wind = !prev.wind;
          
          if (newLayers.wind) {
            startWindRendering();
          } else {
            stopWindRendering();
          }
        }
        
        // Weather layers (temperature, precipitation, clouds) are mutually exclusive
        // ADDED: Support for 'none' option to disable all weather overlays
        if (layerName === 'temperature' || layerName === 'precipitation' || layerName === 'clouds' || layerName === 'none') {
          // Turn off all weather layers first
          newLayers.temperature = false;
          newLayers.precipitation = false;
          newLayers.clouds = false;
          
          // If not selecting 'none', turn on the selected layer
          if (layerName !== 'none') {
            newLayers[layerName] = true;
          }
          
          // Handle temperature layer
          if (layerName === 'temperature') {
            console.log(`🌡️ Temperature layer toggled: ON`);
            
            fetchVisibleTemperatures().then(() => {
              renderTemperatureOverlay();
            });
          } else {
            // Clear temperature hover when switching away
            setMousePos(null);
            setHoveredTemp(null);
          }
          
          // Handle precipitation layer
          if (layerName === 'precipitation') {
            console.log(`💧 Precipitation layer toggled: ON`);
            
            fetchVisiblePrecipitation().then(() => {
              renderPrecipitationOverlay();
            });
          }
          
          // Handle clouds layer
          if (layerName === 'clouds') {
            console.log(`☁️ Clouds layer toggled: ON`);
            
            fetchVisibleClouds().then(() => {
              renderCloudsOverlay();
            });
          }
          
          // Handle 'none' - clear all overlays
          if (layerName === 'none') {
            console.log(`🚫 All weather overlays disabled`);
            // Clear all overlay canvases
            renderTemperatureOverlay(); // Will clear since layers.temperature is false
            renderPrecipitationOverlay();
            renderCloudsOverlay();
          }
        }
        
        return newLayers;
      });
    };

    /**
     * Handle mouse move to show temperature at cursor
     */
    const handleMapMouseMove = (e) => {
      if (!layers.temperature) {
        setMousePos(null);
        setHoveredTemp(null);
        return;
      }
      
      const map = mapObjRef.current;
      if (!map) return;
      
      // FIXED: Use map.getEventPixel and map.getCoordinateAtPixel correctly
      const pixel = map.getEventPixel(e.originalEvent || e);
      const coordinate = map.getCoordinateAtPixel(pixel);
      
      if (coordinate) {
        const [lon, lat] = toLonLat(coordinate);
        const cellKey = getGridCellKey(lat, lon);
        const tempData = temperatureGridCacheRef.current.get(cellKey);
        
        setMousePos({ x: e.clientX, y: e.clientY });
        
        if (tempData && tempData.temp !== undefined) {
          const displayTemp = convertTemperature(tempData.temp, preferences.temperature_unit);
          const symbol = getTemperatureSymbol(preferences.temperature_unit);
          setHoveredTemp(`${Math.round(displayTemp)}${symbol}`);
        } else {
          setHoveredTemp('Loading...');
        }
      }
    };

    const handleMapMouseLeave = () => {
      setMousePos(null);
      setHoveredTemp(null);
    };

    /**
     * Start wind particle rendering
     */
    const startWindRendering = () => {
      if (isWindActiveRef.current) {
        console.log('Wind rendering already active');
        return;
      }
      
      console.log('Starting wind rendering (full map)');
      isWindActiveRef.current = true;
      
      initOrResizeParticles();
      
      // Pre-fetch visible cells
      prefetchVisibleCells();
      
      if (!rafRef.current) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    /**
     * Stop wind particle rendering
     */
    const stopWindRendering = () => {
      if (!isWindActiveRef.current) {
        console.log('Wind rendering already stopped');
        return;
      }
      
      console.log('Stopping wind rendering');
      isWindActiveRef.current = false;
      
      particlesRef.current = [];
      
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
      }
    };

    return (
      <>
        <NavBar title="Live Weather Map" />
        
        <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
          <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Temperature Hover Tooltip */}
          {mousePos && hoveredTemp && layers.temperature && (
            <div style={{
              position: 'fixed',
              left: mousePos.x + 15,
              top: mousePos.y - 40,
              background: 'rgba(5, 57, 67, 0.95)',
              backdropFilter: 'blur(10px)',
              color: '#f4fff9',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              pointerEvents: 'none',
              zIndex: 10000,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(47, 231, 159, 0.3)',
            }}>
              {hoveredTemp}
            </div>
          )}
          
          {/* Layer Control Overlay */}
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(5, 57, 67, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            minWidth: '200px',
            zIndex: 1000,
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#61ffd0',
              borderBottom: '2px solid #2fe79f',
              paddingBottom: '8px',
            }}>
              Layers
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Wind Layer (Independent checkbox) */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#f4fff9',
                fontSize: '0.95rem',
              }}>
                <input
                  type="checkbox"
                  checked={layers.wind}
                  onChange={() => handleLayerToggle('wind')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#2fe79f',
                  }}
                />
                <span>Wind</span>
              </label>

              {/* Divider */}
              <div style={{
                height: '1px',
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '4px 0',
              }}></div>

              {/* Weather Layers Section */}
              <div style={{
                fontSize: '0.75rem',
                color: '#c9f5e8',
                marginBottom: '4px',
                fontStyle: 'italic',
              }}>
                Weather Overlay (select one):
              </div>

              {/* ADDED: None option to disable all weather overlays */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#f4fff9',
                fontSize: '0.95rem',
              }}>
                <input
                  type="radio"
                  name="weather-layer"
                  checked={!layers.temperature && !layers.precipitation && !layers.clouds}
                  onChange={() => handleLayerToggle('none')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#2fe79f',
                  }}
                />
                <span>None</span>
              </label>

              {/* Temperature Layer (Radio-like behavior) */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#f4fff9',
                fontSize: '0.95rem',
              }}>
                <input
                  type="radio"
                  name="weather-layer"
                  checked={layers.temperature}
                  onChange={() => handleLayerToggle('temperature')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#2fe79f',
                  }}
                />
                <span>Temperature</span>
              </label>

              {/* Precipitation Layer (Radio-like behavior) */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#f4fff9',
                fontSize: '0.95rem',
              }}>
                <input
                  type="radio"
                  name="weather-layer"
                  checked={layers.precipitation}
                  onChange={() => handleLayerToggle('precipitation')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#2fe79f',
                  }}
                />
                <span>Precipitation</span>
              </label>

              {/* Clouds Layer (Radio-like behavior) */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                color: '#f4fff9',
                fontSize: '0.95rem',
              }}>
                <input
                  type="radio"
                  name="weather-layer"
                  checked={layers.clouds}
                  onChange={() => handleLayerToggle('clouds')}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#2fe79f',
                  }}
                />
                <span>Clouds</span>
              </label>
            </div>

            {/* Grid Info - UPDATED */}
            <div style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.75rem',
              color: '#c9f5e8',
            }}>
              <div>Grid: {CONFIG.GRID_RESOLUTION_DEG}° × {CONFIG.GRID_RESOLUTION_DEG}°</div>
              <div>Wind cache: {windGridCacheRef.current.size} cells</div>
              <div>Temp cache: {temperatureGridCacheRef.current.size} cells</div>
              <div>Precip cache: {precipitationGridCacheRef.current.size} cells</div>
              <div>Clouds cache: {cloudsGridCacheRef.current.size} cells</div>
              <div>Active: {Object.values(layers).filter(Boolean).length} layers</div>
              <div>API calls: {apiCallCountRef.current}</div>
            </div>
          </div>

          {/* Temperature Scale Legend - UPDATED note */}
          {layers.temperature && (
            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              background: 'rgba(5, 57, 67, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              zIndex: 1000,
            }}>
              <h4 style={{
                margin: '0 0 12px 0',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#61ffd0',
              }}>
                Temperature Scale
              </h4>
              
              {/* Gradient Bar */}
              <div style={{
                width: '200px',
                height: '20px',
                background: 'linear-gradient(to right, rgb(0,0,255), rgb(0,100,255), rgb(0,200,255), rgb(0,255,100), rgb(255,255,0), rgb(255,150,0), rgb(255,0,0))',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.3)',
              }}></div>
              
              {/* Temperature Labels */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '0.75rem',
                color: '#f4fff9',
              }}>
                <span>{Math.round(convertTemperature(-30, preferences.temperature_unit))}{getTemperatureSymbol(preferences.temperature_unit)}</span>
                <span>{Math.round(convertTemperature(10, preferences.temperature_unit))}{getTemperatureSymbol(preferences.temperature_unit)}</span>
                <span>{Math.round(convertTemperature(50, preferences.temperature_unit))}{getTemperatureSymbol(preferences.temperature_unit)}</span>
              </div>
              
              <div style={{
                marginTop: '8px',
                fontSize: '0.7rem',
                color: '#c9f5e8',
                fontStyle: 'italic',
              }}>
                Hover map for temperature
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  export default LiveMap;