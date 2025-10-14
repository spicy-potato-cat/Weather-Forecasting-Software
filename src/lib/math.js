/**
 * Math utilities for weather calculations and unit conversions
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

/**
 * Convert Celsius to Fahrenheit
 */
export function celsiusToFahrenheit(celsius) {
  return (celsius * 9/5) + 32;
}

/**
 * Convert Celsius to Kelvin
 */
export function celsiusToKelvin(celsius) {
  return celsius + 273.15;
}

/**
 * Convert Fahrenheit to Celsius
 */
export function fahrenheitToCelsius(fahrenheit) {
  return (fahrenheit - 32) * 5/9;
}

/**
 * Convert Kelvin to Celsius
 */
export function kelvinToCelsius(kelvin) {
  return kelvin - 273.15;
}

/**
 * Convert temperature from Celsius to target unit
 */
export function convertTemperature(celsius, targetUnit) {
  if (!celsius || isNaN(celsius)) return null;
  
  switch (targetUnit) {
    case 'fahrenheit':
      return celsiusToFahrenheit(celsius);
    case 'kelvin':
      return celsiusToKelvin(celsius);
    case 'celsius':
    default:
      return celsius;
  }
}

/**
 * Get temperature unit symbol
 */
export function getTemperatureSymbol(unit) {
  switch (unit) {
    case 'fahrenheit':
      return '°F';
    case 'kelvin':
      return 'K';
    case 'celsius':
    default:
      return '°C';
  }
}

// ============================================================================
// WIND SPEED CONVERSIONS
// ============================================================================

/**
 * Convert m/s to km/h
 */
export function msToKmh(ms) {
  return ms * 3.6;
}

/**
 * Convert m/s to mph
 */
export function msToMph(ms) {
  return ms * 2.23694;
}

/**
 * Convert m/s to knots
 */
export function msToKnots(ms) {
  return ms * 1.94384;
}

/**
 * Convert wind speed from m/s to target unit
 */
export function convertWindSpeed(ms, targetUnit) {
  if (!ms || isNaN(ms)) return null;
  
  switch (targetUnit) {
    case 'mph':
      return msToMph(ms);
    case 'knots':
      return msToKnots(ms);
    case 'ms':
      return ms;
    case 'kmh':
    default:
      return msToKmh(ms);
  }
}

/**
 * Get wind speed unit symbol
 */
export function getWindSpeedSymbol(unit) {
  switch (unit) {
    case 'mph':
      return 'mph';
    case 'knots':
      return 'knots';
    case 'ms':
      return 'm/s';
    case 'kmh':
    default:
      return 'km/h';
  }
}

// ============================================================================
// PRESSURE CONVERSIONS
// ============================================================================

/**
 * Convert hPa to mb (1:1 conversion)
 */
export function hpaToMb(hpa) {
  return hpa;
}

/**
 * Convert hPa to inHg
 */
export function hpaToInHg(hpa) {
  return hpa * 0.02953;
}

/**
 * Convert hPa to mmHg
 */
export function hpaToMmHg(hpa) {
  return hpa * 0.750062;
}

/**
 * Convert pressure from hPa to target unit
 */
export function convertPressure(hpa, targetUnit) {
  if (!hpa || isNaN(hpa)) return null;
  
  switch (targetUnit) {
    case 'mb':
      return hpaToMb(hpa);
    case 'inhg':
      return hpaToInHg(hpa);
    case 'mmhg':
      return hpaToMmHg(hpa);
    case 'hpa':
    default:
      return hpa;
  }
}

/**
 * Get pressure unit symbol
 */
export function getPressureSymbol(unit) {
  switch (unit) {
    case 'mb':
      return 'mb';
    case 'inhg':
      return 'inHg';
    case 'mmhg':
      return 'mmHg';
    case 'hpa':
    default:
      return 'hPa';
  }
}

// ============================================================================
// PRECIPITATION CONVERSIONS
// ============================================================================

/**
 * Convert mm to inches
 */
export function mmToInches(mm) {
  return mm * 0.0393701;
}

/**
 * Convert inches to mm
 */
export function inchesToMm(inches) {
  return inches * 25.4;
}

/**
 * Convert precipitation from mm to target unit
 */
export function convertPrecipitation(mm, targetUnit) {
  if (!mm || isNaN(mm)) return null;
  
  switch (targetUnit) {
    case 'inches':
      return mmToInches(mm);
    case 'mm':
    default:
      return mm;
  }
}

/**
 * Get precipitation unit symbol
 */
export function getPrecipitationSymbol(unit) {
  switch (unit) {
    case 'inches':
      return 'in';
    case 'mm':
    default:
      return 'mm';
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format temperature with unit
 */
export function formatTemperature(celsius, unit, decimals = 1) {
  const converted = convertTemperature(celsius, unit);
  if (converted === null) return '--';
  return `${converted.toFixed(decimals)}${getTemperatureSymbol(unit)}`;
}

/**
 * Format wind speed with unit
 */
export function formatWindSpeed(ms, unit, decimals = 1) {
  const converted = convertWindSpeed(ms, unit);
  if (converted === null) return '--';
  return `${converted.toFixed(decimals)} ${getWindSpeedSymbol(unit)}`;
}

/**
 * Format pressure with unit
 */
export function formatPressure(hpa, unit, decimals = 1) {
  const converted = convertPressure(hpa, unit);
  if (converted === null) return '--';
  return `${converted.toFixed(decimals)} ${getPressureSymbol(unit)}`;
}

/**
 * Format precipitation with unit
 */
export function formatPrecipitation(mm, unit, decimals = 1) {
  const converted = convertPrecipitation(mm, unit);
  if (converted === null) return '--';
  return `${converted.toFixed(decimals)} ${getPrecipitationSymbol(unit)}`;
}


