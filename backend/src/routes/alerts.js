import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import alertEngine from '../services/alertEngine.js';
import emailService from '../services/emailService.js';

const router = express.Router();

// Get active alerts
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC LIMIT 50`
    );
    
    res.json({
      success: true,
      alerts: result.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Simulate alert (testing only)
router.post('/simulate', authenticate, async (req, res) => {
  try {
    const { hazard_type, severity, cell_key, details } = req.body;
    
    const alert = await alertEngine.createAlert({
      hazard_type,
      severity,
      score: severity === 'EMERGENCY' ? 90 : 70,
      cellKey: cell_key,
      details
    });
    
    res.json({
      success: true,
      alert
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Subscribe to alerts
router.post('/subscribe', async (req, res) => {
  try {
    const { email, locations, hazards = ['FLOOD', 'WIND', 'HEAT'] } = req.body;
    
    const result = await query(
      `INSERT INTO alert_subscriptions (email, locations, hazards, opted_in)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET locations = $2, hazards = $3, opted_in = TRUE
       RETURNING *`,
      [email, JSON.stringify(locations), JSON.stringify(hazards)]
    );
    
    res.json({
      success: true,
      subscription: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;