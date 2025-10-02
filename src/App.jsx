import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import LoginPage from './login.jsx'
import Temperature from './temperature.jsx'
import LiveMapPage from './liveMapPage.jsx'
import LiveMap from './liveMap.jsx'
import Logo from '/Logo.svg'
import './App.css'
import Navbar from './components/navbar/navbar.jsx'

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
    <>
      <Navbar />
      <div className="attribute-detail">
        <h3>{name} Details</h3>
        <p>Details for {name} will be shown here.</p>
      </div>
    </>
  )
}

function App() {
  const location = useLocation();

  // If on /live-map, render only the map page (full viewport)
  if (location.pathname === '/live-map') {
    return <LiveMapPage />;
  }

  // If on /login, render only the login page
  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  // Otherwise, render the normal layout
  return (
    <>
      <Navbar title="Aether" />
      <div className="glass">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/temperature" element={<Temperature />} />
          <Route path="/precipitation" element={<AttributeDetail name="Precipitation" />} />
          <Route path="/wind" element={<AttributeDetail name="Wind" />} />
          <Route path="/aqi" element={<AttributeDetail name="AQI" />} />
          <Route path="/visibility" element={<AttributeDetail name="Visibility" />} />
          <Route path="/surface-pressure" element={<AttributeDetail name="Surface Pressure" />} />
          <Route path="/sealevel-pressure" element={<AttributeDetail name="Sealevel Pressure" />} />
        </Routes>
        
        {/* Map Section - Embedded interactive map */}
        <section className="map-section">
          <h2>Live Map</h2>
          <LiveMap />
        </section>
      </div>
    </>
  );
}

export default App