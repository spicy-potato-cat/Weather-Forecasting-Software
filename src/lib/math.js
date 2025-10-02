/**
 * Math utilities for weather visualization
 */

/**
 * Convert meteorological wind direction and speed to u/v components
 * Meteorological convention: direction is where wind comes FROM
 * @param {number} speed - Wind speed in m/s
 * @param {number} directionDeg - Direction wind comes from (0=North, 90=East)
 * @returns {{u: number, v: number}} u (eastward) and v (northward) in m/s
 */
export function meteoToUV(speed, directionDeg) {
  // Convert "from" to "to" direction (where particle moves)
  const motionDeg = (directionDeg + 180) % 360;
  const radians = (motionDeg * Math.PI) / 180;
  
  // u = eastward, v = northward
  const u = speed * Math.sin(radians);
  const v = speed * Math.cos(radians);
  
  return { u, v };
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Bilinear interpolation
 * @param {number} x - X coordinate (0-1)
 * @param {number} y - Y coordinate (0-1)
 * @param {number} v00 - Value at (0,0)
 * @param {number} v10 - Value at (1,0)
 * @param {number} v01 - Value at (0,1)
 * @param {number} v11 - Value at (1,1)
 * @returns {number} Interpolated value
 */
export function bilinear(x, y, v00, v10, v01, v11) {
  const v0 = lerp(v00, v10, x);
  const v1 = lerp(v01, v11, x);
  return lerp(v0, v1, y);
}
