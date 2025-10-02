import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/navbar/navbar.jsx';
import './SearchResults.css';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [astronomy, setAstronomy] = useState(null);

  useEffect(() => {
    if (query) {
      fetchAllWeatherData(query);
    }
  }, [query]);

  const fetchAllWeatherData = async (searchQuery) => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;

      // Step 1: Geocode the location
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchQuery)}&limit=1&appid=${apiKey}`
      );

      if (!geoRes.ok) throw new Error('Location not found');

      const geoData = await geoRes.json();
      if (!geoData || geoData.length === 0) {
        throw new Error(`No results found for "${searchQuery}"`);
      }

      const location = geoData[0];
      setLocationData(location);

      const { lat, lon } = location;

      // Step 2: Fetch all weather data in parallel
      const [currentRes, forecastRes, aqiRes] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
        fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`)
      ]);

      const [currentData, forecastData, aqiData] = await Promise.all([
        currentRes.json(),
        forecastRes.json(),
        aqiRes.json()
      ]);

      setCurrentWeather(currentData);
      setForecast(forecastData);
      setAirQuality(aqiData);

      // Calculate astronomy data
      setAstronomy({
        sunrise: new Date(currentData.sys.sunrise * 1000),
        sunset: new Date(currentData.sys.sunset * 1000),
        timezone: currentData.timezone
      });

    } catch (err) {
      console.error('Search error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAQILevel = (aqi) => {
    const levels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    const colors = ['#51cf66', '#ffd43b', '#ff922b', '#ff6b6b', '#c92a2a'];
    return { text: levels[aqi - 1] || 'Unknown', color: colors[aqi - 1] || '#999' };
  };

  const getUVLevel = (uvi) => {
    if (uvi <= 2) return { text: 'Low', color: '#51cf66' };
    if (uvi <= 5) return { text: 'Moderate', color: '#ffd43b' };
    if (uvi <= 7) return { text: 'High', color: '#ff922b' };
    if (uvi <= 10) return { text: 'Very High', color: '#ff6b6b' };
    return { text: 'Extreme', color: '#c92a2a' };
  };

  const getWindDirection = (deg) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
  };

  const getDaylight = () => {
    if (!astronomy) return '--';
    const { sunrise, sunset } = astronomy;
    const diff = sunset - sunrise;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <>
        <NavBar title="Search Results" />
        <div className="search-results-container">
          <div className="search-results-loading">
            <div className="loading-spinner"></div>
            <p>Searching for "{query}"...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <NavBar title="Search Results" />
        <div className="search-results-container">
          <div className="search-results-error">
            <h2>⚠️ {error}</h2>
            <p>Please try a different search term or check your spelling.</p>
            <button onClick={() => navigate('/')} className="back-btn">
              ← Back to Home
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!locationData || !currentWeather) {
    return null;
  }

  const aqiLevel = airQuality?.list?.[0] ? getAQILevel(airQuality.list[0].main.aqi) : null;

  return (
    <>
      <NavBar title="Weather Search" />
      
      <div className="search-results-container">
        {/* Location Header */}
        <div className="results-header">
          <div className="location-info">
            <h1 className="location-name">
              {locationData.name}
              {locationData.state && `, ${locationData.state}`}
            </h1>
            <p className="location-country">{locationData.country}</p>
            <p className="location-coords">
              📍 {locationData.lat.toFixed(4)}°, {locationData.lon.toFixed(4)}°
            </p>
          </div>
          <button onClick={() => navigate('/')} className="home-btn">
            ← Home
          </button>
        </div>

        {/* Current Weather Hero Section */}
        <div className="weather-hero">
          <div className="hero-left">
            <img
              src={`https://openweathermap.org/img/wn/${currentWeather.weather[0].icon}@4x.png`}
              alt={currentWeather.weather[0].description}
              className="weather-icon-large"
            />
            <div className="hero-temp">
              <span className="temp-value">{Math.round(currentWeather.main.temp)}°</span>
              <span className="temp-unit">C</span>
            </div>
          </div>
          <div className="hero-right">
            <h2 className="weather-condition">{currentWeather.weather[0].main}</h2>
            <p className="weather-description">{currentWeather.weather[0].description}</p>
            <div className="feels-like">
              Feels like <strong>{Math.round(currentWeather.main.feels_like)}°C</strong>
            </div>
            <div className="temp-range">
              <span>↑ {Math.round(currentWeather.main.temp_max)}°</span>
              <span>↓ {Math.round(currentWeather.main.temp_min)}°</span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="metrics-grid primary">
          <div className="metric-card">
            <div className="metric-icon">💨</div>
            <div className="metric-content">
              <span className="metric-label">Wind Speed</span>
              <span className="metric-value">{(currentWeather.wind.speed * 3.6).toFixed(1)} km/h</span>
              <span className="metric-sub">{getWindDirection(currentWeather.wind.deg)} ({currentWeather.wind.deg}°)</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">💧</div>
            <div className="metric-content">
              <span className="metric-label">Humidity</span>
              <span className="metric-value">{currentWeather.main.humidity}%</span>
              <span className="metric-sub">Dew point: {Math.round(currentWeather.main.temp - ((100 - currentWeather.main.humidity) / 5))}°C</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🔽</div>
            <div className="metric-content">
              <span className="metric-label">Pressure</span>
              <span className="metric-value">{currentWeather.main.pressure} hPa</span>
              <span className="metric-sub">Sea level: {currentWeather.main.sea_level || currentWeather.main.pressure} hPa</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">👁️</div>
            <div className="metric-content">
              <span className="metric-label">Visibility</span>
              <span className="metric-value">{(currentWeather.visibility / 1000).toFixed(1)} km</span>
              <span className="metric-sub">{currentWeather.visibility >= 10000 ? 'Excellent' : currentWeather.visibility >= 5000 ? 'Good' : 'Moderate'}</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">☁️</div>
            <div className="metric-content">
              <span className="metric-label">Cloudiness</span>
              <span className="metric-value">{currentWeather.clouds.all}%</span>
              <span className="metric-sub">{currentWeather.clouds.all < 20 ? 'Clear' : currentWeather.clouds.all < 50 ? 'Partly Cloudy' : 'Cloudy'}</span>
            </div>
          </div>

          {aqiLevel && (
            <div className="metric-card">
              <div className="metric-icon">🌫️</div>
              <div className="metric-content">
                <span className="metric-label">Air Quality</span>
                <span className="metric-value" style={{ color: aqiLevel.color }}>{aqiLevel.text}</span>
                <span className="metric-sub">PM2.5: {airQuality.list[0].components.pm2_5.toFixed(1)} µg/m³</span>
              </div>
            </div>
          )}
        </div>

        {/* Sun & Moon Section */}
        {astronomy && (
          <div className="astronomy-section">
            <h2 className="section-title">☀️ Sun & Moon</h2>
            <div className="astronomy-grid">
              <div className="astro-card">
                <div className="astro-icon">🌅</div>
                <span className="astro-label">Sunrise</span>
                <span className="astro-value">{astronomy.sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="astro-card">
                <div className="astro-icon">🌇</div>
                <span className="astro-label">Sunset</span>
                <span className="astro-value">{astronomy.sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div className="astro-card">
                <div className="astro-icon">⏱️</div>
                <span className="astro-label">Daylight</span>
                <span className="astro-value">{getDaylight()}</span>
              </div>

              <div className="astro-card">
                <div className="astro-icon">🕐</div>
                <span className="astro-label">Local Time</span>
                <span className="astro-value">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Air Quality */}
        {airQuality?.list?.[0] && (
          <div className="air-quality-section">
            <h2 className="section-title">🌫️ Air Quality Details</h2>
            <div className="pollutants-grid">
              {Object.entries(airQuality.list[0].components).map(([key, value]) => (
                <div key={key} className="pollutant-card">
                  <span className="pollutant-name">{key.toUpperCase().replace('_', '.')}</span>
                  <span className="pollutant-value">{value.toFixed(2)}</span>
                  <span className="pollutant-unit">µg/m³</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5-Day Forecast */}
        {forecast && (
          <div className="forecast-section">
            <h2 className="section-title">📅 5-Day Forecast</h2>
            <div className="forecast-timeline">
              {forecast.list.filter((_, i) => i % 8 === 0).slice(0, 5).map((item, index) => (
                <div key={index} className="forecast-day">
                  <span className="forecast-date">
                    {new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <img
                    src={`https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`}
                    alt={item.weather[0].description}
                    className="forecast-icon"
                  />
                  <span className="forecast-desc">{item.weather[0].main}</span>
                  <div className="forecast-temps">
                    <span className="temp-high">{Math.round(item.main.temp_max)}°</span>
                    <span className="temp-low">{Math.round(item.main.temp_min)}°</span>
                  </div>
                  <span className="forecast-precip">💧 {item.pop * 100}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Details */}
        <div className="additional-details">
          <h2 className="section-title">📊 Additional Information</h2>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Ground Level Pressure</span>
              <span className="detail-value">{currentWeather.main.grnd_level || currentWeather.main.pressure} hPa</span>
            </div>

            {currentWeather.wind.gust && (
              <div className="detail-item">
                <span className="detail-label">Wind Gust</span>
                <span className="detail-value">{(currentWeather.wind.gust * 3.6).toFixed(1)} km/h</span>
              </div>
            )}

            {currentWeather.rain && (
              <div className="detail-item">
                <span className="detail-label">Rain (1h)</span>
                <span className="detail-value">{currentWeather.rain['1h']} mm</span>
              </div>
            )}

            {currentWeather.snow && (
              <div className="detail-item">
                <span className="detail-label">Snow (1h)</span>
                <span className="detail-value">{currentWeather.snow['1h']} mm</span>
              </div>
            )}

            <div className="detail-item">
              <span className="detail-label">Data Updated</span>
              <span className="detail-value">{new Date(currentWeather.dt * 1000).toLocaleTimeString()}</span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Timezone</span>
              <span className="detail-value">UTC {currentWeather.timezone >= 0 ? '+' : ''}{currentWeather.timezone / 3600}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SearchResults;
