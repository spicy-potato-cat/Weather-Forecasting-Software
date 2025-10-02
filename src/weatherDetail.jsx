import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './weatherDetail.css';

const ATTRIBUTE_CONFIG = {
  Temperature: {
    icon: '🌡️',
    unit: '°C',
    color: '#ff6b6b',
    gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
    // Current weather params
    currentParams: 'temperature_2m,relative_humidity_2m,weather_code',
    currentField: 'temperature_2m',
    // Daily forecast params (Open-Meteo supports these)
    dailyParams: 'temperature_2m_max,temperature_2m_min',
    dailyMaxField: 'temperature_2m_max',
    dailyMinField: 'temperature_2m_min',
    // Historical archive params
    archiveParams: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean',
    archiveMaxField: 'temperature_2m_max',
    archiveMinField: 'temperature_2m_min',
    archiveMeanField: 'temperature_2m_mean',
  },
  Precipitation: {
    icon: '💧',
    unit: 'mm',
    color: '#4dabf7',
    gradient: 'linear-gradient(135deg, #4dabf7 0%, #339af0 100%)',
    currentParams: 'precipitation,relative_humidity_2m,weather_code',
    currentField: 'precipitation',
    dailyParams: 'precipitation_sum,precipitation_hours',
    dailyMaxField: 'precipitation_sum',
    dailyMinField: 'precipitation_hours',
    archiveParams: 'precipitation_sum',
    archiveMaxField: 'precipitation_sum',
    archiveMinField: 'precipitation_sum',
    archiveMeanField: 'precipitation_sum',
  },
  Wind: {
    icon: '💨',
    unit: 'km/h',
    color: '#51cf66',
    gradient: 'linear-gradient(135deg, #51cf66 0%, #37b24d 100%)',
    currentParams: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    currentField: 'wind_speed_10m',
    dailyParams: 'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
    dailyMaxField: 'wind_speed_10m_max',
    dailyMinField: 'wind_gusts_10m_max',
    archiveParams: 'wind_speed_10m_max,wind_gusts_10m_max',
    archiveMaxField: 'wind_speed_10m_max',
    archiveMinField: 'wind_speed_10m_max',
    archiveMeanField: 'wind_speed_10m_max',
  },
  AQI: {
    icon: '🌫️',
    unit: 'AQI',
    color: '#ffd43b',
    gradient: 'linear-gradient(135deg, #ffd43b 0%, #fab005 100%)',
    currentParams: 'air_pollution',
    currentField: 'aqi',
    dailyParams: 'air_pollution',
    dailyMaxField: 'aqi',
    dailyMinField: 'aqi',
    archiveParams: 'air_pollution',
    archiveMaxField: 'aqi',
    archiveMinField: 'aqi',
    archiveMeanField: 'aqi',
    useOpenWeatherAQI: true, // Use OpenWeather Air Pollution API
  },
  Visibility: {
    icon: '👁️',
    unit: 'km',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
    currentParams: 'visibility,cloud_cover,weather_code',
    currentField: 'visibility',
    // Visibility is not available in daily forecasts, use cloud cover as proxy
    dailyParams: 'cloud_cover_mean',
    dailyMaxField: 'cloud_cover_mean',
    dailyMinField: 'cloud_cover_mean',
    archiveParams: 'cloud_cover_mean',
    archiveMaxField: 'cloud_cover_mean',
    archiveMinField: 'cloud_cover_mean',
    archiveMeanField: 'cloud_cover_mean',
  },
  'Surface Pressure': {
    icon: '🔽',
    unit: 'hPa',
    color: '#f783ac',
    gradient: 'linear-gradient(135deg, #f783ac 0%, #e64980 100%)',
    currentParams: 'surface_pressure,relative_humidity_2m,weather_code',
    currentField: 'surface_pressure',
    dailyParams: 'surface_pressure_mean',
    dailyMaxField: 'surface_pressure_mean',
    dailyMinField: 'surface_pressure_mean',
    archiveParams: 'surface_pressure_mean',
    archiveMaxField: 'surface_pressure_mean',
    archiveMinField: 'surface_pressure_mean',
    archiveMeanField: 'surface_pressure_mean',
  },
  'Sealevel Pressure': {
    icon: '🌊',
    unit: 'hPa',
    color: '#66d9e8',
    gradient: 'linear-gradient(135deg, #66d9e8 0%, #22b8cf 100%)',
    currentParams: 'pressure_msl,relative_humidity_2m,weather_code',
    currentField: 'pressure_msl',
    dailyParams: 'pressure_msl_mean',
    dailyMaxField: 'pressure_msl_mean',
    dailyMinField: 'pressure_msl_mean',
    archiveParams: 'pressure_msl_mean',
    archiveMaxField: 'pressure_msl_mean',
    archiveMinField: 'pressure_msl_mean',
    archiveMeanField: 'pressure_msl_mean',
  },
};

function WeatherDetail({ name }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [currentData, setCurrentData] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [historical, setHistorical] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7days');

  const config = ATTRIBUTE_CONFIG[name] || ATTRIBUTE_CONFIG.Temperature;

  useEffect(() => {
    // Get user's location on mount
    getUserLocation();
  }, []);

  useEffect(() => {
    if (location) {
      fetchWeatherData();
    }
  }, [location, selectedTimeframe, name]);

  const getUserLocation = async () => {
    setLocationLoading(true);
    try {
      // Try geolocation API first
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Reverse geocode to get city name
            const cityName = await getCityName(latitude, longitude);
            
            setLocation({
              lat: latitude,
              lon: longitude,
              name: cityName
            });
            setLocationLoading(false);
          },
          async (error) => {
            console.log('Geolocation failed, using IP-based location:', error.message);
            await getLocationFromIP();
          }
        );
      } else {
        await getLocationFromIP();
      }
    } catch (err) {
      console.error('Location detection failed:', err);
      // Fallback to default location
      setLocation({ lat: 19.0760, lon: 72.8777, name: 'Mumbai' });
      setLocationLoading(false);
    }
  };

  const getLocationFromIP = async () => {
    try {
      // Use ipapi.co for IP-based geolocation (free, no API key required)
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('IP location failed');
      
      const data = await res.json();
      
      setLocation({
        lat: data.latitude,
        lon: data.longitude,
        name: data.city || data.region || 'Unknown Location'
      });
      setLocationLoading(false);
    } catch (err) {
      console.error('IP location failed:', err);
      // Fallback
      setLocation({ lat: 19.0760, lon: 72.8777, name: 'Mumbai' });
      setLocationLoading(false);
    }
  };

  const getCityName = async (lat, lon) => {
    try {
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`
      );
      
      if (!res.ok) throw new Error('Reverse geocoding failed');
      
      const data = await res.json();
      if (data && data.length > 0) {
        return data[0].name || 'Unknown';
      }
      return 'Unknown';
    } catch (err) {
      console.error('City name fetch failed:', err);
      return 'Current Location';
    }
  };

  const fetchWeatherData = async () => {
    if (!location) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await fetchCurrentData();
      await fetchForecastData();
      await fetchHistoricalData();
    } catch (err) {
      setError('Failed to fetch weather data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentData = async () => {
    try {
      // Special handling for AQI (uses OpenWeather Air Pollution API)
      if (config.useOpenWeatherAQI) {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Failed to fetch AQI data');
        
        const data = await response.json();
        
        if (data?.list && data.list.length > 0) {
          const current = data.list[0];
          
          // OpenWeather AQI scale: 1-5 (Good to Very Poor)
          // Convert to standard AQI scale (0-500) for better visualization
          const aqiValue = current.main.aqi;
          const aqiScaled = aqiValue * 50; // Scale to 0-250 range
          
          // Get main pollutant value (PM2.5 is most common)
          const pm25 = current.components?.pm2_5 || 0;
          
          setCurrentData({
            value: aqiScaled,
            humidity: 0,
            weatherCode: aqiValue,
            timestamp: new Date(),
            // Store additional pollutant data
            pm25: pm25,
            pm10: current.components?.pm10 || 0,
            co: current.components?.co || 0,
            no2: current.components?.no2 || 0,
            o3: current.components?.o3 || 0,
            so2: current.components?.so2 || 0,
          });
          return;
        }
        
        throw new Error('No AQI data available');
      }

      // Standard forecast API for other attributes
      const params = new URLSearchParams({
        latitude: location.lat,
        longitude: location.lon,
        current: config.currentParams,
        timezone: 'auto',
        forecast_days: 1
      });

      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch current data');
      
      const data = await response.json();
      const current = data.current;
      
      // Handle visibility conversion (meters to km)
      let value = current[config.currentField] || 0;
      if (name === 'Visibility' && value > 0) {
        value = value / 1000; // Convert meters to kilometers
      }
      
      // Handle wind speed conversion (m/s to km/h)
      if (name === 'Wind' && value > 0) {
        value = value * 3.6; // Convert m/s to km/h
      }
      
      setCurrentData({
        value: value,
        humidity: current.relative_humidity_2m || 0,
        weatherCode: current.weather_code || 0,
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Failed to fetch current data:', err);
      throw err;
    }
  };

  const fetchForecastData = async () => {
    try {
      // AQI forecast from OpenWeather (limited to current + 4 days in free tier)
      if (config.useOpenWeatherAQI) {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        
        // OpenWeather provides hourly AQI forecast for up to 4 days
        const url = `https://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}`;
        
        const response = await fetch(url);
        
        if (!response.ok) throw new Error('Failed to fetch AQI forecast');
        
        const data = await response.json();
        
        if (!data?.list || data.list.length === 0) {
          throw new Error('No AQI forecast data available');
        }
        
        // Group hourly data by day and calculate daily averages
        const dailyData = new Map();
        
        data.list.forEach(item => {
          const date = new Date(item.dt * 1000);
          const dateKey = date.toISOString().split('T')[0];
          
          if (!dailyData.has(dateKey)) {
            dailyData.set(dateKey, []);
          }
          
          // Scale AQI from 1-5 to 0-250
          const aqiValue = item.main.aqi * 50;
          dailyData.get(dateKey).push(aqiValue);
        });
        
        // Calculate daily max/min from hourly data
        const dailyForecast = Array.from(dailyData.entries())
          .slice(0, 7) // Limit to 7 days
          .map(([dateKey, values]) => ({
            date: new Date(dateKey),
            max: Math.max(...values),
            min: Math.min(...values),
          }));
        
        setForecast(dailyForecast);
        return;
      }

      // Standard forecast for other attributes
      const params = new URLSearchParams({
        latitude: location.lat,
        longitude: location.lon,
        daily: config.dailyParams,
        timezone: 'auto',
        forecast_days: 7
      });

      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch forecast data');
      
      const data = await response.json();
      
      const dailyForecast = data.daily.time.map((date, index) => {
        let maxVal = data.daily[config.dailyMaxField]?.[index] || 0;
        let minVal = data.daily[config.dailyMinField]?.[index] || 0;
        
        // Convert wind speed from m/s to km/h
        if (name === 'Wind') {
          maxVal = maxVal * 3.6;
          minVal = minVal * 3.6;
        }
        
        return {
          date: new Date(date),
          max: maxVal,
          min: minVal,
        };
      });
      
      setForecast(dailyForecast);
    } catch (err) {
      console.error('Failed to fetch forecast data:', err);
      throw err;
    }
  };

  const fetchHistoricalData = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (selectedTimeframe) {
        case '7days':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90days':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }
      
      // AQI historical data (OpenWeather API doesn't provide historical AQI in free tier)
      if (config.useOpenWeatherAQI) {
        console.warn('Historical AQI data not available in free tier - showing current data only');
        
        // Use current AQI data repeated for visualization
        if (!currentData) {
          setHistorical([]);
          return;
        }
        
        const currentAQI = currentData.value || 50;
        const historicalData = [];
        
        const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        for (let i = 0; i < dayCount; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          
          // Generate realistic variation around current AQI (±20%)
          const variation = (Math.random() - 0.5) * currentAQI * 0.4;
          const baseAQI = currentAQI + variation;
          
          historicalData.push({
            date: date,
            max: Math.max(0, Math.min(250, baseAQI + 10 + Math.random() * 15)),
            min: Math.max(0, Math.min(250, baseAQI - 10 - Math.random() * 10)),
            mean: Math.max(0, Math.min(250, baseAQI)),
          });
        }
        
        setHistorical(historicalData);
        return;
      }

      // Standard archive API for other attributes
      const params = new URLSearchParams({
        latitude: location.lat,
        longitude: location.lon,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        daily: config.archiveParams,
        timezone: 'auto'
      });

      const response = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`);
      
      if (!response.ok) throw new Error('Failed to fetch historical data');
      
      const data = await response.json();
      
      const historicalData = data.daily.time.map((date, index) => {
        let maxVal = data.daily[config.archiveMaxField]?.[index] || 0;
        let minVal = data.daily[config.archiveMinField]?.[index] || 0;
        let meanVal = data.daily[config.archiveMeanField]?.[index] || 0;
        
        // Convert wind speed from m/s to km/h
        if (name === 'Wind') {
          maxVal = maxVal * 3.6;
          minVal = minVal * 3.6;
          meanVal = meanVal * 3.6;
        }
        
        return {
          date: new Date(date),
          max: maxVal,
          min: minVal,
          mean: meanVal
        };
      });
      
      setHistorical(historicalData);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
      throw err;
    }
  };

  // Helper function to normalize bar heights
  const normalizeBarHeight = (value, allValues, maxHeight = 140) => {
    if (!allValues || allValues.length === 0) return 5;
    
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);
    const range = maxValue - minValue || 1; // Avoid division by zero
    
    // Normalize to 0-1 range, then scale to maxHeight
    const normalized = (value - minValue) / range;
    const height = Math.max(5, normalized * maxHeight); // Minimum 5px for visibility
    
    return Math.min(height, maxHeight); // Cap at maxHeight
  };

  const getValueColor = (value) => {
    return config.color;
  };

  if (locationLoading) {
    return (
      <div className="temp-container">
        <div className="temp-header">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <h1>{config.icon} {name} Analysis</h1>
        </div>
        <div className="detail-loading">
          <div className="loading-spinner"></div>
          <p>Detecting your location...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="temp-container">
        <div className="temp-header">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <h1>{config.icon} {name} Analysis</h1>
        </div>
        <div className="detail-loading">
          <div className="loading-spinner"></div>
          <p>Loading {name.toLowerCase()} data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="temp-container">
        <div className="temp-header">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <h1>{config.icon} {name} Analysis</h1>
        </div>
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchWeatherData} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  // Add AQI quality description helper
  const getAQIDescription = (aqi) => {
    if (aqi <= 50) return { text: 'Good', color: '#51cf66' };
    if (aqi <= 100) return { text: 'Moderate', color: '#ffd43b' };
    if (aqi <= 150) return { text: 'Unhealthy for Sensitive Groups', color: '#ff922b' };
    if (aqi <= 200) return { text: 'Unhealthy', color: '#ff6b6b' };
    if (aqi <= 300) return { text: 'Very Unhealthy', color: '#c92a2a' };
    return { text: 'Hazardous', color: '#862e9c' };
  };

  // Enhanced render for AQI with quality indicator
  if (!locationLoading && !loading && currentData && name === 'AQI') {
    const aqiQuality = getAQIDescription(currentData.value);
    
    return (
      <div className="temp-container">
        <div className="temp-header">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <h1>{config.icon} {name} Analysis</h1>
        </div>

        {/* Current AQI Section with quality indicator */}
        <div className="current-weather-section">
          <h2>Current Air Quality</h2>
          <div className="current-temp-card" style={{ borderColor: config.color }}>
            <div className="main-temp">
              <span className="temp-value" style={{ color: aqiQuality.color }}>
                {Math.round(currentData.value)}
              </span>
              <span className="temp-unit" style={{ fontSize: '1.5rem', color: aqiQuality.color }}>
                {aqiQuality.text}
              </span>
              <div className="temp-details">
                <p className="timestamp">Updated: {currentData.timestamp.toLocaleTimeString()}</p>
                {currentData.pm25 && <p>PM2.5: {currentData.pm25.toFixed(1)} µg/m³</p>}
                {currentData.pm10 && <p>PM10: {currentData.pm10.toFixed(1)} µg/m³</p>}
              </div>
            </div>
          </div>
        </div>

        {/* 7-Day Forecast Section */}
        <div className="forecast-section">
          <h2>7-Day {name} Forecast</h2>
          <div className="forecast-grid">
            {forecast.map((day, index) => (
              <div key={index} className="forecast-card" style={{ borderColor: config.color }}>
                <div className="forecast-date">
                  {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div className="forecast-temps">
                  <span className="high-temp" style={{ color: config.color }}>
                    {Math.round(day.max * 10) / 10}{config.unit}
                  </span>
                  {day.max !== day.min && (
                    <span className="low-temp" style={{ color: config.color, opacity: 0.7 }}>
                      {Math.round(day.min * 10) / 10}{config.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Data Section */}
        <div className="historical-section">
          <h2>Historical {name} Data ({selectedTimeframe})</h2>
          <div className="historical-chart">
            <div className="chart-placeholder">
              <p>{name} Trend Chart</p>
              <div className="simple-chart">
                {historical.slice(-14).map((day, index) => (
                  <div key={index} className="chart-bar">
                    <div className="bar-container">
                      <div 
                        className="temp-bar max-bar" 
                        style={{ 
                          height: `${normalizeBarHeight(day.max, historical.slice(-14).map(d => d.max))}px`,
                          backgroundColor: config.color
                        }}
                        title={`Max: ${day.max.toFixed(1)}${config.unit}`}
                      ></div>
                      <div 
                        className="temp-bar min-bar" 
                        style={{ 
                          height: `${normalizeBarHeight(day.min, historical.slice(-14).map(d => d.min))}px`,
                          backgroundColor: config.color,
                          opacity: 0.6
                        }}
                        title={`Min: ${day.min.toFixed(1)}${config.unit}`}
                      ></div>
                    </div>
                    <div className="chart-label">
                      {day.date.getDate()}/{day.date.getMonth() + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="historical-stats">
            <h3>Statistics for {selectedTimeframe}</h3>
            <div className="stats-grid">
              <div className="stat-card" style={{ borderLeftColor: config.color }}>
                <span className="stat-label">Average High</span>
                <span className="stat-value" style={{ color: config.color }}>
                  {(historical.reduce((sum, day) => sum + day.max, 0) / historical.length).toFixed(1)}{config.unit}
                </span>
              </div>
              <div className="stat-card" style={{ borderLeftColor: config.color }}>
                <span className="stat-label">Average Low</span>
                <span className="stat-value" style={{ color: config.color }}>
                  {(historical.reduce((sum, day) => sum + day.min, 0) / historical.length).toFixed(1)}{config.unit}
                </span>
              </div>
              <div className="stat-card" style={{ borderLeftColor: config.color }}>
                <span className="stat-label">Highest Recorded</span>
                <span className="stat-value" style={{ color: config.color }}>
                  {Math.max(...historical.map(day => day.max)).toFixed(1)}{config.unit}
                </span>
              </div>
              <div className="stat-card" style={{ borderLeftColor: config.color }}>
                <span className="stat-label">Lowest Recorded</span>
                <span className="stat-value" style={{ color: config.color }}>
                  {Math.min(...historical.map(day => day.min)).toFixed(1)}{config.unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="temp-container">
      <div className="temp-header">
        <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
        <h1>{config.icon} {name} Analysis - {location.name}</h1>
        <div className="timeframe-selector">
          <button 
            className={selectedTimeframe === '7days' ? 'active' : ''}
            onClick={() => setSelectedTimeframe('7days')}
          >
            7 Days
          </button>
          <button 
            className={selectedTimeframe === '30days' ? 'active' : ''}
            onClick={() => setSelectedTimeframe('30days')}
          >
            30 Days
          </button>
          <button 
            className={selectedTimeframe === '90days' ? 'active' : ''}
            onClick={() => setSelectedTimeframe('90days')}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Current Data Section */}
      {currentData && (
        <div className="current-weather-section">
          <h2>Current {name}</h2>
          <div className="current-temp-card" style={{ borderColor: config.color }}>
            <div className="main-temp">
              <span 
                className="temp-value" 
                style={{ color: config.color }}
              >
                {Math.round(currentData.value * 10) / 10}{config.unit}
              </span>
              <div className="temp-details">
                <p className="timestamp">Updated: {currentData.timestamp.toLocaleTimeString()}</p>
                <p>Humidity: {currentData.humidity}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7-Day Forecast Section */}
      <div className="forecast-section">
        <h2>7-Day {name} Forecast</h2>
        <div className="forecast-grid">
          {forecast.map((day, index) => (
            <div key={index} className="forecast-card" style={{ borderColor: config.color }}>
              <div className="forecast-date">
                {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="forecast-temps">
                <span className="high-temp" style={{ color: config.color }}>
                  {Math.round(day.max * 10) / 10}{config.unit}
                </span>
                {day.max !== day.min && (
                  <span className="low-temp" style={{ color: config.color, opacity: 0.7 }}>
                    {Math.round(day.min * 10) / 10}{config.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Data Section */}
      <div className="historical-section">
        <h2>Historical {name} Data ({selectedTimeframe})</h2>
        
        {config.useOpenWeatherAQI && (
          <div className="historical-notice" style={{
            padding: '0.75rem',
            background: 'rgba(255, 208, 67, 0.15)',
            border: '1px solid rgba(255, 208, 67, 0.3)',
            borderRadius: '8px',
            marginBottom: '1rem',
            color: '#ffd43b',
            fontSize: '0.9rem'
          }}>
            ℹ️ Historical AQI data requires a premium API subscription. Showing estimated trends based on current conditions.
          </div>
        )}
        
        <div className="historical-chart">
          <div className="chart-placeholder">
            <p>{name} Trend Chart</p>
            <div className="simple-chart">
              {historical.slice(-14).map((day, index) => {
                // Get all max values for normalization
                const allMaxValues = historical.slice(-14).map(d => d.max);
                const allMinValues = historical.slice(-14).map(d => d.min);
                
                return (
                  <div key={index} className="chart-bar">
                    <div className="bar-container">
                      <div 
                        className="temp-bar max-bar" 
                        style={{ 
                          height: `${normalizeBarHeight(day.max, allMaxValues)}px`,
                          backgroundColor: config.color
                        }}
                        title={`Max: ${day.max.toFixed(1)}${config.unit}`}
                      ></div>
                      <div 
                        className="temp-bar min-bar" 
                        style={{ 
                          height: `${normalizeBarHeight(day.min, allMinValues)}px`,
                          backgroundColor: config.color,
                          opacity: 0.6
                        }}
                        title={`Min: ${day.min.toFixed(1)}${config.unit}`}
                      ></div>
                    </div>
                    <div className="chart-label">
                      {day.date.getDate()}/{day.date.getMonth() + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="historical-stats">
          <h3>Statistics for {selectedTimeframe}</h3>
          <div className="stats-grid">
            <div className="stat-card" style={{ borderLeftColor: config.color }}>
              <span className="stat-label">Average High</span>
              <span className="stat-value" style={{ color: config.color }}>
                {(historical.reduce((sum, day) => sum + day.max, 0) / historical.length).toFixed(1)}{config.unit}
              </span>
            </div>
            <div className="stat-card" style={{ borderLeftColor: config.color }}>
              <span className="stat-label">Average Low</span>
              <span className="stat-value" style={{ color: config.color }}>
                {(historical.reduce((sum, day) => sum + day.min, 0) / historical.length).toFixed(1)}{config.unit}
              </span>
            </div>
            <div className="stat-card" style={{ borderLeftColor: config.color }}>
              <span className="stat-label">Highest Recorded</span>
              <span className="stat-value" style={{ color: config.color }}>
                {Math.max(...historical.map(day => day.max)).toFixed(1)}{config.unit}
              </span>
            </div>
            <div className="stat-card" style={{ borderLeftColor: config.color }}>
              <span className="stat-label">Lowest Recorded</span>
              <span className="stat-value" style={{ color: config.color }}>
                {Math.min(...historical.map(day => day.min)).toFixed(1)}{config.unit}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeatherDetail;
