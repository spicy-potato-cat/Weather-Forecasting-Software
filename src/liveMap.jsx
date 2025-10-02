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

// =============================================================================
// CONFIG: Layers enabled in the embedded map preview
// =============================================================================
const EMBEDDED_CONFIG = {
  // Default layers turned on for the embedded map
  ENABLED_LAYERS: {
    wind: true,        // Enable wind particles
    temperature: false, // Disable temperature
    precipitation: false, // Disable precipitation
    clouds: false,      // Disable clouds
  },

  // Wind particle settings (lightweight for preview)
  WIND: {
    DENSITY_PER_PIXEL: 0.0004, // Half the density of full map
    COUNT_MIN: 400,
    COUNT_MAX: 1000,
    DOT_RADIUS_PX: 1.5,
    COLOR: '#ffffff',
    SHADOW_BLUR: 1,
    LIFE_MIN_S: 4.0,
    LIFE_MAX_S: 7.0,
    WIND_SPEED_MULTIPLIER: 5000,
  },

  // API settings
  OPENWEATHER_API_KEY: import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo',
  CACHE_TTL_MS: 10 * 60 * 1000,
  MIN_FETCH_INTERVAL_MS: 2000,
};

/**
 * LiveMap - Embedded lightweight version of LiveMapPage
 * 
 * Features:
 * - Renders actual OpenLayers map with configurable layers
 * - Single click: Navigate to /live-map
 * - Double click + drag: Pan the map
 * - Scroll: Zoom in/out
 * - Automatically starts wind animation if enabled in config
 */
const LiveMap = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const mapObjRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);
  const windGridDataRef = useRef(null);
  const lastApiFetchRef = useRef(0);
  const clickTimeoutRef = useRef(null);
  const hasMovedRef = useRef(false);

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

  const sampleWindUV = (lon, lat) => {
    const grid = windGridDataRef.current;
    if (!grid || Date.now() - grid.ts > EMBEDDED_CONFIG.CACHE_TTL_MS) {
      return { u: 0, v: 0 };
    }
    return {
      u: grid.u * EMBEDDED_CONFIG.WIND.WIND_SPEED_MULTIPLIER,
      v: grid.v * EMBEDDED_CONFIG.WIND.WIND_SPEED_MULTIPLIER
    };
  };

  const fetchWindData = async () => {
    const now = Date.now();
    if (now - lastApiFetchRef.current < EMBEDDED_CONFIG.MIN_FETCH_INTERVAL_MS) return;
    if (windGridDataRef.current && now - windGridDataRef.current.ts < EMBEDDED_CONFIG.CACHE_TTL_MS) return;

    lastApiFetchRef.current = now;
    const bounds = getViewLonLatBounds();
    const centerLon = (bounds.lonMin + bounds.lonMax) / 2;
    const centerLat = (bounds.latMin + bounds.latMax) / 2;

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${centerLat.toFixed(2)}&lon=${centerLon.toFixed(2)}&appid=${EMBEDDED_CONFIG.OPENWEATHER_API_KEY}&units=metric`;
      const res = await fetch(url);
      if (!res.ok) return;
      
      const data = await res.json();
      if (data?.wind) {
        const speedMs = data.wind.speed || 0;
        const direction = data.wind.deg || 0;
        const { u, v } = meteoToUV(speedMs, direction);
        windGridDataRef.current = { ...bounds, u, v, ts: now };
      }
    } catch (err) {
      console.warn('Wind fetch failed:', err.message);
    }
  };

  const animate = (ts) => {
    if (!EMBEDDED_CONFIG.ENABLED_LAYERS.wind) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const map = mapObjRef.current;
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!map || !ctx || !canvas) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

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

      const { u, v } = sampleWindUV(p.lon, p.lat);
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
    canvas.style.zIndex = '10';
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

    // Initialize particles if wind is enabled
    if (EMBEDDED_CONFIG.ENABLED_LAYERS.wind) {
      const bounds = getViewLonLatBounds();
      const count = clamp(Math.round(400 * 600 * EMBEDDED_CONFIG.WIND.DENSITY_PER_PIXEL), 
                          EMBEDDED_CONFIG.WIND.COUNT_MIN, 
                          EMBEDDED_CONFIG.WIND.COUNT_MAX);
      for (let i = 0; i < count; i++) {
        const p = { lon: 0, lat: 0, age: 0, life: 1 };
        respawnParticle(p, bounds);
        particlesRef.current.push(p);
      }
      fetchWindData();
      rafRef.current = requestAnimationFrame(animate);
    }

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

    return () => {
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resizeCanvas);
      viewport.removeEventListener('click', handleClick);
      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('pointermove', handlePointerMove);
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
