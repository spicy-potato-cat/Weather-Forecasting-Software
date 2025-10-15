import { query } from '../config/database.js';

// Threshold configurations (tunable per region)
const THRESHOLDS = {
  FLOOD: {
    EMERGENCY: { rate_mm_hr: 50, accum_6h_mm: 100 },
    WARNING: { rate_mm_hr: 25, accum_6h_mm: 50 },
    WATCH: { rate_mm_hr: 10, accum_6h_mm: 25 }
  },
  WIND: {
    EMERGENCY: { sustained_ms: 25, gust_ms: 33 },
    WARNING: { sustained_ms: 18, gust_ms: 25 },
    WATCH: { sustained_ms: 10, gust_ms: 15 }
  },
  HEAT: {
    EMERGENCY: { temp_c: 45, duration_hours: 48 },
    WARNING: { temp_c: 40, duration_hours: 24 },
    WATCH: { temp_c: 35, duration_hours: 12 }
  }
};

class AlertEngine {
  async evaluateCell(cellKey, weatherData) {
    const alerts = [];
    
    // Check flood risk
    const floodAlert = this.checkFlood(cellKey, weatherData);
    if (floodAlert) alerts.push(floodAlert);
    
    // Check wind risk
    const windAlert = this.checkWind(cellKey, weatherData);
    if (windAlert) alerts.push(windAlert);
    
    // Check heat risk
    const heatAlert = this.checkHeat(cellKey, weatherData);
    if (heatAlert) alerts.push(heatAlert);
    
    return alerts;
  }

  checkFlood(cellKey, data) {
    const { precipitation_rate, precipitation_6h } = data;
    
    if (precipitation_rate >= THRESHOLDS.FLOOD.EMERGENCY.rate_mm_hr ||
        precipitation_6h >= THRESHOLDS.FLOOD.EMERGENCY.accum_6h_mm) {
      return {
        hazard_type: 'FLOOD',
        severity: 'EMERGENCY',
        score: 90,
        cellKey,
        details: `Heavy rainfall: ${precipitation_rate} mm/hr, 6h total: ${precipitation_6h} mm`
      };
    }
    
    if (precipitation_rate >= THRESHOLDS.FLOOD.WARNING.rate_mm_hr ||
        precipitation_6h >= THRESHOLDS.FLOOD.WARNING.accum_6h_mm) {
      return {
        hazard_type: 'FLOOD',
        severity: 'WARNING',
        score: 70,
        cellKey,
        details: `Moderate rainfall: ${precipitation_rate} mm/hr, 6h total: ${precipitation_6h} mm`
      };
    }
    
    if (precipitation_rate >= THRESHOLDS.FLOOD.WATCH.rate_mm_hr) {
      return {
        hazard_type: 'FLOOD',
        severity: 'WATCH',
        score: 40,
        cellKey,
        details: `Rainfall: ${precipitation_rate} mm/hr`
      };
    }
    
    return null;
  }

  checkWind(cellKey, data) {
    const { wind_speed, wind_gust } = data;
    
    if (wind_speed >= THRESHOLDS.WIND.EMERGENCY.sustained_ms ||
        wind_gust >= THRESHOLDS.WIND.EMERGENCY.gust_ms) {
      return {
        hazard_type: 'WIND',
        severity: 'EMERGENCY',
        score: 85,
        cellKey,
        details: `Extreme winds: ${wind_speed} m/s sustained, gusts ${wind_gust} m/s`
      };
    }
    
    if (wind_speed >= THRESHOLDS.WIND.WARNING.sustained_ms ||
        wind_gust >= THRESHOLDS.WIND.WARNING.gust_ms) {
      return {
        hazard_type: 'WIND',
        severity: 'WARNING',
        score: 65,
        cellKey,
        details: `High winds: ${wind_speed} m/s sustained, gusts ${wind_gust} m/s`
      };
    }
    
    return null;
  }

  checkHeat(cellKey, data) {
    const { temperature } = data;
    
    if (temperature >= THRESHOLDS.HEAT.WARNING.temp_c) {
      return {
        hazard_type: 'HEAT',
        severity: 'WARNING',
        score: 75,
        cellKey,
        details: `Extreme heat: ${temperature}°C`
      };
    }
    
    return null;
  }

  async createAlert(alertData) {
    const result = await query(
      `INSERT INTO alerts (hazard_type, severity, score, cell_key, details, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW())
       RETURNING *`,
      [alertData.hazard_type, alertData.severity, alertData.score, alertData.cellKey, alertData.details]
    );
    
    return result.rows[0];
  }
}

export default new AlertEngine();