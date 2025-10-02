/* eslint-disable no-restricted-globals */
/*
  Wind grid worker.

  provider: 'auto' (use API if configured) | 'procedural'
  This is wired to support real API-backed grids for u/v (m/s) on a lon/lat grid.
  To hook your real data, implement fetchWindGridAPI() to return:
  {
    lonMin, lonMax, latMin, latMax,
    dLon, dLat,
    w, h,
    u: Float32Array, // eastward m/s, length w*h
    v: Float32Array, // northward m/s, length w*h
  }
*/

async function fetchWindGridAPI({ lonMin, lonMax, latMin, latMax, gridDeg }) {
  // TODO: Replace with your real API.
  // Expected: a JSON endpoint you control that returns u,v on a grid for the bbox and spacing.
  // Example shape:
  // const res = await fetch(`${API_BASE}/wind-grid?lonMin=${lonMin}&lonMax=${lonMax}&latMin=${latMin}&latMax=${latMax}&step=${gridDeg}`);
  // const json = await res.json();
  // return jsonToField(json);
  throw new Error('No real wind API configured');
}

function buildProcedural({ lonMin, lonMax, latMin, latMax, gridDeg }) {
  const dLon = gridDeg;
  const dLat = gridDeg;
  const w = Math.max(2, Math.floor((lonMax - lonMin) / dLon) + 1);
  const h = Math.max(2, Math.floor((latMax - latMin) / dLat) + 1);
  const u = new Float32Array(w * h);
  const v = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const lat = latMin + j * dLat;
    for (let i = 0; i < w; i++) {
      const lon = lonMin + i * dLon;
      const idx = j * w + i;
      const s = Math.sin((lon / 180) * Math.PI * 2) * Math.cos((lat / 90) * Math.PI);
      const c = Math.cos((lon / 90) * Math.PI) * Math.sin((lat / 45) * Math.PI);
      u[idx] = 6 + 2.5 * s; // a bit stronger to keep visibility
      v[idx] = 2.2 * c;
    }
  }
  return { lonMin, lonMax, latMin, latMax, dLon, dLat, w, h, u, v };
}

self.onmessage = async (ev) => {
  const { type, provider = 'auto', lonMin, lonMax, latMin, latMax, gridDeg } = ev.data || {};
  if (type !== 'build') return;

  let payload = null;

  if (provider === 'auto') {
    try {
      payload = await fetchWindGridAPI({ lonMin, lonMax, latMin, latMax, gridDeg });
    } catch {
      payload = buildProcedural({ lonMin, lonMax, latMin, latMax, gridDeg });
    }
  } else if (provider === 'procedural') {
    payload = buildProcedural({ lonMin, lonMax, latMin, latMax, gridDeg });
  } else {
    payload = buildProcedural({ lonMin, lonMax, latMin, latMax, gridDeg });
  }

  try {
    // Transfer buffers for perf
    self.postMessage({ type: 'grid', payload }, [payload.u.buffer, payload.v.buffer]);
  } catch {
    // Fallback if transfer fails
    self.postMessage({ type: 'grid', payload });
  }
};