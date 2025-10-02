import express from 'express';

const router = express.Router();

// GET /api/weather/current - Get current weather
router.get('/current', (req, res) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }
  
  // TODO: Implement OpenWeather API integration
  res.json({ success: true, message: 'Weather endpoint (to be implemented)' });
});

// GET /api/weather/forecast - Get weather forecast
router.get('/forecast', (req, res) => {
  const { lat, lon } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }
  
  // TODO: Implement forecast logic
  res.json({ success: true, message: 'Forecast endpoint (to be implemented)' });
});

export default router;