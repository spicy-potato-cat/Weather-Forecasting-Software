import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'ol/ol.css';
import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { lerp } from './lib/math.js';
import { sharedWindCache, getGridCellKey, getGridCellBounds } from './lib/windCache.js';

// CONFIG: Embedded map with grid-based wind
const EMBEDDED_CONFIG = {
  // Grid Resolution (must match liveMapPage.jsx)
  GRID_RESOLUTION_DEG: 30, // 30° x 30° cells
  
  ENABLED_LAYERS: {
    wind: true,
    temperature: false,
    precipitation: false,
    clouds: false,
  },

  WIND: {
    DENSITY_PER_PIXEL: 0.0004,
    COUNT_MIN: 400,
    COUNT_MAX: 1000,
    DOT_RADIUS_PX: 1.5,
    COLOR: '#ffffff',
    SHADOW_BLUR: 1,
    LIFE_MIN_S: 15.0,
    LIFE_MAX_S: 25.0,
    WIND_SPEED_MULTIPLIER: 5000,
  },

  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
  WIND_CACHE_TTL_MS: 10 * 60 * 1000, // 10 min for wind
  TEMPERATURE_CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour for temperature
  MIN_FETCH_INTERVAL_MS: 2000,
  MAX_CONCURRENT_FETCHES: 2, // Fewer concurrent fetches for embedded map
};

// LiveMap component
const LiveMap = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const mapObjRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);
  
  const clickTimeoutRef = useRef(null);
  const hasMovedRef = useRef(false);
  const lastZoomRef = useRef(null);
  
  // Simplified particle system for wind
  const respawnParticle = (p, bounds) => {
    p.lon = lerp(bounds.lonMin, bounds.lonMax, Math.random());
    p.lat = lerp(bounds.latMin, bounds.latMax, Math.random());
    p.age = 0;
    p.life = lerp(EMBEDDED_CONFIG.WIND.LIFE_MIN_S, EMBEDDED_CONFIG.WIND.LIFE_MAX_S, Math.random());
  };

  /**
   * Detect if user zoomed out (scroll out)
   * Returns true if zoom level decreased
   */
  const detectScrollOut = (currentZoom, previousZoom) => {
    if (previousZoom === null || previousZoom === undefined) return false;
    const zoomDiff = currentZoom - previousZoom;
    return zoomDiff < -0.01; // Threshold to avoid floating point errors
  };

  /**
   * Reset all particles immediately by expiring them
   * Forces them to respawn in new viewport bounds
   */
  const resetParticles = () => {
    const particles = particlesRef.current;
    if (!particles || particles.length === 0) return;
    
    const bounds = getViewLonLatBounds();
    
    // Immediately respawn all particles in new viewport
    particles.forEach((p) => {
      respawnParticle(p, bounds);
    });
  };

  const getViewLonLatBounds = () => {
    const map = mapObjRef.current;
    if (!map) return { lonMin: -180, lonMax: 180, latMin: -85, latMax: 85 };
    const view = map.getView();
    const extent = view.calculateExtent(map.getSize());
    const [minLon, minLat] = toLonLat([extent[0], extent[1]]);
    const [maxLon, maxLat] = toLonLat([extent[2], extent[3]]);
    return { lonMin: minLon, lonMax: maxLon, latMin: minLat, latMax: maxLat };
  };

  /**
   * Get all visible grid cells
   */
  const getVisibleGridCells = (bounds) => {
    const resolution = EMBEDDED_CONFIG.GRID_RESOLUTION_DEG;
    const cells = [];
    
    const latMin = Math.max(-90, Math.min(bounds.latMin, bounds.latMax));
    const latMax = Math.min(90, Math.max(bounds.latMin, bounds.latMax));
    const lonMin = Math.max(-180, Math.min(bounds.lonMin, bounds.lonMax));
    const lonMax = Math.min(180, Math.max(bounds.lonMin, bounds.lonMax));
    
    for (let lat = Math.floor(latMin / resolution) * resolution; lat < latMax; lat += resolution) {
      for (let lon = Math.floor(lonMin / resolution) * resolution; lon < lonMax; lon += resolution) {
        const key = getGridCellKey(lat, lon, resolution);
        cells.push(key);
      }
    }
    
    return cells;
  };

  /**
   * Pre-fetch visible cells on mount and viewport change
   */
  const prefetchVisibleCells = async () => {
    const bounds = getViewLonLatBounds();
    const visibleCells = getVisibleGridCells(bounds);
    
    // Create bounds map for batch fetching
    const boundsMap = new Map();
    visibleCells.forEach(key => {
      boundsMap.set(key, getGridCellBounds(key, EMBEDDED_CONFIG.GRID_RESOLUTION_DEG));
    });
    
    // Use shared cache for batch fetching
    await sharedWindCache.batchFetchWind(visibleCells, boundsMap);
  };

  /**
   * Sample wind using shared cache (instant if cached)
   */
  const sampleWindUV = (lon, lat) => {
    const cellKey = getGridCellKey(lat, lon, EMBEDDED_CONFIG.GRID_RESOLUTION_DEG);
    const cellData = sharedWindCache.getWind(cellKey);
    
    if (!cellData) {
      // Trigger lazy fetch for this cell (non-blocking)
      const bounds = getGridCellBounds(cellKey, EMBEDDED_CONFIG.GRID_RESOLUTION_DEG);
      sharedWindCache.fetchWind(cellKey, bounds);
      return { u: 0, v: 0 };
    }
    
    return {
      u: cellData.u * EMBEDDED_CONFIG.WIND.WIND_SPEED_MULTIPLIER,
      v: cellData.v * EMBEDDED_CONFIG.WIND.WIND_SPEED_MULTIPLIER,
    };
  };

  const animate = (ts) => {
    const map = mapObjRef.current;
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    
    if (!map || !ctx || !canvas) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    // Wind rendering (only if enabled)
    if (EMBEDDED_CONFIG.ENABLED_LAYERS.wind) {
      if (!lastTimeRef.current) lastTimeRef.current = ts;
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = ts;

      const dpr = window.devicePixelRatio || 1;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.globalCompositeOperation = 'source-over';

      const bounds = getViewLonLatBounds();
      const particles = particlesRef.current;

      ctx.fillStyle = EMBEDDED_CONFIG.WIND.COLOR;
      ctx.shadowBlur = EMBEDDED_CONFIG.WIND.SHADOW_BLUR;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';

      let activeParticles = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age += dt;

        if (p.age >= p.life) {
          respawnParticle(p, bounds);
          continue;
        }

        // FIXED: Synchronous wind sampling (instant from cache)
        const { u, v } = sampleWindUV(p.lon, p.lat);
        
        if (u === 0 && v === 0) continue;
        
        activeParticles++;
        
        const coord3857 = fromLonLat([p.lon, p.lat]);
        const newX = coord3857[0] + u * dt;
        const newY = coord3857[1] + v * dt;
        const newLonLat = toLonLat([newX, newY]);

        if (!isFinite(newLonLat[0]) || !isFinite(newLonLat[1]) ||
            newLonLat[0] < bounds.lonMin || newLonLat[0] > bounds.lonMax ||
            newLonLat[1] < bounds.latMin || newLonLat[1] > bounds.latMax) {
          respawnParticle(p, bounds);
          continue;
        }

        p.lon = newLonLat[0];
        p.lat = newLonLat[1];

        const px = map.getPixelFromCoordinate([newX, newY]);
        if (px) {
          ctx.beginPath();
          ctx.arc(px[0], px[1], EMBEDDED_CONFIG.WIND.DOT_RADIUS_PX, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.shadowBlur = 0;
      
      // Debug logging every 5 seconds
      if (Math.floor(ts / 5000) !== Math.floor((ts - 16) / 5000)) {
        const stats = sharedWindCache.getStats();
        console.log(`🌬️ Embedded: ${particles.length} particles | ${activeParticles} active | Cache: ${stats.windCacheSize} cells | Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      }
    }

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
    window.map = map;

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

    const resizeCanvas = () => {
      if (!canvas || !mapRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = mapRef.current;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    const bounds = getViewLonLatBounds();
    const target = Math.floor(400 + Math.random() * 200); // 400-600 particles
    particlesRef.current = [];
    for (let i = 0; i < target; i++) {
      const p = { lon: 0, lat: 0, age: 0, life: 1 };
      respawnParticle(p, bounds);
      particlesRef.current.push(p);
    }

    // CRITICAL: Pre-fetch wind data immediately on mount
    if (EMBEDDED_CONFIG.ENABLED_LAYERS.wind) {
      console.log('🔄 Pre-fetching wind data for embedded map...');
      prefetchVisibleCells().then(() => {
        console.log(`✅ Initial prefetch complete`);
      });
    }

    // Start animation IMMEDIATELY
    console.log('▶️ Starting animation loop...');
    lastTimeRef.current = 0; // Reset timer
    rafRef.current = requestAnimationFrame(animate);

    let moveEndTimeout;
    const onMoveEnd = () => {
      clearTimeout(moveEndTimeout);
      
      const currentZoom = map.getView().getZoom();
      const previousZoom = lastZoomRef.current;
      
      const scrolledOut = detectScrollOut(currentZoom, previousZoom);
      
      if (scrolledOut) {
        resetParticles();
        lastZoomRef.current = currentZoom;
      } else if (previousZoom !== null && Math.abs(currentZoom - previousZoom) > 0.01) {
        lastZoomRef.current = currentZoom;
      }
      
      moveEndTimeout = setTimeout(() => {
        // Pre-fetch new viewport cells
        prefetchVisibleCells();
      }, 1000);
    };
    
    map.on('moveend', onMoveEnd);

    // Real-time zoom detection
    const onResolutionChange = () => {
      const currentZoom = map.getView().getZoom();
      const previousZoom = lastZoomRef.current;
      
      if (previousZoom !== null && previousZoom !== undefined) {
        const scrolledOut = detectScrollOut(currentZoom, previousZoom);
        
        if (scrolledOut) {
          console.log(`Embedded map: Instant zoom out ${previousZoom.toFixed(2)} → ${currentZoom.toFixed(2)}`);
          resetParticles();
          lastZoomRef.current = currentZoom;
        } else if (Math.abs(currentZoom - previousZoom) > 0.01) {
          lastZoomRef.current = currentZoom;
        }
      }
    };

    map.getView().on('change:resolution', onResolutionChange);

    // Handle click to navigate (only if no drag occurred)
    const handleClick = () => {
      if (hasMovedRef.current) {
        hasMovedRef.current = false;
        return;
      }
      
      // Single click navigates to full map
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = setTimeout(() => {
        navigate('/live-map');
      }, 250);
    };

    const handlePointerDown = () => {
      hasMovedRef.current = false;
    };

    const handlePointerMove = () => {
      hasMovedRef.current = true;
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    };

    viewport.addEventListener('click', handleClick);
    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);

    // Initialize lastZoomRef with the initial zoom level
    lastZoomRef.current = map.getView().getZoom();

    return () => {
      console.log('🛑 Embedded map cleanup');
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (moveEndTimeout) clearTimeout(moveEndTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resizeCanvas);
      viewport.removeEventListener('click', handleClick);
      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('pointermove', handlePointerMove);
      
      // Properly remove resolution change listener
      const view = map.getView();
      if (view) {
        view.un('change:resolution', onResolutionChange);
      }
      
      map.un('moveend', onMoveEnd);
      
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      map.setTarget(null);
    };
  }, [navigate]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '400px',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
      }}
      title="Click to open full interactive map"
    />
  );
};

export default LiveMap;
