import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/navbar/navbar.jsx';
import './Analytics.css';

function Analytics() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });

  // Form state
  const [formData, setFormData] = useState({
    location_name: '',
    latitude: '',
    longitude: '',
    start_date: '',
    end_date: '',
  });

  // Results state
  const [historicalData, setHistoricalData] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'summary'

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(userData));

    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setFormData(prev => ({
      ...prev,
      end_date: end.toISOString().split('T')[0],
      start_date: start.toISOString().split('T')[0],
    }));
  }, [navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchLocation = async () => {
    if (!formData.location_name) {
      setStatus({ loading: false, message: 'Please enter a location name', type: 'error' });
      return;
    }

    setStatus({ loading: true, message: 'Searching location...', type: 'info' });

    try {
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(formData.location_name)}&limit=1&appid=${apiKey}`
      );

      if (!res.ok) throw new Error('Location search failed');

      const data = await res.json();

      if (data.length === 0) {
        throw new Error('Location not found');
      }

      const location = data[0];
      
      setFormData(prev => ({
        ...prev,
        latitude: location.lat.toFixed(4),
        longitude: location.lon.toFixed(4),
        location_name: `${location.name}, ${location.country}`,
      }));

      setStatus({ loading: false, message: `Found: ${location.name}, ${location.country}`, type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);

    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const handleFetchData = async () => {
    if (!formData.latitude || !formData.longitude || !formData.start_date || !formData.end_date) {
      setStatus({ loading: false, message: 'Please fill all required fields', type: 'error' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Fetching historical data...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/analytics/historical', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          start_date: formData.start_date,
          end_date: formData.end_date,
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to fetch data');

      setHistoricalData(data);
      setStatus({ loading: false, message: `Loaded ${data.record_count} records`, type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);

    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const handleExportCSV = async () => {
    if (!formData.latitude || !formData.longitude || !formData.start_date || !formData.end_date) {
      setStatus({ loading: false, message: 'Please fill all required fields', type: 'error' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Generating CSV export...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/analytics/export-csv', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: parseFloat(formData.latitude),
          longitude: parseFloat(formData.longitude),
          start_date: formData.start_date,
          end_date: formData.end_date,
          location_name: formData.location_name,
        })
      });

      if (!res.ok) throw new Error('CSV export failed');

      // Download file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weather_${formData.location_name}_${formData.start_date}_${formData.end_date}.csv`.replace(/[^a-z0-9_.-]/gi, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setStatus({ loading: false, message: 'CSV downloaded successfully!', type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);

    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const calculateSummaryStats = () => {
    if (!historicalData || !historicalData.data) return null;

    const data = historicalData.data;
    
    const temps = data.map(d => d.temp_mean_c).filter(v => v !== null);
    const precip = data.map(d => d.precipitation_mm).filter(v => v !== null);
    const wind = data.map(d => d.wind_speed_max_kmh).filter(v => v !== null);

    return {
      temp_avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      temp_max: Math.max(...temps).toFixed(1),
      temp_min: Math.min(...temps).toFixed(1),
      precip_total: precip.reduce((a, b) => a + b, 0).toFixed(1),
      precip_avg: (precip.reduce((a, b) => a + b, 0) / precip.length).toFixed(1),
      precip_days: precip.filter(v => v > 0).length,
      wind_avg: (wind.reduce((a, b) => a + b, 0) / wind.length).toFixed(1),
      wind_max: Math.max(...wind).toFixed(1),
    };
  };

  if (!user) return null;

  const summaryStats = historicalData ? calculateSummaryStats() : null;

  return (
    <>
      <NavBar title="Analytics Dashboard" />
      
      <div className="analytics-container">
        <div className="analytics-card">
          <h1 className="analytics-title">Historical Weather Data Analysis</h1>
          <p className="analytics-subtitle">
            Access historical weather data for climate trend analysis and research
          </p>

          {/* Status Message */}
          {status.message && (
            <div className={`analytics-notice analytics-notice-${status.type}`}>
              {status.message}
            </div>
          )}

          {/* Search Form */}
          <div className="analytics-form">
            <div className="analytics-section">
              <h2 className="analytics-section-title">Location Selection</h2>
              
              <div className="analytics-input-row">
                <div className="analytics-input-group" style={{ flex: 2 }}>
                  <label>Location Name</label>
                  <input
                    type="text"
                    name="location_name"
                    placeholder="e.g., Mumbai, India"
                    value={formData.location_name}
                    onChange={handleInputChange}
                    disabled={status.loading}
                  />
                </div>
                <button
                  className="analytics-btn analytics-btn-secondary"
                  onClick={handleSearchLocation}
                  disabled={status.loading}
                  style={{ marginTop: '1.5rem' }}
                >
                  🔍 Search
                </button>
              </div>

              <div className="analytics-input-row">
                <div className="analytics-input-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    name="latitude"
                    step="0.0001"
                    placeholder="19.0760"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    disabled={status.loading}
                  />
                </div>
                <div className="analytics-input-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    name="longitude"
                    step="0.0001"
                    placeholder="72.8777"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    disabled={status.loading}
                  />
                </div>
              </div>
            </div>

            <div className="analytics-section">
              <h2 className="analytics-section-title">Date Range</h2>
              
              <div className="analytics-input-row">
                <div className="analytics-input-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    disabled={status.loading}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="analytics-input-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    disabled={status.loading}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="analytics-help-text">
                <span>💡 Tip: Maximum range is 2 years. Historical data available from 1940 onwards.</span>
              </div>
            </div>

            <div className="analytics-btn-group">
              <button
                className="analytics-btn analytics-btn-primary"
                onClick={handleFetchData}
                disabled={status.loading}
              >
                📊 Fetch Historical Data
              </button>
              <button
                className="analytics-btn analytics-btn-accent"
                onClick={handleExportCSV}
                disabled={status.loading}
              >
                💾 Export to CSV
              </button>
            </div>
          </div>

          {/* Results Section */}
          {historicalData && (
            <div className="analytics-results">
              <div className="analytics-results-header">
                <h2>Results ({historicalData.record_count} records)</h2>
                <div className="analytics-view-toggle">
                  <button
                    className={`view-toggle-btn ${viewMode === 'summary' ? 'active' : ''}`}
                    onClick={() => setViewMode('summary')}
                  >
                    📈 Summary
                  </button>
                  <button
                    className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    📋 Table
                  </button>
                </div>
              </div>

              {viewMode === 'summary' && summaryStats && (
                <div className="analytics-summary">
                  <div className="summary-grid">
                    <div className="summary-card">
                      <div className="summary-icon">🌡️</div>
                      <div className="summary-label">Temperature</div>
                      <div className="summary-value">{summaryStats.temp_avg}°C</div>
                      <div className="summary-range">
                        {summaryStats.temp_min}°C - {summaryStats.temp_max}°C
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-icon">💧</div>
                      <div className="summary-label">Precipitation</div>
                      <div className="summary-value">{summaryStats.precip_total}mm</div>
                      <div className="summary-range">
                        {summaryStats.precip_days} rainy days
                      </div>
                    </div>
                    <div className="summary-card">
                      <div className="summary-icon">💨</div>
                      <div className="summary-label">Wind Speed</div>
                      <div className="summary-value">{summaryStats.wind_avg} km/h</div>
                      <div className="summary-range">
                        Max: {summaryStats.wind_max} km/h
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'table' && (
                <div className="analytics-table-container">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Temp Max (°C)</th>
                        <th>Temp Min (°C)</th>
                        <th>Precip (mm)</th>
                        <th>Wind (km/h)</th>
                        <th>Wind Dir (°)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalData.data.slice(0, 100).map((record, idx) => (
                        <tr key={idx}>
                          <td>{record.date}</td>
                          <td>{record.temp_max_c?.toFixed(1) || '-'}</td>
                          <td>{record.temp_min_c?.toFixed(1) || '-'}</td>
                          <td>{record.precipitation_mm?.toFixed(1) || '-'}</td>
                          <td>{record.wind_speed_max_kmh?.toFixed(1) || '-'}</td>
                          <td>{record.wind_direction_deg || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {historicalData.data.length > 100 && (
                    <div className="analytics-table-footer">
                      Showing first 100 of {historicalData.data.length} records. Export to CSV to view all data.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Info Section */}
          <div className="analytics-info">
            <h3>📚 Data Sources</h3>
            <ul>
              <li><strong>Open-Meteo Archive API</strong> - Historical weather data from 1940-present</li>
              <li><strong>OpenWeather Geocoding API</strong> - Location search and coordinates</li>
            </ul>
            <h3>📊 Available Metrics</h3>
            <ul>
              <li>Temperature (max, min, mean)</li>
              <li>Precipitation, rain, snowfall</li>
              <li>Wind speed, gusts, direction</li>
              <li>Solar radiation</li>
              <li>Evapotranspiration</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default Analytics;