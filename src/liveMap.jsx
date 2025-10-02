import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { meteoToUV, clamp, lerp } from './lib/math.js';

// Module-level cache using plain objects (avoiding Map/Set prototype issues with HMR)
const windCacheStore = { data: {} };
const inflightStore = { data: {} };

function getWindCache() {
  return windCacheStore.data;
}

function getInflightSet() {
  return inflightStore.data;
}

function cacheHas(key) {
  return key in windCacheStore.data;
}

function cacheGet(key) {
  return windCacheStore.data[key];
}

function cacheSet(key, value) {
  windCacheStore.data[key] = value;
}

function cacheDelete(key) {
  delete windCacheStore.data[key];
}

function inflightHas(key) {
  return key in inflightStore.data;
}

function inflightAdd(key) {
  inflightStore.data[key] = true;
}

function inflightDelete(key) {
  delete inflightStore.data[key];
}

// Configuration
const CONFIG = {
  // Particles
  DENSITY_PER_PIXEL: 0.0008,
  COUNT_MIN: 800,
  COUNT_MAX: 5000,
  DOT_RADIUS_PX: 1.2,
  
  // Visuals
  COLOR: 'rgba(255, 255, 255, 0.8)',
  SHADOW_COLOR: 'rgba(0, 150, 255, 0.4)',
  SHADOW_BLUR: 2,
  
  // Speed-based color (optional)
  USE_SPEED_COLOR: true,
  SPEED_COLOR_MIN: [100, 150, 255], // Blue (slow) RGB
  SPEED_COLOR_MAX: [255, 100, 100], // Red (fast) RGB
  SPEED_MIN_MS: 0,
  SPEED_MAX_MS: 20,
  
  // Lifetime
  LIFE_MIN_S: 1.5,
  LIFE_MAX_S: 3.0,
  
  // Wind grid
  GRID_STEP_DEG: 1.5,
  CACHE_TTL_MS: 30 * 60 * 1000, // 30 minutes
  PRIME_MAX_CELLS: 40,
  
  // API
  USE_ALTITUDE: '10m',
  
  // Animation
  MAX_DT_S: 0.05,
  TRAIL_FADE_ALPHA: 0.12,
};

const LiveMap = () => {
  const mapRef = useRef(null);
  const canvasRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const particlesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    if (!mapRef.current) return;

    // Helper functions defined inside useEffect to avoid dependency issues
    const getViewLonLatBounds = () => {
      const map = mapInstanceRef.current;
      if (!map) return { lonMin: -180, lonMax: 180, latMin: -85, latMax: 85 };

      const extent = map.getView().calculateExtent(map.getSize());
      const [lonMin, latMin] = toLonLat([extent[0], extent[1]]);
      const [lonMax, latMax] = toLonLat([extent[2], extent[3]]);

      return { lonMin, lonMax, latMin, latMax };
    };

    const randomInBounds = () => {
      const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
      return {
        lon: lonMin + Math.random() * (lonMax - lonMin),
        lat: latMin + Math.random() * (latMax - latMin),
      };
    };

    const randomLife = () => {
      return CONFIG.LIFE_MIN_S + Math.random() * (CONFIG.LIFE_MAX_S - CONFIG.LIFE_MIN_S);
    };

    const initializeParticles = () => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const size = map.getSize();
      if (!size) return;

      const pixelArea = size[0] * size[1];
      const targetCount = clamp(
        Math.floor(pixelArea * CONFIG.DENSITY_PER_PIXEL),
        CONFIG.COUNT_MIN,
        CONFIG.COUNT_MAX
      );

      const particles = [];
      for (let i = 0; i < targetCount; i++) {
        const pos = randomInBounds();
        particles.push({
          lon: pos.lon,
          lat: pos.lat,
          age: 0,
          maxAge: randomLife(),
          speed: 0,
        });
      }

      particlesRef.current = particles;
    };

    const respawnParticle = (p) => {
      const pos = randomInBounds();
      p.lon = pos.lon;
      p.lat = pos.lat;
      p.age = 0;
      p.maxAge = randomLife();
      p.speed = 0;
    };

    const fetchWindForCell = async (i, j) => {
      const key = `${i}:${j}`;
      
      if (cacheHas(key)) {
        const entry = cacheGet(key);
        if (Date.now() - entry.ts < CONFIG.CACHE_TTL_MS) {
          return entry;
        }
        cacheDelete(key);
      }
      
      if (inflightHas(key)) return null;
      
      inflightAdd(key);
      
      try {
        const step = CONFIG.GRID_STEP_DEG;
        const lon = (i + 0.5) * step;
        const lat = clamp((j + 0.5) * step, -85, 85);
        
        const alt = CONFIG.USE_ALTITUDE;
        const url = `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
          `&hourly=wind_speed_${alt},wind_direction_${alt}` +
          `&forecast_days=1`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.hourly) {
          // Get current hour index (or first available)
          const now = new Date();
          const currentHour = now.getUTCHours();
          const idx = Math.min(currentHour, data.hourly.time.length - 1);
          
          const speedKmh = data.hourly[`wind_speed_${alt}`]?.[idx];
          const directionDeg = data.hourly[`wind_direction_${alt}`]?.[idx];
          
          if (typeof speedKmh === 'number' && typeof directionDeg === 'number') {
            const speedMs = speedKmh / 3.6;
            const { u, v } = meteoToUV(speedMs, directionDeg);
            
            const entry = { ts: Date.now(), u, v, speed: speedMs };
            cacheSet(key, entry);
            return entry;
          }
        }
        
        const entry = { ts: Date.now(), u: 0, v: 0, speed: 0 };
        cacheSet(key, entry);
        return entry;
        
      } catch (err) {
        console.warn(`Wind fetch failed for ${key}:`, err);
        const entry = { ts: Date.now(), u: 0, v: 0, speed: 0 };
        cacheSet(key, entry);
        return entry;
      } finally {
        inflightDelete(key);
      }
    };

    const primeWindData = async () => {
      const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
      const step = CONFIG.GRID_STEP_DEG;

      const iMin = Math.floor(lonMin / step);
      const iMax = Math.ceil(lonMax / step);
      const jMin = Math.floor(latMin / step);
      const jMax = Math.ceil(latMax / step);

      const cells = [];
      for (let i = iMin; i <= iMax; i++) {
        for (let j = jMin; j <= jMax; j++) {
          cells.push([i, j]);
        }
      }

      // Limit to avoid overwhelming API
      const primeCells = cells.slice(0, CONFIG.PRIME_MAX_CELLS);
      
      // Fetch in background
      for (const [i, j] of primeCells) {
        fetchWindForCell(i, j);
      }
    };

    const sampleWindUV = async (lon, lat) => {
      const step = CONFIG.GRID_STEP_DEG;
      const i = Math.floor(lon / step);
      const j = Math.floor(lat / step);

      // Get four corners
      const w00 = await fetchWindForCell(i, j);
      const w10 = await fetchWindForCell(i + 1, j);
      const w01 = await fetchWindForCell(i, j + 1);
      const w11 = await fetchWindForCell(i + 1, j + 1);

      if (!w00 || !w10 || !w01 || !w11) return null;

      // Bilinear interpolation
      const fx = (lon - i * step) / step;
      const fy = (lat - j * step) / step;

      const u0 = lerp(w00.u, w10.u, fx);
      const u1 = lerp(w01.u, w11.u, fx);
      const u = lerp(u0, u1, fy);

      const v0 = lerp(w00.v, w10.v, fx);
      const v1 = lerp(w01.v, w11.v, fx);
      const v = lerp(v0, v1, fy);

      const s0 = lerp(w00.speed, w10.speed, fx);
      const s1 = lerp(w01.speed, w11.speed, fx);
      const speed = lerp(s0, s1, fy);

      return { u, v, speed };
    };

    const animate = async (currentTime) => {
      const map = mapInstanceRef.current;
      const canvas = canvasRef.current;
      const particles = particlesRef.current;

      if (!map || !canvas || !particles.length) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Calculate delta time
      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, CONFIG.MAX_DT_S);
      lastTimeRef.current = currentTime;

      // Fade trails
      ctx.fillStyle = `rgba(0, 0, 0, ${CONFIG.TRAIL_FADE_ALPHA})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update particles
      const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Age particle
        p.age += dt;
        if (p.age >= p.maxAge) {
          respawnParticle(p);
          continue;
        }

        // Sample wind at particle location
        const wind = await sampleWindUV(p.lon, p.lat);
        if (!wind) continue;

        const { u, v, speed } = wind;

        // Advect in Web Mercator (EPSG:3857) world coordinates
        const [x3857, y3857] = fromLonLat([p.lon, p.lat]);
        const newX = x3857 + u * dt;
        const newY = y3857 + v * dt;
        const [newLon, newLat] = toLonLat([newX, newY]);

        // Validate new position
        if (!isFinite(newLon) || !isFinite(newLat)) {
          respawnParticle(p);
          continue;
        }

        // Check if out of viewport
        if (newLon < lonMin || newLon > lonMax || newLat < latMin || newLat > latMax) {
          respawnParticle(p);
          continue;
        }

        p.lon = newLon;
        p.lat = newLat;
        p.speed = speed;
      }

      // Draw particles
      ctx.shadowColor = CONFIG.SHADOW_COLOR;
      ctx.shadowBlur = CONFIG.SHADOW_BLUR;

      if (CONFIG.USE_SPEED_COLOR) {
        // Draw with speed-based colors
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const px = map.getPixelFromCoordinate(fromLonLat([p.lon, p.lat]));
          if (!px) continue;
          
          const t = clamp(
            (p.speed - CONFIG.SPEED_MIN_MS) / (CONFIG.SPEED_MAX_MS - CONFIG.SPEED_MIN_MS),
            0, 1
          );
          const r = Math.round(lerp(CONFIG.SPEED_COLOR_MIN[0], CONFIG.SPEED_COLOR_MAX[0], t));
          const g = Math.round(lerp(CONFIG.SPEED_COLOR_MIN[1], CONFIG.SPEED_COLOR_MAX[1], t));
          const b = Math.round(lerp(CONFIG.SPEED_COLOR_MIN[2], CONFIG.SPEED_COLOR_MAX[2], t));
          
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
          ctx.beginPath();
          ctx.arc(px[0], px[1], CONFIG.DOT_RADIUS_PX, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = CONFIG.COLOR;
        ctx.beginPath();
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const px = map.getPixelFromCoordinate(fromLonLat([p.lon, p.lat]));
          if (!px) continue;
          
          ctx.moveTo(px[0], px[1]);
          ctx.arc(px[0], px[1], CONFIG.DOT_RADIUS_PX, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Initialize map
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: fromLonLat([0, 20]),
        zoom: 3,
      }),
      interactions: defaultInteractions().extend([
        new MouseWheelZoom({
          delta: 7,
          duration: 250,
          constrainResolution: true,
        }),
      ]),
    });

    mapInstanceRef.current = map;
    window.map = map;

    // Initialize canvas overlay
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const size = map.getSize();
      if (size) {
        canvas.width = size[0];
        canvas.height = size[1];
        canvas.style.width = size[0] + 'px';
        canvas.style.height = size[1] + 'px';
      }
    };

    updateCanvasSize();
    map.on('change:size', updateCanvasSize);

    // Initialize particles
    initializeParticles();

    // Prime wind data
    primeWindData();

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    // Reinitialize particles on significant map changes
    const handleMapChange = () => {
      initializeParticles();
    };
    map.on('moveend', handleMapChange);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map.un('change:size', updateCanvasSize);
      map.un('moveend', handleMapChange);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 1000,
        }}
      />
    </div>
  );
};

export default LiveMap;
