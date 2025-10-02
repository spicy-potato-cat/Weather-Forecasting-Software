/**
 * Math utilities for wind visualization
 */

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function kmhToMs(kmh) {
  return kmh / 3.6;
}

/**
 * Convert meteorological wind direction (from-direction) and speed to u/v components
 * @param {number} speed - Wind speed in m/s
 * @param {number} directionDeg - Meteorological "from" direction (0° = from North, 90° = from East)
 * @returns {{u: number, v: number}} u (eastward) and v (northward) in m/s
 */
export function meteoToUV(speed, directionDeg) {
  // Meteorological direction is "from" — convert to "to" direction
  const toDirectionDeg = (directionDeg + 180) % 360;
  const rad = degToRad(toDirectionDeg);
  
  // u = eastward component, v = northward component
  const u = speed * Math.sin(rad);
  const v = speed * Math.cos(rad);
  
  return { u, v };
}

/**
 * Bilinear interpolation
 */
export function bilinearInterpolate(f00, f10, f01, f11, tx, ty) {
  const c00 = f00 * (1 - tx) * (1 - ty);
  const c10 = f10 * tx * (1 - ty);
  const c01 = f01 * (1 - tx) * ty;
  const c11 = f11 * tx * ty;
  return c00 + c10 + c01 + c11;
}

/**
 * Wrap longitude to [-180, 180)
 */
export function wrapLongitude(lon) {
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
}