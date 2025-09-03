import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app-container">
      {/* Hamburger Menu */}
      <nav className="hamburger-menu">
        <button className="menu-btn" aria-label="Open navigation menu">
          <span className="menu-icon">&#9776;</span>
        </button>
        {/* Add menu items here */}
      </nav>

      {/* Dashboard Section */}
      <section className="dashboard">
        <h1>Weather Dashboard</h1>
        <div className="current-weather">
          {/* Placeholder for current weather info */}
          <p>Location: --</p>
          <p>Temperature: --°C</p>
          <p>Condition: --</p>
        </div>
      </section>

      {/* Search Menu */}
      <section className="search-section">
        <input
          type="text"
          className="search-input"
          placeholder="Search for a location..."
        />
        <button className="search-btn">Search</button>
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
