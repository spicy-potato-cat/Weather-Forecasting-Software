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

// GET /api/user/locations - Get saved locations
router.get('/locations', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM saved_locations WHERE user_id = $1 ORDER BY created_at DESC',
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

    const result = await query(
      `INSERT INTO saved_locations (user_id, location_name, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, location_name, latitude, longitude]
    );

    res.status(201).json({
      success: true,
      message: 'Location saved successfully',
      location: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/user/locations/:id - Remove saved location
router.delete('/locations/:id', authenticate, async (req, res, next) => {
  try {
    await query(
      'DELETE FROM saved_locations WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Location removed successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;