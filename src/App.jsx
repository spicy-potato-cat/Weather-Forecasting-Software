import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom'
import LoginPage from './login.jsx'
import Logo from '/Logo.svg'
import './App.css'

// Attribute tab list
const attributes = [
  { name: 'Temperature', path: '/temperature' },
  { name: 'Precipitation', path: '/precipitation' },
  { name: 'Wind', path: '/wind' },
  { name: 'AQI', path: '/aqi' },
  { name: 'Visibility', path: '/visibility' },
  { name: 'Surface Pressure', path: '/surface-pressure' },
  { name: 'Sealevel Pressure', path: '/sealevel-pressure' },
]

// Dashboard skeleton component
function Dashboard() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState('Temperature')

  return (
    <section className="dashboard">
      <h2>Dashboard</h2>
      <div className="dashboard-tabs">
        {attributes.map((attr, idx) => (
          <span key={attr.name} className="dashboard-tab-card">
            <button
              className={`dashboard-tab${selected === attr.name ? ' active' : ''}`}
              style={attr.name === 'Temperature' ? { paddingLeft: '0px', paddingTop: '2px', paddingRight: '12px', paddingBottom: '2px' } : { paddingTop: '2px' }}
              onClick={() => setSelected(attr.name)}
            >
              {attr.name}
            </button>
            {/* Add separator except after last tab */}
            {idx < attributes.length - 1 && <span className="tab-separator">|</span>}
          </span>
        ))}
      </div>
      <div
        className="dashboard-summary"
        onClick={() => {
          const attr = attributes.find(a => a.name === selected)
          if (attr) navigate(attr.path)
        }}
        style={{ cursor: 'pointer' }}
        title={`View ${selected} details`}
      >
        <p>Location: --</p>
        <p>{selected}: --</p>
      </div>
    </section>
  )
}

// Placeholder detail pages for each attribute
function AttributeDetail({ name }) {
  return (
    <div className="attribute-detail">
      <h3>{name} Details</h3>
      <p>Details for {name} will be shown here.</p>
    </div>
  )
}

function App() {
  return (
    <Router>
      <>
        {/* Navigation Bar */}
        <nav className="navbar">
          <div className="navbar-left">
            <img src={Logo} alt="Logo" className="site-logo" />
            <span className="site-title">Weather Forecasting</span>
          </div>
          <div className="navbar-right">
            <div className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder="Search for a location..."
              />
              <button className="search-btn">Search</button>
            </div>
            <button className="menu-btn" aria-label="Open navigation menu">
              <span className="menu-icon">&#9776;</span>
            </button>
          </div>
        </nav>

        <div className="app-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/temperature" element={<AttributeDetail name="Temperature" />} />
            <Route path="/precipitation" element={<AttributeDetail name="Precipitation" />} />
            <Route path="/wind" element={<AttributeDetail name="Wind" />} />
            <Route path="/aqi" element={<AttributeDetail name="AQI" />} />
            <Route path="/visibility" element={<AttributeDetail name="Visibility" />} />
            <Route path="/surface-pressure" element={<AttributeDetail name="Surface Pressure" />} />
            <Route path="/sealevel-pressure" element={<AttributeDetail name="Sealevel Pressure" />} />
          </Routes>
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
      </>
    </Router>
  )
}

export default App