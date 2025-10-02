import { useNavigate } from 'react-router-dom';
import NavBar from '../components/navbar/navbar.jsx';
import './ApiLimitations.css';

function ApiLimitations() {
  const navigate = useNavigate();

  return (
    <>
      <NavBar title="API Limitations" />
      
      <div className="api-limits-container">
        <div className="api-limits-card">
          <h1 className="api-limits-title">Understanding Our Free Tier Weather Data</h1>
          
          <p className="api-limits-intro">
            Aether uses free-tier weather APIs to provide you with accurate forecasts without any cost. 
            However, these services come with certain limitations that affect the data we can display.
          </p>

          {/* OpenWeather Section */}
          <section className="api-section">
            <div className="api-header">
              <h2>🌤️ OpenWeather API</h2>
              <span className="api-badge free">Free Tier</span>
            </div>

            <div className="api-limit-grid">
              <div className="limit-card">
                <div className="limit-icon">⏱️</div>
                <div className="limit-content">
                  <h3>Rate Limit</h3>
                  <p className="limit-value">60 calls/minute</p>
                  <p className="limit-desc">Maximum 1,000 calls per day</p>
                </div>
              </div>

              <div className="limit-card">
                <div className="limit-icon">📅</div>
                <div className="limit-content">
                  <h3>Forecast Range</h3>
                  <p className="limit-value">5 days</p>
                  <p className="limit-desc">3-hour intervals (40 data points)</p>
                </div>
              </div>

              <div className="limit-card">
                <div className="limit-icon">🌍</div>
                <div className="limit-content">
                  <h3>Coverage</h3>
                  <p className="limit-value">Global</p>
                  <p className="limit-desc">Current weather + 5-day forecast</p>
                </div>
              </div>

              <div className="limit-card">
                <div className="limit-icon">💨</div>
                <div className="limit-content">
                  <h3>Air Quality</h3>
                  <p className="limit-value">Current only</p>
                  <p className="limit-desc">No historical AQI data in free tier</p>
                </div>
              </div>
            </div>

            <div className="api-note">
              <strong>What this means:</strong> Our 7-day forecast includes 5 days of real data from OpenWeather, 
              plus 2 projected days based on current trends (marked with dashed borders).
            </div>
          </section>

          {/* Open-Meteo Section */}
          <section className="api-section">
            <div className="api-header">
              <h2>⛅ Open-Meteo API</h2>
              <span className="api-badge free">Free & Open Source</span>
            </div>

            <div className="api-limit-grid">
              <div className="limit-card">
                <div className="limit-icon">⚡</div>
                <div className="limit-content">
                  <h3>Rate Limit</h3>
                  <p className="limit-value">10,000 calls/day</p>
                  <p className="limit-desc">No minute-based limit</p>
                </div>
              </div>

              <div className="limit-card">
                <div className="limit-icon">📊</div>
                <div className="limit-content">
                  <h3>Forecast Range</h3>
                  <p className="limit-value">16 days</p>
                  <p className="limit-desc">Hourly data available</p>
                </div>
              </div>

              <div className="limit-card">
                <div className="limit-icon">🕐</div>
                <div className="limit-content">
                  <h3>Historical Data</h3>
                  <p className="limit-value">90 days back</p>
                  <p className="limit-desc">Daily aggregated data</p>
                </div>
              </div>

              <div className="limit-card">
                <div className="limit-icon">🆓</div>
                <div className="limit-content">
                  <h3>Cost</h3>
                  <p className="limit-value">Completely free</p>
                  <p className="limit-desc">No API key required</p>
                </div>
              </div>
            </div>

            <div className="api-note success">
              <strong>Great news!</strong> Open-Meteo provides excellent coverage for temperature, precipitation, 
              wind, and pressure data without strict rate limits.
            </div>
          </section>

          {/* Why We Use Both */}
          <section className="api-section">
            <h2>🤝 Why We Use Both APIs</h2>
            
            <div className="reason-grid">
              <div className="reason-card">
                <div className="reason-number">1</div>
                <h3>Best of Both Worlds</h3>
                <p>OpenWeather excels at current conditions and air quality, while Open-Meteo provides excellent historical data and longer forecasts.</p>
              </div>

              <div className="reason-card">
                <div className="reason-number">2</div>
                <h3>Redundancy</h3>
                <p>If one API is down or rate-limited, we can fall back to the other for certain data types.</p>
              </div>

              <div className="reason-card">
                <div className="reason-number">3</div>
                <h3>Specialized Features</h3>
                <p>Each API has unique strengths - OpenWeather for AQI, Open-Meteo for wind patterns and long-term data.</p>
              </div>
            </div>
          </section>

          {/* User Impact */}
          <section className="api-section">
            <h2>📌 How This Affects You</h2>
            
            <div className="impact-list">
              <div className="impact-item">
                <span className="impact-icon">1.</span>
                <div>
                  <h4>Real-Time Data</h4>
                  <p>Current weather conditions are always accurate and up-to-date.</p>
                </div>
              </div>

              <div className="impact-item">
                <span className="impact-icon">2.</span>
                <div>
                  <h4>7-Day Forecast Limitation</h4>
                  <p>Days 6-7 are projected based on trends (not real forecast data) due to OpenWeather's 5-day limit.</p>
                </div>
              </div>

              <div className="impact-item">
                <span className="impact-icon">3.</span>
                <div>
                  <h4>Historical AQI</h4>
                  <p>Air quality historical data shows estimated trends (premium API feature not available in free tier).</p>
                </div>
              </div>

              <div className="impact-item">
                <span className="impact-icon">4.</span>
                <div>
                  <h4>Data Refresh</h4>
                  <p>We cache data for 10 minutes to avoid exceeding rate limits while keeping info fresh.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Future Plans */}
          <section className="api-section future">
            <h2>🚀 Future Plans</h2>
            <p>
              We're continuously working to improve Aether. Potential upgrades include:
            </p>
            <ul className="future-list">
              <li>Integration with additional free weather APIs for better coverage</li>
              <li>Smart data aggregation from multiple sources</li>
              <li>User-contributed weather observations</li>
              <li>Option to add your own API keys for premium features</li>
            </ul>
          </section>    
          <button className="back-btn" onClick={() => navigate('/')}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </>
  );
}

export default ApiLimitations;
