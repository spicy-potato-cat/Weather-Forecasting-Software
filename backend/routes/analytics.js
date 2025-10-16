import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * Fetch historical weather data from Open-Meteo
 * Free tier: No API key needed, up to 10,000 requests/day
 */
const fetchOpenMeteoHistorical = async (lat, lon, startDate, endDate) => {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?` +
      `latitude=${lat}&` +
      `longitude=${lon}&` +
      `start_date=${startDate}&` +
      `end_date=${endDate}&` +
      `daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,` +
      `precipitation_sum,rain_sum,snowfall_sum,` +
      `windspeed_10m_max,windgusts_10m_max,` +
      `winddirection_10m_dominant,` +
      `shortwave_radiation_sum,et0_fao_evapotranspiration&` +
      `timezone=auto`;

    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`Open-Meteo API error: ${res.status}`);
    }

    const data = await res.json();
    
    return {
      source: 'Open-Meteo',
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
        elevation: data.elevation,
        timezone: data.timezone,
      },
      data: formatOpenMeteoData(data),
    };
  } catch (err) {
    throw new Error(`Open-Meteo fetch failed: ${err.message}`);
  }
};

/**
 * Format Open-Meteo historical data
 */
const formatOpenMeteoData = (rawData) => {
  const { daily } = rawData;
  const records = [];

  for (let i = 0; i < daily.time.length; i++) {
    records.push({
      date: daily.time[i],
      temp_max_c: daily.temperature_2m_max?.[i],
      temp_min_c: daily.temperature_2m_min?.[i],
      temp_mean_c: daily.temperature_2m_mean?.[i],
      precipitation_mm: daily.precipitation_sum?.[i],
      rain_mm: daily.rain_sum?.[i],
      snowfall_cm: daily.snowfall_sum?.[i],
      wind_speed_max_kmh: daily.windspeed_10m_max?.[i],
      wind_gusts_kmh: daily.windgusts_10m_max?.[i],
      wind_direction_deg: daily.winddirection_10m_dominant?.[i],
      solar_radiation_mj: daily.shortwave_radiation_sum?.[i],
      evapotranspiration_mm: daily.et0_fao_evapotranspiration?.[i],
    });
  }

  return records;
};

/**
 * Convert data to CSV format
 */
const convertToCSV = (data, location) => {
  if (!data || data.length === 0) {
    return '';
  }

  // CSV Header
  const headers = Object.keys(data[0]).join(',');
  
  // Metadata
  const metadata = [
    `# Historical Weather Data`,
    `# Location: ${location.latitude}, ${location.longitude}`,
    `# Elevation: ${location.elevation}m`,
    `# Timezone: ${location.timezone}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Source: Open-Meteo Archive API`,
    `#`,
  ].join('\n');

  // Data rows
  const rows = data.map(row => {
    return Object.values(row).map(value => {
      // Handle null/undefined values
      if (value === null || value === undefined) return '';
      // Escape commas in strings
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    }).join(',');
  });

  return `${metadata}\n${headers}\n${rows.join('\n')}`;
};

// ========================================
// ANALYST ROUTES
// ========================================

// POST /api/analytics/historical
router.post('/historical',
  authenticate,
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('start_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid start_date format (YYYY-MM-DD)'),
    body('end_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid end_date format (YYYY-MM-DD)'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const { latitude, longitude, start_date, end_date } = req.body;

      // Validate date range (max 2 years)
      const start = new Date(start_date);
      const end = new Date(end_date);
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);

      if (daysDiff < 0) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      if (daysDiff > 730) {
        return res.status(400).json({
          success: false,
          message: 'Date range cannot exceed 2 years'
        });
      }

      // Fetch historical data
      const historicalData = await fetchOpenMeteoHistorical(
        latitude,
        longitude,
        start_date,
        end_date
      );

      console.log(`✅ Historical data fetched for ${latitude},${longitude} (${start_date} to ${end_date})`);

      res.json({
        success: true,
        ...historicalData,
        record_count: historicalData.data.length,
      });

    } catch (error) {
      console.error('Historical data fetch error:', error);
      next(error);
    }
  }
);

// POST /api/analytics/export-csv
router.post('/export-csv',
  authenticate,
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('start_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid start_date format'),
    body('end_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Invalid end_date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const { latitude, longitude, start_date, end_date, location_name } = req.body;

      // Fetch historical data
      const historicalData = await fetchOpenMeteoHistorical(
        latitude,
        longitude,
        start_date,
        end_date
      );

      // Convert to CSV
      const csv = convertToCSV(historicalData.data, historicalData.location);

      // Generate filename
      const filename = `weather_${location_name || 'location'}_${start_date}_${end_date}.csv`
        .replace(/[^a-z0-9_.-]/gi, '_');

      console.log(`✅ CSV export generated: ${filename} (${historicalData.data.length} records)`);

      // Send CSV file
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);

    } catch (error) {
      console.error('CSV export error:', error);
      next(error);
    }
  }
);

// GET /api/analytics/locations (get user's analyzed locations)
router.get('/locations',
  authenticate,
  async (req, res, next) => {
    try {
      // This would fetch from a saved_analytics table if you want to track user's analysis history
      // For now, just return empty array
      res.json({
        success: true,
        locations: []
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;