/**
 * Math utilities for wind visualization
 * All functions are pure and tested
 */

/**
 * Convert degrees to radians
 * @param {number} deg - Angle in degrees
 * @returns {number} Angle in radians
 */
export function degToRad(deg) {
  return deg * Math.PI / 180;
}

/**
 * Convert meteorological wind to u/v components
 * @param {number} speed - Wind speed in m/s
 * @param {number} directionDeg - Meteorological direction (0=from North, 90=from East)
 * @returns {{u: number, v: number}} u (eastward) and v (northward) components in m/s
 */
export function meteoToUV(speed, directionDeg) {
  const D_rad = degToRad(directionDeg);
  const u = -speed * Math.sin(D_rad);
  const v = -speed * Math.cos(D_rad);
  return { u, v };
}

/**
 * Get meters per pixel from OpenLayers view
 * @param {ol.View} view - OpenLayers view object
 * @returns {number} meters per pixel
 */
export function metersPerPixel(view) {
  return view.getResolution();
}

/**
 * Convert u/v velocity (m/s) to pixels per second
 * @param {number} u - Eastward component (m/s)
 * @param {number} v - Northward component (m/s)
 * @param {number} mpp - Meters per pixel
 * @returns {{dx: number, dy: number}} Velocity in pixels/second (note: dy negated for screen coords)
 */
export function uvToPixelsPerSecond(u, v, mpp) {
  const dx = u / mpp;
  const dy = -v / mpp; // Screen Y increases downward
  return { dx, dy };
}

/**
 * Bilinear interpolation
 * @param {number} f00 - Value at (0,0)
 * @param {number} f10 - Value at (1,0)
 * @param {number} f01 - Value at (0,1)
 * @param {number} f11 - Value at (1,1)
 * @param {number} tx - Normalized x coordinate [0,1]
 * @param {number} ty - Normalized y coordinate [0,1]
 * @returns {number} Interpolated value
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
 * @param {number} lon - Longitude in degrees
 * @returns {number} Wrapped longitude
 */
export function wrapLongitude(lon) {
  while (lon < -180) lon += 360;
  while (lon >= 180) lon -= 360;
  return lon;
}

// Shared math utilities

// Minimal math helpers and wind vector conversion

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function kmhToMs(kmh) {
  return kmh / 3.6;
}

// Open-Meteo winddirection_10m (or current_weather.winddirection) is
// meteorological “from” direction in degrees (0 = from north, 90 = from east).
// Convert to “to” direction for motion, then to components.
// Returns eastward u (m/s) and northward v (m/s).
export function dirFromDegSpeedMsToUV(dirFromDeg, speedMs) {
  const dirToDeg = (dirFromDeg + 180) % 360;
  const r = toRad(dirToDeg);
  const u = speedMs * Math.sin(r); // eastward
  const v = speedMs * Math.cos(r); // northward
  return { u, v };
}


