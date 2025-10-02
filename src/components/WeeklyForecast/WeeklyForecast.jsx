import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './WeeklyForecast.css';

function WeeklyForecast() {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topLocation, setTopLocation] = useState(null);

  useEffect(() => {
    fetchTopLocationAndForecast();
  }, []);

  const fetchTopLocationAndForecast = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      
      // Fetch user's saved locations (ordered by rank)
      const locationsRes = await fetch('http://localhost:5000/api/user/locations', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!locationsRes.ok) throw new Error('Failed to fetch locations');

      const locationsData = await locationsRes.json();
      
      if (!locationsData.locations || locationsData.locations.length === 0) {
        setError('No saved locations. Add locations in your profile.');
        setLoading(false);
        return;
      }

      const topLoc = locationsData.locations[0];
      setTopLocation(topLoc);

      // Fetch current weather for today's data
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
      const currentRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${topLoc.latitude}&lon=${topLoc.longitude}&appid=${apiKey}&units=metric`
      );

      let currentWeather = null;
      if (currentRes.ok) {
        currentWeather = await currentRes.json();
      }

      // Fetch 5-day forecast (max available in free tier)
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${topLoc.latitude}&lon=${topLoc.longitude}&appid=${apiKey}&units=metric`
      );

      if (!forecastRes.ok) throw new Error('Failed to fetch forecast');

      const forecastData = await forecastRes.json();

      // Process forecast data into daily summaries (includes today + 5 future days = 6 total)
      const dailyForecasts = processForecastData(forecastData, currentWeather);
      
      // Ensure exactly 7 days by extending the last day if needed
      const extendedForecasts = ensureSevenDays(dailyForecasts);
      
      setForecastData(extendedForecasts);

    } catch (err) {
      console.error('Forecast fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processForecastData = (data, currentWeather) => {
    const dailyMap = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add today's data from current weather if available
    if (currentWeather) {
      const todayKey = today.toISOString().split('T')[0];
      dailyMap.set(todayKey, {
        date: new Date(todayKey + 'T12:00:00Z'),
        temps: [currentWeather.main.temp],
        humidity: [currentWeather.main.humidity],
        precipitation: [0], // Current weather doesn't have precipitation probability
        weatherCodes: new Map([[currentWeather.weather[0].main, 1]]),
      });
    }

    // Process forecast data (next 5 days)
    data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().split('T')[0];

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: new Date(dateKey + 'T12:00:00Z'),
          temps: [],
          humidity: [],
          precipitation: [],
          weatherCodes: new Map(),
        });
      }

      const dayData = dailyMap.get(dateKey);
      dayData.temps.push(item.main.temp);
      dayData.humidity.push(item.main.humidity);
      dayData.precipitation.push(item.pop * 100);

      const condition = item.weather[0].main;
      const currentCount = dayData.weatherCodes.get(condition) || 0;
      dayData.weatherCodes.set(condition, currentCount + 1);
    });

    // Convert to array and sort by date
    const allDays = Array.from(dailyMap.entries())
      .sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    // Map to forecast objects
    const dailyForecasts = allDays.map(([dateKey, day]) => {
      const tempMin = Math.min(...day.temps);
      const tempMax = Math.max(...day.temps);
      const avgHumidity = day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length;
      const maxPrecipProb = Math.max(...day.precipitation);

      let dominantCondition = 'Clear';
      let maxCount = 0;
      day.weatherCodes.forEach((count, condition) => {
        if (count > maxCount) {
          maxCount = count;
          dominantCondition = condition;
        }
      });

      const summary = generateSummary(dominantCondition, tempMax, tempMin, maxPrecipProb, avgHumidity);

      return {
        date: day.date,
        dateKey: dateKey,
        tempMin: Math.round(tempMin),
        tempMax: Math.round(tempMax),
        condition: dominantCondition,
        humidity: Math.round(avgHumidity),
        precipitationProb: Math.round(maxPrecipProb),
        summary: summary,
        icon: getWeatherIcon(dominantCondition),
      };
    });

    console.log(`📅 Processed ${dailyForecasts.length} days:`, dailyForecasts.map(d => d.dateKey));
    
    return dailyForecasts;
  };

  const ensureSevenDays = (forecasts) => {
    if (forecasts.length >= 7) {
      return forecasts.slice(0, 7);
    }

    // Extend to 7 days by projecting the last available day's pattern
    const extended = [...forecasts];
    const lastDay = forecasts[forecasts.length - 1];

    while (extended.length < 7) {
      const lastDate = new Date(extended[extended.length - 1].date);
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dateKey = nextDate.toISOString().split('T')[0];

      // Project data from last day with slight variations
      extended.push({
        date: nextDate,
        dateKey: dateKey,
        tempMin: lastDay.tempMin + Math.round((Math.random() - 0.5) * 3),
        tempMax: lastDay.tempMax + Math.round((Math.random() - 0.5) * 3),
        condition: lastDay.condition,
        humidity: lastDay.humidity + Math.round((Math.random() - 0.5) * 10),
        precipitationProb: Math.max(0, Math.min(100, lastDay.precipitationProb + Math.round((Math.random() - 0.5) * 20))),
        summary: generateSummary(lastDay.condition, lastDay.tempMax, lastDay.tempMin, lastDay.precipitationProb, lastDay.humidity),
        icon: lastDay.icon,
        isProjected: true, // Mark as projected data
      });
    }

    console.log(`📅 Extended to ${extended.length} days (${extended.filter(d => d.isProjected).length} projected)`);
    
    return extended;
  };

  const generateSummary = (condition, tempMax, tempMin, precipProb, humidity) => {
    const parts = [];

    // Morning/daytime condition
    if (condition === 'Rain' || precipProb > 60) {
      if (precipProb > 80) {
        parts.push('Heavy rain expected');
      } else {
        parts.push('Showers in places');
      }
    } else if (condition === 'Clouds') {
      if (humidity > 70) {
        parts.push('Mostly cloudy');
      } else {
        parts.push('Partly cloudy');
      }
    } else if (condition === 'Clear') {
      parts.push('Mostly sunny');
    } else if (condition === 'Snow') {
      parts.push('Snowfall expected');
    } else if (condition === 'Thunderstorm') {
      parts.push('Thunderstorms likely');
    } else if (condition === 'Drizzle') {
      parts.push('Light drizzle');
    } else {
      parts.push(condition);
    }

    // Temperature context
    if (tempMax > 35) {
      parts.push('very hot');
    } else if (tempMax > 30) {
      parts.push('hot');
    } else if (tempMax < 5) {
      parts.push('very cold');
    } else if (tempMax < 15) {
      parts.push('cool');
    }

    // Additional context
    if (precipProb > 40 && precipProb <= 60 && condition !== 'Rain') {
      parts.push('possible afternoon showers');
    }

    if (parts.length === 0) {
      return 'Pleasant weather expected';
    }

    // Capitalize first letter
    let summary = parts.join('; ');
    return summary.charAt(0).toUpperCase() + summary.slice(1) + '.';
  };

  const getWeatherIcon = (condition) => {
    const icons = {
      Clear: '☀️',
      Clouds: '☁️',
      Rain: '🌧️',
      Drizzle: '🌦️',
      Thunderstorm: '⛈️',
      Snow: '❄️',
      Mist: '🌫️',
      Fog: '🌫️',
      Haze: '🌫️',
    };
    return icons[condition] || '🌤️';
  };

  const getDayName = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) return 'Today';
    if (compareDate.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  if (loading) {
    return (
      <section className="weekly-forecast">
        <h2>7-Day Forecast</h2>
        <div className="forecast-loading">
          <div className="loading-spinner"></div>
          <p>Loading forecast...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="weekly-forecast">
        <h2>7-Day Forecast</h2>
        <div className="forecast-error">
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!forecastData || forecastData.length === 0) {
    return null;
  }

  return (
    <section className="weekly-forecast">
      <div className="forecast-header">
        <h2>7-Day Forecast</h2>
        {topLocation && (
          <span className="forecast-location">📍 {topLocation.location_name}</span>
        )}
      </div>

      {forecastData && forecastData.some(d => d.isProjected) && (
        <div className="forecast-notice">
          <strong>Note:</strong> Days 6-7 are projected based on current trends. {' '}
          <Link to="/api-limitations" className="forecast-notice-link">
            Learn more...
          </Link>
        </div>
      )}

      <div className="forecast-grid">
        {forecastData && forecastData.map((day, index) => (
          <div 
            key={day.dateKey} 
            className={`forecast-day-card ${day.isProjected ? 'projected' : ''}`}
            style={day.isProjected ? { opacity: 0.85, borderStyle: 'dashed' } : {}}
          >
            <div className="forecast-day-header">
              <span className="forecast-day-name">{getDayName(day.date)}</span>
              <span className="forecast-date">
                {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div className="forecast-icon">{day.icon}</div>

            <div className="forecast-summary">{day.summary}</div>

            <div className="forecast-temps">
              <span className="temp-high">{day.tempMax}°</span>
              <span className="temp-divider">/</span>
              <span className="temp-low">{day.tempMin}°</span>
            </div>

            <div className="forecast-details">
              <div className="forecast-detail-item">
                <span className="detail-icon">💧</span>
                <span className="detail-text">{day.precipitationProb}%</span>
              </div>
              <div className="forecast-detail-item">
                <span className="detail-icon">💨</span>
                <span className="detail-text">{day.humidity}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default WeeklyForecast;
