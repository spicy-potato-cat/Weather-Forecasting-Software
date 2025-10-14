import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import 'ol/ol.css';
import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { clamp, lerp, kmhToMs, meteoToUV } from './lib/math.js';
import { usePreferences } from './hooks/usePreferences.js';
import { convertTemperature, getTemperatureSymbol } from './lib/math.js';

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
    LIFE_MIN_S: 4.0,
    LIFE_MAX_S: 7.0,
    WIND_SPEED_MULTIPLIER: 5000,
  },

  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
  WIND_CACHE_TTL_MS: 10 * 60 * 1000, // 10 min for wind
  TEMPERATURE_CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour for temperature
  MIN_FETCH_INTERVAL_MS: 2000,
  MAX_CONCURRENT_FETCHES: 2, // Fewer concurrent fetches for embedded map
};

// Grid helper functions (same as liveMapPage.jsx)
const getGridCellKey = (lat, lon) => {
  const resolution = EMBEDDED_CONFIG.GRID_RESOLUTION_DEG;
  const latCell = Math.floor(lat / resolution) * resolution;
  const lonCell = Math.floor(lon / resolution) * resolution;
  return `${latCell}_${lonCell}`;
};

const getGridCellBounds = (key) => {
  const [latStr, lonStr] = key.split('_');
  const latMin = parseInt(latStr);
  const lonMin = parseInt(lonStr);
  const resolution = EMBEDDED_CONFIG.GRID_RESOLUTION_DEG;
  
  return {
    latMin,
    latMax: latMin + resolution,
    lonMin,
    lonMax: lonMin + resolution,
    centerLat: latMin + resolution / 2,
    centerLon: lonMin + resolution / 2,
  };
};

const getVisibleGridCells = (bounds) => {
  const resolution = EMBEDDED_CONFIG.GRID_RESOLUTION_DEG;
  const cells = new Set();
  
  const latMin = Math.max(-90, Math.min(bounds.latMin, bounds.latMax));
  const latMax = Math.min(90, Math.max(bounds.latMin, bounds.latMax));
  const lonMin = Math.max(-180, Math.min(bounds.lonMin, bounds.lonMax));
  const lonMax = Math.min(180, Math.max(bounds.lonMin, bounds.lonMax));
  
  for (let lat = Math.floor(latMin / resolution) * resolution; lat < latMax; lat += resolution) {
    for (let lon = Math.floor(lonMin / resolution) * resolution; lon < lonMax; lon += resolution) {
      const key = getGridCellKey(lat, lon);
      cells.add(key);
    }
  }
  
  return Array.from(cells);
};

// Temperature color function with special case handling
const getTemperatureColor = (tempC) => {
  // Special cases: clamp extreme temperatures
  if (tempC <= -30) return 'rgb(0, 0, 255)'; // Deep blue for extreme cold
  if (tempC >= 50) return 'rgb(255, 0, 0)';  // Pure red for extreme heat
  
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

const LiveMap = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const mapObjRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);
  
  // Separate caches
  const windGridCacheRef = useRef(new Map());
  const temperatureGridCacheRef = useRef(new Map());
  const activeFetchesRef = useRef(new Set());
  const activeTemperatureFetchesRef = useRef(new Set());

  const clickTimeoutRef = useRef(null);
  const hasMovedRef = useRef(false);
  const lastZoomRef = useRef(null);
  
  const { preferences } = usePreferences();
  
  const tempCanvasRef = useRef(null);
  const tempCtxRef = useRef(null);

  // Simplified particle system for wind
  const respawnParticle = (p, bounds) => {
    p.lon = lerp(bounds.lonMin, bounds.lonMax, Math.random());
    p.lat = lerp(bounds.latMin, bounds.latMax, Math.random());
    p.age = 0;
    p.life = lerp(EMBEDDED_CONFIG.WIND.LIFE_MIN_S, EMBEDDED_CONFIG.WIND.LIFE_MAX_S, Math.random());
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
   * Fetch wind data for a specific grid cell (embedded version)
   */
  const fetchGridCellWind = async (cellKey) => {
    const now = Date.now();
    
    const cached = windGridCacheRef.current.get(cellKey);
    if (cached && (now - cached.ts < EMBEDDED_CONFIG.WIND_CACHE_TTL_MS)) {
      return cached;
    }
    
    if (activeFetchesRef.current.has(cellKey)) {
      return cached || null;
    }
    
    if (now - lastApiFetchRef.current < EMBEDDED_CONFIG.MIN_FETCH_INTERVAL_MS) {
      return cached || null;
    }
    
    const bounds = getGridCellBounds(cellKey);
    const { centerLat, centerLon } = bounds;
    
    if (!isFinite(centerLat) || !isFinite(centerLon) ||
        centerLat < -90 || centerLat > 90 ||
        centerLon < -180 || centerLon > 180) {
      return cached || null;
    }
    
    activeFetchesRef.current.add(cellKey);
    lastApiFetchRef.current = now;
    
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?` +
        `lat=${centerLat.toFixed(4)}&` +
        `lon=${centerLon.toFixed(4)}&` +
        `appid=${EMBEDDED_CONFIG.OPENWEATHER_API_KEY}&` +
        `units=metric`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        activeFetchesRef.current.delete(cellKey);
        return cached || null;
      }
      
      const data = await res.json();
      
      if (data?.wind) {
        const speedMs = data.wind.speed || 0;
        const direction = data.wind.deg || 0;
        const { u, v } = meteoToUV(speedMs, direction);
        
        const cellData = {
          cellKey,
          ...bounds,
          u,
          v,
          speed: speedMs,
          direction,
          ts: now,
          temp: data.main?.temp,
        };
        
        windGridCacheRef.current.set(cellKey, cellData);
        activeFetchesRef.current.delete(cellKey);
        
        // IMMEDIATE RENDER: Trigger overlay update
        if (EMBEDDED_CONFIG.ENABLED_LAYERS.temperature) {
          requestAnimationFrame(() => renderTemperatureOverlay());
        }
        
        return cellData;
      }
      
      activeFetchesRef.current.delete(cellKey);
      return cached || null;
      
    } catch (err) {
      activeFetchesRef.current.delete(cellKey);
      return cached || null;
    }
  };

  /**
   * Fetch temperature data for a specific grid cell (embedded version)
   */
  const fetchGridCellTemperature = async (cellKey) => {
    const now = Date.now();
    
    const cached = temperatureGridCacheRef.current.get(cellKey);
    if (cached && (now - cached.ts < EMBEDDED_CONFIG.TEMPERATURE_CACHE_TTL_MS)) {
      return cached;
    }
    
    if (activeTemperatureFetchesRef.current.has(cellKey)) {
      return cached || null;
    }
    
    const bounds = getGridCellBounds(cellKey);
    const { centerLat, centerLon } = bounds;
    
    if (!isFinite(centerLat) || !isFinite(centerLon) ||
        centerLat < -90 || centerLat > 90 ||
        centerLon < -180 || centerLon > 180) {
      return cached || null;
    }
    
    activeTemperatureFetchesRef.current.add(cellKey);
    
    try {
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
        const temp = data.hourly.temperature_2m[0];
        
        const cellData = {
          cellKey,
          ...bounds,
          temp,
          ts: now,
        };
        
        temperatureGridCacheRef.current.set(cellKey, cellData);
        activeTemperatureFetchesRef.current.delete(cellKey);
        
        if (EMBEDDED_CONFIG.ENABLED_LAYERS.temperature) {
          requestAnimationFrame(() => renderTemperatureOverlay());
        }
        
        return cellData;
      }
      
      activeTemperatureFetchesRef.current.delete(cellKey);
      return cached || null;
      
    } catch (err) {
      activeTemperatureFetchesRef.current.delete(cellKey);
      return cached || null;
    }
  };

  /**
   * Fetch visible grid cells (batched for embedded map)
   */
  const fetchVisibleGridCells = async () => {
    const bounds = getViewLonLatBounds();
    const visibleCells = getVisibleGridCells(bounds);
    
    const now = Date.now();
    const cellsToFetch = visibleCells.filter(cellKey => {
      const cached = windGridCacheRef.current.get(cellKey);
      return !cached || (now - cached.ts > EMBEDDED_CONFIG.WIND_CACHE_TTL_MS);
    });
    
    if (cellsToFetch.length === 0) {
      if (EMBEDDED_CONFIG.ENABLED_LAYERS.temperature) {
        renderTemperatureOverlay();
      }
      return;
    }
    
    // Fetch with Promise.allSettled to handle failures gracefully
    for (let i = 0; i < cellsToFetch.length; i += EMBEDDED_CONFIG.MAX_CONCURRENT_FETCHES) {
      const batch = cellsToFetch.slice(i, i + EMBEDDED_CONFIG.MAX_CONCURRENT_FETCHES);
      await Promise.allSettled(batch.map(cellKey => fetchGridCellWind(cellKey)));
      
      if (i + EMBEDDED_CONFIG.MAX_CONCURRENT_FETCHES < cellsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  /**
   * Fetch visible temperature data (batched for embedded map)
   */
  const fetchVisibleTemperatures = async () => {
    const bounds = getViewLonLatBounds();
    const visibleCells = getVisibleGridCells(bounds);
    
    const now = Date.now();
    const cellsToFetch = visibleCells.filter(cellKey => {
      const cached = temperatureGridCacheRef.current.get(cellKey);
      return !cached || (now - cached.ts > EMBEDDED_CONFIG.TEMPERATURE_CACHE_TTL_MS);
    });
    
    if (cellsToFetch.length === 0) {
      if (EMBEDDED_CONFIG.ENABLED_LAYERS.temperature) {
        renderTemperatureOverlay();
      }
      return;
    }
    
    // Fast batch fetching
    const batchSize = 8;
    for (let i = 0; i < cellsToFetch.length; i += batchSize) {
      const batch = cellsToFetch.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(cellKey => fetchGridCellTemperature(cellKey)));
      
      if (i + batchSize < cellsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  };

  /**
   * FIXED: Sample wind with async fetching (embedded version)
   */
  const sampleWindUV = async (lon, lat) => {
    const cellKey = getGridCellKey(lat, lon);
    let cellData = windGridCacheRef.current.get(cellKey);
    
    if (!cellData || Date.now() - cellData.ts > EMBEDDED_CONFIG.WIND_CACHE_TTL_MS) {
      cellData = await fetchGridCellWind(cellKey);
    }
    
    if (!cellData) {
      return { u: 0, v: 0 };
    }
    
    return {
      u: cellData.u * EMBEDDED_CONFIG.WIND.WIND_SPEED_MULTIPLIER,
      v: cellData.v * EMBEDDED_CONFIG.WIND.WIND_SPEED_MULTIPLIER
    };
  };

  const animate = async (ts) => {
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

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age += dt;

        if (p.age >= p.life) {
          respawnParticle(p, bounds);
          continue;
        }

        // FIXED: Await wind data
        const { u, v } = await sampleWindUV(p.lon, p.lat);
        
        if (u === 0 && v === 0) continue;
        
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
    }

    // ALWAYS render temperature overlay if enabled (independent of wind)
    renderTemperatureOverlay();
    
    rafRef.current = requestAnimationFrame(animate);
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

    // Create temperature overlay canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.style.position = 'absolute';
    tempCanvas.style.left = '0';
    tempCanvas.style.top = '0';
    tempCanvas.style.pointerEvents = 'none';
    tempCanvas.style.zIndex = '12'; // Temperature above map, below wind
    tempCanvasRef.current = tempCanvas;

    viewport.appendChild(tempCanvas);

    const tempCtx = tempCanvas.getContext('2d');
    tempCtxRef.current = tempCtx;

    const resizeCanvas = () => {
      if (!canvas || !mapRef.current) return;
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = mapRef.current;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      
      // Resize temperature canvas
      if (tempCanvas && mapRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const { clientWidth: w, clientHeight: h } = mapRef.current;
        tempCanvas.style.width = `${w}px`;
        tempCanvas.style.height = `${h}px`;
        tempCanvas.width = Math.round(w * dpr);
        tempCanvas.height = Math.round(h * dpr);
        tempCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
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

    // ADDED: Pre-fetch wind data for initial viewport
    fetchVisibleGridCells();

    // Start animation
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
        fetchVisibleGridCells(); // CHANGED: Fetch grid cells
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
      if (tempCanvas && tempCanvas.parentElement) {
        tempCanvas.parentElement.removeChild(tempCanvas);
      }
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
