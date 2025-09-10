import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Temperature = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState({ lat: 40.7128, lon: -74.0060, name: 'New York' }); // Default to NYC
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [historical, setHistorical] = useState([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState('7days');

  // OpenWeatherMap API key (you'll need to get this from openweathermap.org)
  const OWM_API_KEY = '6357e90b2e643c9fd71aa2d19bd75bcf'; // Replace with your actual API key

  useEffect(() => {
    fetchWeatherData();
  }, [location, selectedTimeframe]);

  const fetchWeatherData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use Open-Meteo API (free, no API key required)
      await fetchCurrentWeatherFromOpenMeteo();
      
      // Fetch forecast and historical data from Open-Meteo
      await fetchForecastData();
      await fetchHistoricalData();
      
    } catch (err) {
      setError('Failed to fetch weather data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentWeather = async () => {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${OWM_API_KEY}&units=metric`
    );
    
    if (!response.ok) throw new Error('Failed to fetch current weather');
    
    const data = await response.json();
    setCurrentWeather({
      temp: data.main.temp,
      feels_like: data.main.feels_like,
      humidity: data.main.humidity,
      pressure: data.main.pressure,
      temp_min: data.main.temp_min,
      temp_max: data.main.temp_max,
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      wind_speed: data.wind.speed,
      visibility: data.visibility / 1000, // Convert to km
      timestamp: new Date()
    });
  };

  const fetchCurrentWeatherFromOpenMeteo = async () => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,weather_code&timezone=auto&forecast_days=1`
    );
    
    if (!response.ok) throw new Error('Failed to fetch current weather from Open-Meteo');
    
    const data = await response.json();
    const current = data.current;
    
    setCurrentWeather({
      temp: current.temperature_2m,
      feels_like: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      pressure: current.surface_pressure,
      temp_min: current.temperature_2m - 3, // Approximate
      temp_max: current.temperature_2m + 5, // Approximate
      description: getWeatherDescription(current.weather_code),
      icon: '01d', // Default icon
      wind_speed: current.wind_speed_10m,
      visibility: 10, // Default value
      timestamp: new Date()
    });
  };

  const getWeatherDescription = (weathercode) => {
    const codes = {
      0: 'clear sky',
      1: 'mainly clear',
      2: 'partly cloudy',
      3: 'overcast',
      45: 'fog',
      48: 'depositing rime fog',
      51: 'light drizzle',
      53: 'moderate drizzle',
      55: 'dense drizzle',
      61: 'slight rain',
      63: 'moderate rain',
      65: 'heavy rain',
      71: 'slight snow',
      73: 'moderate snow',
      75: 'heavy snow',
      77: 'snow grains',
      80: 'slight rain showers',
      81: 'moderate rain showers',
      82: 'violent rain showers',
      85: 'slight snow showers',
      86: 'heavy snow showers',
      95: 'thunderstorm',
      96: 'thunderstorm with slight hail',
      99: 'thunderstorm with heavy hail'
    };
    return codes[weathercode] || 'unknown';
  };

  const fetchForecastData = async () => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min&timezone=auto&forecast_days=7`
    );
    
    if (!response.ok) throw new Error('Failed to fetch forecast data');
    
    const data = await response.json();
    
    // Process daily forecast
    const dailyForecast = data.daily.time.map((date, index) => ({
      date: new Date(date),
      temp_max: data.daily.temperature_2m_max[index],
      temp_min: data.daily.temperature_2m_min[index],
      feels_like_max: data.daily.apparent_temperature_max[index],
      feels_like_min: data.daily.apparent_temperature_min[index]
    }));
    
    setForecast(dailyForecast);
  };

  const fetchHistoricalData = async () => {
    const endDate = new Date();
    const startDate = new Date();
    
    // Set date range based on selected timeframe
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
    
    const response = await fetch(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${location.lat}&longitude=${location.lon}&start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&timezone=auto`
    );
    
    if (!response.ok) throw new Error('Failed to fetch historical data');
    
    const data = await response.json();
    
    const historicalData = data.daily.time.map((date, index) => ({
      date: new Date(date),
      temp_max: data.daily.temperature_2m_max[index],
      temp_min: data.daily.temperature_2m_min[index],
      temp_mean: data.daily.temperature_2m_mean[index]
    }));
    
    setHistorical(historicalData);
  };

  const getTemperatureColor = (temp) => {
    if (temp < 0) return '#1e40af'; // Blue for freezing
    if (temp < 10) return '#3b82f6'; // Light blue for cold
    if (temp < 20) return '#10b981'; // Green for mild
    if (temp < 30) return '#f59e0b'; // Orange for warm
    return '#ef4444'; // Red for hot
  };

  if (loading) {
    return (
      <div className="temp-container">
        <div className="temp-header">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <h1>Temperature Analysis</h1>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading temperature data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="temp-container">
        <div className="temp-header">
          <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
          <h1>Temperature Analysis</h1>
        </div>
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchWeatherData} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="temp-container">
      <div className="temp-header">
        <button onClick={() => navigate('/')} className="back-btn">← Back to Dashboard</button>
        <h1>Temperature Analysis - {location.name}</h1>
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

      {/* Current Weather Section */}
      {currentWeather && (
        <div className="current-weather-section">
          <h2>Current Temperature</h2>
          <div className="current-temp-card">
            <div className="main-temp">
              <span 
                className="temp-value" 
                style={{ color: getTemperatureColor(currentWeather.temp) }}
              >
                {Math.round(currentWeather.temp)}°C
              </span>
              <div className="temp-details">
                <p>Feels like {Math.round(currentWeather.feels_like)}°C</p>
                <p className="description">{currentWeather.description}</p>
                <p className="timestamp">Updated: {currentWeather.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="temp-stats">
              <div className="stat-item">
                <span className="label">High</span>
                <span className="value">{Math.round(currentWeather.temp_max)}°C</span>
              </div>
              <div className="stat-item">
                <span className="label">Low</span>
                <span className="value">{Math.round(currentWeather.temp_min)}°C</span>
              </div>
              <div className="stat-item">
                <span className="label">Humidity</span>
                <span className="value">{currentWeather.humidity}%</span>
              </div>
              <div className="stat-item">
                <span className="label">Pressure</span>
                <span className="value">{currentWeather.pressure} hPa</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7-Day Forecast Section */}
      <div className="forecast-section">
        <h2>7-Day Temperature Forecast</h2>
        <div className="forecast-grid">
          {forecast.map((day, index) => (
            <div key={index} className="forecast-card">
              <div className="forecast-date">
                {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="forecast-temps">
                <span className="high-temp" style={{ color: getTemperatureColor(day.temp_max) }}>
                  {Math.round(day.temp_max)}°
                </span>
                <span className="low-temp" style={{ color: getTemperatureColor(day.temp_min) }}>
                  {Math.round(day.temp_min)}°
                </span>
              </div>
              <div className="feels-like">
                <small>Feels {Math.round(day.feels_like_max)}° / {Math.round(day.feels_like_min)}°</small>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Data Section */}
      <div className="historical-section">
        <h2>Historical Temperature Data ({selectedTimeframe})</h2>
        <div className="historical-chart">
          <div className="chart-placeholder">
            <p>Temperature Trend Chart</p>
            <div className="simple-chart">
              {historical.slice(-14).map((day, index) => (
                <div key={index} className="chart-bar">
                  <div className="bar-container">
                    <div 
                      className="temp-bar max-bar" 
                      style={{ 
                        height: `${Math.max(0, (day.temp_max + 10) * 2)}px`,
                        backgroundColor: getTemperatureColor(day.temp_max)
                      }}
                    ></div>
                    <div 
                      className="temp-bar min-bar" 
                      style={{ 
                        height: `${Math.max(0, (day.temp_min + 10) * 2)}px`,
                        backgroundColor: getTemperatureColor(day.temp_min)
                      }}
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
            <div className="stat-card">
              <span className="stat-label">Average High</span>
              <span className="stat-value">
                {Math.round(historical.reduce((sum, day) => sum + day.temp_max, 0) / historical.length)}°C
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Average Low</span>
              <span className="stat-value">
                {Math.round(historical.reduce((sum, day) => sum + day.temp_min, 0) / historical.length)}°C
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Highest Recorded</span>
              <span className="stat-value">
                {Math.round(Math.max(...historical.map(day => day.temp_max)))}°C
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Lowest Recorded</span>
              <span className="stat-value">
                {Math.round(Math.min(...historical.map(day => day.temp_min)))}°C
              </span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .temp-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .temp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 15px;
        }

        .back-btn {
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 10px 15px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .back-btn:hover {
          background: #e5e7eb;
        }

        .temp-header h1 {
          margin: 0;
          color: #1f2937;
          font-size: 28px;
        }

        .timeframe-selector {
          display: flex;
          gap: 5px;
        }

        .timeframe-selector button {
          padding: 8px 16px;
          border: 1px solid #d1d5db;
          background: white;
          cursor: pointer;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .timeframe-selector button.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .timeframe-selector button:hover:not(.active) {
          background: #f9fafb;
        }

        .current-weather-section {
          margin-bottom: 40px;
        }

        .current-weather-section h2 {
          margin-bottom: 20px;
          color: #374151;
        }

        .current-temp-card {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 30px;
        }

        .main-temp {
          text-align: center;
        }

        .temp-value {
          font-size: 72px;
          font-weight: 300;
          line-height: 1;
        }

        .temp-details {
          margin-top: 10px;
        }

        .temp-details p {
          margin: 5px 0;
          color: #6b7280;
        }

        .description {
          text-transform: capitalize;
          font-weight: 500;
        }

        .timestamp {
          font-size: 12px;
        }

        .temp-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          min-width: 200px;
        }

        .stat-item {
          text-align: center;
        }

        .stat-item .label {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 5px;
        }

        .stat-item .value {
          display: block;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .forecast-section,
        .historical-section {
          margin-bottom: 40px;
        }

        .forecast-section h2,
        .historical-section h2 {
          margin-bottom: 20px;
          color: #374151;
        }

        .forecast-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 15px;
        }

        .forecast-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          border: 1px solid #f3f4f6;
        }

        .forecast-date {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 10px;
        }

        .forecast-temps {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .high-temp,
        .low-temp {
          font-size: 20px;
          font-weight: 600;
        }

        .low-temp {
          opacity: 0.7;
        }

        .feels-like {
          font-size: 11px;
          color: #9ca3af;
        }

        .historical-chart {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          margin-bottom: 20px;
        }

        .chart-placeholder {
          text-align: center;
          color: #6b7280;
        }

        .simple-chart {
          display: flex;
          align-items: end;
          justify-content: space-between;
          height: 200px;
          margin-top: 20px;
          padding: 0 10px;
          border-bottom: 1px solid #e5e7eb;
          border-left: 1px solid #e5e7eb;
        }

        .chart-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0 2px;
        }

        .bar-container {
          display: flex;
          align-items: end;
          gap: 2px;
          height: 180px;
        }

        .temp-bar {
          width: 8px;
          border-radius: 2px 2px 0 0;
          min-height: 10px;
        }

        .chart-label {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 5px;
          transform: rotate(-45deg);
        }

        .historical-stats h3 {
          margin-bottom: 15px;
          color: #374151;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          border: 1px solid #f3f4f6;
        }

        .stat-label {
          display: block;
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: 600;
          color: #1f2937;
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f4f6;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-message {
          text-align: center;
          padding: 40px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
        }

        .retry-btn {
          background: #dc2626;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          margin-top: 15px;
        }

        .retry-btn:hover {
          background: #b91c1c;
        }

        @media (max-width: 768px) {
          .temp-header {
            flex-direction: column;
            align-items: stretch;
          }

          .temp-header h1 {
            font-size: 24px;
            text-align: center;
          }

          .current-temp-card {
            flex-direction: column;
            text-align: center;
          }

          .temp-stats {
            grid-template-columns: repeat(4, 1fr);
          }

          .temp-value {
            font-size: 60px;
          }

          .forecast-grid {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default Temperature;