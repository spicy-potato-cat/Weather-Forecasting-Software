import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

// GET /api/user/profile - Get user profile (protected)
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/user/profile - Update user profile (protected)
router.put('/profile', authenticate, (req, res) => {
  // TODO: Implement update profile logic
  res.json({ success: true, message: 'Update profile endpoint (to be implemented)' });
});

// GET /api/user/preferences - Get user preferences
router.get('/preferences', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      preferences: result.rows[0] || null
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/user/preferences - Update user preferences
router.put('/preferences', authenticate, async (req, res, next) => {
  try {
    const {
      preferred_location,
      temperature_unit,
      wind_speed_unit,
      pressure_unit,
      precipitation_unit,
      time_format,
      theme,
      notifications_enabled
    } = req.body;

    const result = await query(
      `INSERT INTO user_preferences 
        (user_id, preferred_location, temperature_unit, wind_speed_unit, pressure_unit, precipitation_unit, time_format, theme, notifications_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id) 
       DO UPDATE SET
         preferred_location = EXCLUDED.preferred_location,
         temperature_unit = EXCLUDED.temperature_unit,
         wind_speed_unit = EXCLUDED.wind_speed_unit,
         pressure_unit = EXCLUDED.pressure_unit,
         precipitation_unit = EXCLUDED.precipitation_unit,
         time_format = EXCLUDED.time_format,
         theme = EXCLUDED.theme,
         notifications_enabled = EXCLUDED.notifications_enabled,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, preferred_location, temperature_unit, wind_speed_unit, pressure_unit, precipitation_unit, time_format, theme, notifications_enabled]
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/user/locations - Get saved locations (ordered by rank)
router.get('/locations', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM saved_locations WHERE user_id = $1 ORDER BY rank ASC, created_at DESC',
      [req.user.id]
    );

    res.json({
      success: true,
      locations: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/user/locations - Add saved location
router.post('/locations', authenticate, async (req, res, next) => {
  try {
    const { location_name, latitude, longitude } = req.body;

    // Validate required fields
    if (!location_name || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: location_name, latitude, longitude'
      });
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid latitude or longitude'
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        success: false,
        message: 'Latitude must be between -90 and 90, longitude between -180 and 180'
      });
    }

    // Check for duplicate location
    const duplicateCheck = await query(
      'SELECT id FROM saved_locations WHERE user_id = $1 AND latitude = $2 AND longitude = $3',
      [req.user.id, lat, lon]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This location is already saved'
      });
    }

    // Get the highest rank for this user
    const rankResult = await query(
      'SELECT COALESCE(MAX(rank), -1) as max_rank FROM saved_locations WHERE user_id = $1',
      [req.user.id]
    );

    const newRank = rankResult.rows[0].max_rank + 1;

    // Insert new location
    const result = await query(
      `INSERT INTO saved_locations (user_id, location_name, latitude, longitude, rank)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, location_name, lat, lon, newRank]
    );

    console.log(`✅ Location saved: ${location_name} (${lat}, ${lon}) - Rank: ${newRank}`);

    res.status(201).json({
      success: true,
      message: 'Location saved successfully',
      location: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving location:', error);
    next(error);
  }
});

// PUT /api/user/locations/reorder - Reorder locations
router.put('/locations/reorder', authenticate, async (req, res, next) => {
  try {
    const { locationIds } = req.body;

    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'locationIds must be a non-empty array'
      });
    }

    // Update ranks for all locations in a transaction-like manner
    const updatePromises = locationIds.map((id, index) =>
      query(
        'UPDATE saved_locations SET rank = $1 WHERE id = $2 AND user_id = $3',
        [index, id, req.user.id]
      )
    );

    await Promise.all(updatePromises);

    console.log(`✅ Reordered ${locationIds.length} locations for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Locations reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering locations:', error);
    next(error);
  }
});

// DELETE /api/user/locations/:id - Remove saved location
router.delete('/locations/:id', authenticate, async (req, res, next) => {
  try {
    const locationId = parseInt(req.params.id);

    if (isNaN(locationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location ID'
      });
    }

    const result = await query(
      'DELETE FROM saved_locations WHERE id = $1 AND user_id = $2 RETURNING *',
      [locationId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    console.log(`✅ Location deleted: ${result.rows[0].location_name}`);

    res.json({
      success: true,
      message: 'Location removed successfully'
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    next(error);
  }
});

export default router;