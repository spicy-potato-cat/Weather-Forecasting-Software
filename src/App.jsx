import { useState } from 'react'
import Logo from '/Logo.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-left">
          <img src={Logo} alt="Logo" className="site-logo" />
          <span className="site-title">Weather Forecasting</span>
        </div>
        <div className="navbar-right">
          <button className="menu-btn" aria-label="Open navigation menu">
            <span className="menu-icon">&#9776;</span>
          </button>
          <div className="search-section">
            <input
              type="text"
              className="search-input"
              placeholder="Search for a location..."
            />
            <button className="search-btn">Search</button>
          </div>
        </div>
      </nav>

      {/* Dashboard Section */}
      <section className="dashboard">
        <div className="current-weather">
          {/* Placeholder for current weather info */}
          <p>Location: --</p>
          <p>Temperature: --°C</p>
          <p>Condition: --</p>
        </div>
      </section>

      {/* Map iFrame Section */}
      <section className="map-section">
        <h2>Weather Map</h2>
        <iframe
          title="Weather Map"
          src="https://your-map-site.example.com"
          width="100%"
          height="400"
          style={{ border: 'none' }}
        ></iframe>
      </section>
    </div>
  )
}

export default App