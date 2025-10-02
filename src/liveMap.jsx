import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';

import { clamp, lerp, kmhToMs, dirFromDegSpeedMsToUV } from './lib/math.js';

// Config: conservative defaults
const CONFIG = {
  // Particles
  DENSITY_PER_PIXEL: 0.0016,
  COUNT_MIN: 1000,
  COUNT_MAX: 6000,
  DOT_RADIUS_PX: 0.85,
  COLOR: '#666666',
  SHADOW_COLOR: 'rgba(0,0,0,0.5)',
  SHADOW_BLUR: 1.25,

  // Lifetime/respawn
  LIFE_MIN_S: 1.0,
  LIFE_MAX_S: 2.0,
  VIEW_RESPAWN_PADDING_DEG: 0.0,

  // Wind sampling grid (API-backed)
  GRID_STEP_DEG: 2.0,
  PRIME_MAX_CELLS: 25,
  CACHE_TTL_MS: 10 * 60 * 1000, // 10 minutes

  // Animation
  MAX_DT_S: 0.05,

  // Trails
  TRAIL_FADE_ALPHA_PER_FRAME: 0.08,
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

  // Cache and inflight trackers (may be accidentally mutated elsewhere)
  const windCacheRef = useRef(new Map());
  const inflightRef = useRef(new Set());

  // Ultra-defensive cache/inflight helpers that NEVER call .has() on a bad type
  const cacheHas = (key) => {
    const c = windCacheRef.current;
    if (c && typeof c.has === 'function') return c.has(key);
    if (c && typeof c === 'object') return Object.prototype.hasOwnProperty.call(c, key);
    // repair to Map if totally broken
    windCacheRef.current = new Map();
    return false;
  };
  const cacheGet = (key) => {
    const c = windCacheRef.current;
    if (c && typeof c.get === 'function') return c.get(key);
    if (c && typeof c === 'object') return c[key];
    return undefined;
  };
  const cacheSet = (key, val) => {
    let c = windCacheRef.current;
    if (c && typeof c.set === 'function') {
      c.set(key, val);
      return;
    }
    if (!c || typeof c !== 'object') {
      c = {};
      windCacheRef.current = c;
    }
    c[key] = val;
  };
  const cacheDelete = (key) => {
    const c = windCacheRef.current;
    if (c && typeof c.delete === 'function') return c.delete(key);
    if (c && typeof c === 'object') {
      // eslint-disable-next-line no-prototype-builtins
      if (c.hasOwnProperty(key)) {
        delete c[key];
        return true;
      }
    }
    return false;
  };
  const inflightHas = (key) => {
    const s = inflightRef.current;
    if (s && typeof s.has === 'function') return s.has(key);
    if (Array.isArray(s)) return s.includes(key);
    if (s && typeof s === 'object') return !!s[key];
    inflightRef.current = new Set();
    return false;
  };
  const inflightAdd = (key) => {
    let s = inflightRef.current;
    if (s && typeof s.add === 'function') {
      s.add(key);
      return;
    }
    if (Array.isArray(s)) {
      if (!s.includes(key)) s.push(key);
      return;
    }
    if (!s || typeof s !== 'object') {
      s = new Set();
      inflightRef.current = s;
      s.add(key);
      return;
    }
    s[key] = true;
  };
  const inflightDelete = (key) => {
    const s = inflightRef.current;
    if (s && typeof s.delete === 'function') return s.delete(key);
    if (Array.isArray(s)) {
      const idx = s.indexOf(key);
      if (idx >= 0) s.splice(idx, 1);
      return true;
    }
    if (s && typeof s === 'object') {
      if (s[key]) {
        delete s[key];
        return true;
      }
    }
    return false;
  };

  // Track last zoom to expire particles on zoom end
  const lastZoomRef = useRef(null);

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
    const view = map.getView();
    const extent = view.calculateExtent(map.getSize());
    const minLonLat = toLonLat([extent[0], extent[1]]);
    const maxLonLat = toLonLat([extent[2], extent[3]]);
    const lonMin = Math.min(minLonLat[0], maxLonLat[0]) - CONFIG.VIEW_RESPAWN_PADDING_DEG;
    const lonMax = Math.max(minLonLat[0], maxLonLat[0]) + CONFIG.VIEW_RESPAWN_PADDING_DEG;
    const latMin = Math.min(minLonLat[1], maxLonLat[1]) - CONFIG.VIEW_RESPAWN_PADDING_DEG;
    const latMax = Math.max(minLonLat[1], maxLonLat[1]) + CONFIG.VIEW_RESPAWN_PADDING_DEG;
    return { lonMin, lonMax, latMin, latMax };
  };

  const computeTargetCount = () => {
    const map = mapObjRef.current;
    const viewport = map.getViewport();
    const vw = viewport.clientWidth || 0;
    const vh = viewport.clientHeight || 0;
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
        particles.push({ lon: 0, lat: 0, age: 0, life: 0 });
        respawnParticle(particles[i]);
      }
    } else if (particles.length < target) {
      const toAdd = target - particles.length;
      for (let i = 0; i < toAdd; i++) {
        const p = { lon: 0, lat: 0, age: 0, life: 0 };
        respawnParticle(p);
        particles.push(p);
      }
    } else if (particles.length > target) {
      particles.splice(target);
    }
  };

  // Open-Meteo current weather at cell center -> { u, v } m/s (east, north)
  const fetchWindForCell = async (i, j) => {
    const key = `${i}:${j}`;
    if (cacheHas(key)) return cacheGet(key);
    if (inflightHas(key)) return null;

    inflightAdd(key);
    try {
      const step = CONFIG.GRID_STEP_DEG;
      const lonC = (i + 0.5) * step;
      const latC = (j + 0.5) * step;
      // Clamp lat/lon
      const lat = Math.max(-85, Math.min(85, latC));
      const lon = Math.max(-180, Math.min(180, lonC));
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const res = await fetch(url);
      const data = await res.json();
      const cw = data && data.current_weather;
      if (cw && typeof cw.windspeed === 'number' && typeof cw.winddirection === 'number') {
        const speedMs = kmhToMs(cw.windspeed);
        const { u, v } = dirFromDegSpeedMsToUV(cw.winddirection, speedMs);
        const entry = { ts: Date.now(), u, v };
        cacheSet(key, entry);
        return entry;
      } else {
        const entry = { ts: Date.now(), u: 0, v: 0 };
        cacheSet(key, entry);
        return entry;
      }
    } catch {
      const entry = { ts: Date.now(), u: 0, v: 0 };
      cacheSet(key, entry);
      return entry;
    } finally {
      inflightDelete(key);
    }
  };

  const getCellKey = (lon, lat) => {
    const step = CONFIG.GRID_STEP_DEG;
    const i = Math.floor(lon / step);
    const j = Math.floor(lat / step);
    return { key: `${i}:${j}`, i, j, step };
  };

  // Bilinear sample from four surrounding cells; triggers fetch as needed
  const sampleWindUV = async (lon, lat) => {
    const { i, j, step } = getCellKey(lon, lat);
    const gx = lon / step;
    const gy = lat / step;
    const i0 = Math.floor(gx), i1 = i0 + 1;
    const j0 = Math.floor(gy), j1 = j0 + 1;
    const tx = gx - i0;
    const ty = gy - j0;

    const keys = [
      `${i0}:${j0}`, `${i1}:${j0}`,
      `${i0}:${j1}`, `${i1}:${j1}`
    ];

    const values = new Array(4);
    for (let k = 0; k < 4; k++) {
      const key = keys[k];
      let val = cacheGet(key);
      // Expire stale
      if (val && Date.now() - val.ts > CONFIG.CACHE_TTL_MS) {
        cacheDelete(key);
        val = undefined;
      }
      if (!val) {
        const [ci, cj] = key.split(':').map(Number);
        // Fire-and-forget; nearest available will be used until ready
        fetchWindForCell(ci, cj);
      }
      values[k] = val || null;
    }

    // If all present, do bilinear
    if (values.every(Boolean)) {
      const u00 = values[0].u, u10 = values[1].u, u01 = values[2].u, u11 = values[3].u;
      const v00 = values[0].v, v10 = values[1].v, v01 = values[2].v, v11 = values[3].v;
      const u0 = u00 + (u10 - u00) * tx;
      const u1 = u01 + (u11 - u01) * tx;
      const v0 = v00 + (v10 - v00) * tx;
      const v1 = v01 + (v11 - v01) * tx;
      return { u: u0 + (u1 - u0) * ty, v: v0 + (v1 - v0) * ty };
    }

    // Otherwise return nearest available cell if any
    const nearest = values.find(Boolean);
    if (nearest) return { u: nearest.u, v: nearest.v };

    // No data yet
    return { u: 0, v: 0 };
  };

  // Prefetch a capped set of cells over the view (up to PRIME_MAX_CELLS)
  const primeViewportWind = () => {
    const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
    const step = CONFIG.GRID_STEP_DEG;

    const iMin = Math.floor(lonMin / step);
    const iMax = Math.floor(lonMax / step);
    const jMin = Math.floor(latMin / step);
    const jMax = Math.floor(latMax / step);

    const iCount = Math.max(1, iMax - iMin + 1);
    const jCount = Math.max(1, jMax - jMin + 1);

    // Choose up to ~sqrt(PRIME_MAX_CELLS) samples each way
    const targetPerDim = Math.max(1, Math.floor(Math.sqrt(CONFIG.PRIME_MAX_CELLS)));
    const iStep = Math.max(1, Math.floor(iCount / targetPerDim));
    const jStep = Math.max(1, Math.floor(jCount / targetPerDim));

    let fetched = 0;
    for (let jj = jMin; jj <= jMax; jj += jStep) {
      for (let ii = iMin; ii <= iMax; ii += iStep) {
        if (fetched >= CONFIG.PRIME_MAX_CELLS) break;
        const key = `${ii}:${jj}`;
        if (!cacheHas(key) && !inflightHas(key)) {
          fetchWindForCell(ii, jj);
          fetched++;
        }
      }
      if (fetched >= CONFIG.PRIME_MAX_CELLS) break;
    }
  };

  // Animation loop
  const animate = async (ts) => {
    const map = mapObjRef.current;
    const ctx = ctxRef.current;
    if (!map || !ctx) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = Math.min((ts - lastTimeRef.current) / 1000, CONFIG.MAX_DT_S);
    lastTimeRef.current = ts;

    // Fade for short trails
    const canvas = canvasRef.current;
    ctx.globalCompositeOperation = 'destination-out';
    const alpha = 1 - Math.exp(-CONFIG.TRAIL_FADE_ALPHA_PER_FRAME * (dt / (1 / 60)));
    ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(4)})`;
    ctx.fillRect(0, 0, canvas.width / dprRef.current, canvas.height / dprRef.current);
    ctx.globalCompositeOperation = 'source-over';

    // Visuals
    ctx.shadowColor = CONFIG.SHADOW_COLOR;
    ctx.shadowBlur = CONFIG.SHADOW_BLUR;

    // Advect and draw
    const particles = particlesRef.current;
    ctx.beginPath();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Age and expire
      p.age = (p.age || 0) + dt;
      if (p.age >= p.life) {
        respawnParticle(p);
      }

      // Sample wind (u east, v north) in m/s
      const { u, v } = await sampleWindUV(p.lon, p.lat);

      // Advance in world meters (EPSG:3857)
      const coord3857 = fromLonLat([p.lon, p.lat]);
      const mx = coord3857[0] + u * dt;
      const my = coord3857[1] + v * dt;
      const newLonLat = toLonLat([mx, my]);

      // If new pos is invalid or outside visible view (with tiny tolerance), respawn
      const { lonMin, lonMax, latMin, latMax } = getViewLonLatBounds();
      const out =
        !isFinite(newLonLat[0]) || !isFinite(newLonLat[1]) ||
        newLonLat[0] < lonMin - 0.5 || newLonLat[0] > lonMax + 0.5 ||
        newLonLat[1] < latMin - 0.5 || newLonLat[1] > latMax + 0.5;

      if (out) {
        respawnParticle(p);
        continue;
      }

      p.lon = newLonLat[0];
      p.lat = newLonLat[1];

      const px = map.getPixelFromCoordinate([mx, my]);
      if (!px) continue;
      ctx.moveTo(px[0], px[1]);
      ctx.arc(px[0], px[1], CONFIG.DOT_RADIUS_PX, 0, Math.PI * 2);
    }

    ctx.fillStyle = CONFIG.COLOR;
    ctx.fill();

    // Reset shadow
    ctx.shadowBlur = 0;

    rafRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!mapRef.current) return;

    // Start from clean containers
    windCacheRef.current = new Map();
    inflightRef.current = new Set();

    // Map
    const map = new Map({
      target: mapRef.current,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: [0, 0], zoom: 2 }),
      interactions: defaultInteractions().extend([
        new MouseWheelZoom({ delta: 7, duration: 250, constrainResolution: true }),
      ]),
    });
    mapObjRef.current = map;
    window.map = map;

    // Canvas overlay
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
      primeViewportWind();
    };
    resizeCanvas();
    window.addEventListener('resize', onResize);

    // Particles
    initOrResizeParticles();

    // Prime wind for current view
    primeViewportWind();

    // Expire and respawn all particles on zoom end into the new view
    const onMoveEnd = () => {
      const z = map.getView().getZoom();
      if (lastZoomRef.current === null || z !== lastZoomRef.current) {
        lastZoomRef.current = z;
        const ps = particlesRef.current;
        for (let k = 0; k < ps.length; k++) {
          ps[k].age = ps[k].life; // expire immediately so they respawn in-view
        }
        primeViewportWind();
      } else {
        primeViewportWind();
      }
    };
    map.on('moveend', onMoveEnd);

    // Start
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
      window.removeEventListener('resize', onResize);
      map.un('moveend', onMoveEnd);
      if (canvasRef.current && canvasRef.current.parentElement) {
        canvasRef.current.parentElement.removeChild(canvasRef.current);
      }
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