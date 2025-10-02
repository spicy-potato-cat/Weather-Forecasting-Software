import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import OLMap from 'ol/Map.js'; // Rename to avoid collision with JavaScript Map
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';

import { clamp, lerp, kmhToMs, meteoToUV } from './lib/math.js';

// CONFIG: Optimized for OpenWeather API
const CONFIG = {
  // Particles
  DENSITY_PER_PIXEL: 0.0005,
  COUNT_MIN: 500,
  COUNT_MAX: 2000,
  DOT_RADIUS_PX: 1.5,
  COLOR: '#ffffff',
  SHADOW_COLOR: 'rgba(0,0,0,0.4)',
  SHADOW_BLUR: 1,

  // Lifetime/respawn
  LIFE_MIN_S: 4.0,
  LIFE_MAX_S: 8.0,
  VIEW_RESPAWN_PADDING_DEG: 1.0,

  // OpenWeather API settings
  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes (data doesn't change that fast)
  
  // Animation
  MAX_DT_S: 0.05,
  TRAIL_FADE_ALPHA: 0.95,
  
  // API Rate limiting - STRICT for free tier (60/min = 1/sec)
  MIN_FETCH_INTERVAL_MS: 1500, // 1.5 seconds between ANY fetch (safety margin)
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 3000,
};

// Helper functions OUTSIDE component - FIXED to use proper Map reference
const ensureJSMap = (ref) => {
  // Use globalThis.Map to explicitly reference JavaScript's Map, not OpenLayers Map
  if (!ref.current || !(ref.current instanceof globalThis.Map)) {
    ref.current = new globalThis.Map();
  }
  return ref.current;
};

const ensureJSSet = (ref) => {
  if (!ref.current || !(ref.current instanceof globalThis.Set)) {
    ref.current = new globalThis.Set();
  }
  return ref.current;
};

const LiveMap = () => {
  const mapRef = useRef(null);
  const canvasRef = useRef(null);

  const mapObjRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);
  const dprRef = useRef(window.devicePixelRatio || 1);

  // Wind data cache and inflight trackers - Initialize immediately
  const windCacheRef = useRef(null);
  const inflightRef = useRef(null);
  const lastZoomRef = useRef(null);

  // Rate limiting and concurrency control
  const lastFetchAttemptRef = useRef(0);
  const activeFetchCountRef = useRef(0);
  const lastViewportFetchRef = useRef(0);
  const windGridDataRef = useRef(null);
  const lastApiFetchRef = useRef(0);
  const apiCallCountRef = useRef(0);
  const retryCountRef = useRef(0);

  // Ensure refs are initialized before any code runs
  ensureJSMap(windCacheRef);
  ensureJSSet(inflightRef);

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
    if (windGridDataRef.current && (now - windGridDataRef.current.ts < CONFIG.CACHE_TTL_MS)) {
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
      console.error('❌ Wind fetch failed:', err.message);
      return windGridDataRef.current; // Return cached data on error
    }
  };

  // SIMPLIFIED: Sample wind from cached grid
  const sampleWindUV = (lon, lat) => {
    const grid = windGridDataRef.current;
    
    if (!grid) {
      return { u: 0, v: 0 };
    }
    
    // Check if data is stale
    if (Date.now() - grid.ts > CONFIG.CACHE_TTL_MS) {
      return { u: 0, v: 0 };
    }
    
    // Check if position is within cached bounds (with large tolerance for single-point data)
    const tolerance = 50; // degrees (very generous for single-point weather)
    if (lon < grid.lonMin - tolerance || lon > grid.lonMax + tolerance ||
        lat < grid.latMin - tolerance || lat > grid.latMax + tolerance) {
      return { u: 0, v: 0 };
    }
    
    // Return uniform wind (single measurement point covers viewport)
    return { u: grid.u, v: grid.v };
  };

  // OPTIMIZED: Animation loop
  const animate = (ts) => {
    const map = mapObjRef.current;
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (!map || !ctx || !canvas) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = Math.min((ts - lastTimeRef.current) / 1000, CONFIG.MAX_DT_S);
    lastTimeRef.current = ts;

    // Fade canvas for trails
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${1 - CONFIG.TRAIL_FADE_ALPHA})`;
    ctx.fillRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    ctx.globalCompositeOperation = 'source-over';

    const particles = particlesRef.current;
    const bounds = getViewLonLatBounds();

    // Batch drawing
    ctx.shadowColor = CONFIG.SHADOW_COLOR;
    ctx.shadowBlur = CONFIG.SHADOW_BLUR;
    ctx.fillStyle = CONFIG.COLOR;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      p.age += dt;
      if (p.age >= p.life) {
        respawnParticle(p);
        continue;
      }

      // Sample wind - this now actually returns proper u/v values
      const { u, v } = sampleWindUV(p.lon, p.lat);
      
      // Advect particle in world space
      const coord3857 = fromLonLat([p.lon, p.lat]);
      const mx = coord3857[0] + u * dt;
      const my = coord3857[1] + v * dt;
      const newLonLat = toLonLat([mx, my]);

      // Bounds check
      const outOfBounds =
        !isFinite(newLonLat[0]) ||
        !isFinite(newLonLat[1]) ||
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

      // Convert to screen pixels
      const px = map.getPixelFromCoordinate([mx, my]);
      if (!px) continue;

      // Draw particle
      ctx.beginPath();
      ctx.arc(px[0], px[1], CONFIG.DOT_RADIUS_PX, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    rafRef.current = requestAnimationFrame(animate);
  };

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

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    canvasRef.current = canvas;

    const viewport = map.getViewport();
    viewport.style.position = 'relative';
    viewport.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    const onResize = () => {
      resizeCanvas();
      initOrResizeParticles();
      fetchWindDataOpenWeather(); // Use OpenWeather
    };
    
    resizeCanvas();
    window.addEventListener('resize', onResize);

    initOrResizeParticles();
    
    // Initial fetch with proper API key check
    if (!CONFIG.OPENWEATHER_API_KEY || CONFIG.OPENWEATHER_API_KEY === 'demo') {
      console.error('⚠️ OPENWEATHER_API_KEY not set! Add it to .env.local');
      console.log('Get your free API key at: https://openweathermap.org/api');
    } else {
      fetchWindDataOpenWeather();
    }

    // Aggressive debounce for moveend (2 seconds)
    let moveEndTimeout;
    const onMoveEnd = () => {
      clearTimeout(moveEndTimeout);
      moveEndTimeout = setTimeout(() => {
        const z = map.getView().getZoom();
        if (lastZoomRef.current !== null && z !== lastZoomRef.current) {
          const ps = particlesRef.current;
          ps.forEach((p) => (p.age = p.life));
        }
        lastZoomRef.current = z;
        fetchWindDataOpenWeather();
      }, 2000); // Wait 2 seconds after movement stops
    };
    map.on('moveend', onMoveEnd);

    rafRef.current = requestAnimationFrame(animate);

    // Log API usage stats on cleanup
    return () => {
      console.log(`📊 Total API calls this session: ${apiCallCountRef.current}`);
      clearTimeout(moveEndTimeout);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      map.un('moveend', onMoveEnd);
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      map.setTarget(null);
      mapObjRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default LiveMap;