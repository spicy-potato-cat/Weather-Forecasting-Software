import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import LoginPage from './login.jsx'
import SignupPage from './signup.jsx'
import Temperature from './temperature.jsx'
import LiveMapPage from './liveMapPage.jsx'
import LiveMap from './liveMap.jsx'
import Logo from '/Logo.svg'
import './App.css'
import Navbar from './components/navbar/navbar.jsx'
import ProfilePage from './profile.jsx'
import WeatherDetail from './weatherDetail.jsx'
import WeeklyForecast from './components/WeeklyForecast/WeeklyForecast.jsx'
import ApiLimitations from './pages/ApiLimitations.jsx'
import SearchResults from './pages/SearchResults.jsx'
import TermsAndConditions from './pages/TermsAndConditions.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import HelpSupport from './pages/HelpSupport.jsx'
import { usePreferences } from './hooks/usePreferences.js';
import { formatTemperature, formatWindSpeed, formatPressure } from './lib/math.js';
import AlertBanner from './components/AlertBanner/AlertBanner.jsx'
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';

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

// Enhanced Dashboard with live data and auto-location
function Dashboard() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState('Temperature')
  const [weatherData, setWeatherData] = useState(null)
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [aqiData, setAqiData] = useState(null);
  const { preferences } = usePreferences();

  useEffect(() => {
    getUserLocation()
  }, [])

  useEffect(() => {
    if (location) {
      fetchWeatherData()
    }
  }, [location])

  const getUserLocation = async () => {
    setLoading(true)
    try {
      // Try geolocation API first
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Get city name from coordinates
            const cityName = await getCityName(latitude, longitude);
            
            setLocation({
              lat: latitude,
              lon: longitude,
              name: cityName
            });
          },
          async (error) => {
            console.log('Geolocation denied, using IP-based location');
            await getLocationFromIP();
          }
        );
      } else {
        await getLocationFromIP();
      }
    } catch (err) {
      console.error('Location detection failed:', err);
      setLocation({ name: 'Mumbai', lat: 19.0760, lon: 72.8777 });
      setLoading(false);
    }
  };

  const getLocationFromIP = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('IP location failed');
      
      const data = await res.json();
      
      setLocation({
        lat: data.latitude,
        lon: data.longitude,
        name: data.city || data.region || 'Unknown'
      });
    } catch (err) {
      console.error('IP location failed:', err);
      setLocation({ name: 'Mumbai', lat: 19.0760, lon: 72.8777 });
    } finally {
      setLoading(false);
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
        return data[0].name || 'Current Location';
      }
      return 'Current Location';
    } catch (err) {
      console.error('City name fetch failed:', err);
      return 'Current Location';
    }
  };

  const fetchWeatherData = async () => {
    if (!location) return;
    
    try {
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY
      
      // Fetch regular weather data
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}&units=metric`
      )
      if (weatherRes.ok) {
        const data = await weatherRes.json()
        setWeatherData(data)
      }

      // Fetch AQI data separately
      const aqiRes = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${location.lat}&lon=${location.lon}&appid=${apiKey}`
      )
      if (aqiRes.ok) {
        const data = await aqiRes.json()
        if (data?.list && data.list.length > 0) {
          const aqiValue = data.list[0].main.aqi
          const aqiScaled = aqiValue * 50 // Scale to 0-250
          setAqiData({ aqi: aqiScaled, pm25: data.list[0].components?.pm2_5 || 0 })
        }
      }
    } catch (err) {
      console.error('Failed to fetch weather:', err)
    } finally {
      setLoading(false)
    }
  }

  const getValue = () => {
    if (!weatherData) return '--'

    switch (selected) {
      case 'Temperature':
        return formatTemperature(weatherData.main.temp, preferences.temperature_unit);
      case 'Precipitation':
        return `${weatherData.main.humidity}% humidity`
      case 'Wind':
        return formatWindSpeed(weatherData.wind.speed, preferences.wind_speed_unit);
      case 'AQI':
        return aqiData ? `${Math.round(aqiData.aqi)} AQI` : 'Loading...'
      case 'Visibility':
        return `${(weatherData.visibility / 1000).toFixed(1)} km`
      case 'Surface Pressure':
        return formatPressure(weatherData.main.pressure, preferences.pressure_unit);
      case 'Sealevel Pressure':
        return formatPressure(weatherData.main.sea_level || weatherData.main.pressure, preferences.pressure_unit);
      default:
        return '--'
    }
  }

  if (loading) {
    return (
      <section className="dashboard">
        <h2>Dashboard</h2>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#c9f5e8' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Detecting your location...</p>
        </div>
      </section>
    )
  }

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
        <p>Location: {weatherData ? `${weatherData.name}, ${weatherData.sys.country}` : location?.name || '--'}</p>
        <p>{selected}: {getValue()}</p>
      </div>
    </section>
  )
}

function App() {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('authToken');
      setIsLoggedIn(!!token);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  // If on /live-map, render only the map page (full viewport)
  if (location.pathname === '/live-map') {
    return <LiveMapPage />;
  }

  // If on /login or /signup, render only the auth page
  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  if (location.pathname === '/signup') {
    return <SignupPage />;
  }

  if (location.pathname === '/profile') {
    return <ProfilePage />;
  }

  if (location.pathname === '/api-limitations') {
    return <ApiLimitations />;
  }

  if (location.pathname === '/search') {
    return <SearchResults />;
  }

  if (location.pathname === '/terms') {
    return <TermsAndConditions />;
  }

  if (location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }

  if (location.pathname === '/help') {
    return <HelpSupport />;
  }

  if (location.pathname === '/forgot-password') {
    return <ForgotPassword />;
  }

  if (location.pathname === '/reset-password') {
    return <ResetPassword />;
  }

  // Otherwise, render the normal layout
  return (
    <>
      <Navbar title="Aether" />
      <AlertBanner />
      <div className="glass">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/temperature" element={<WeatherDetail name="Temperature" />} />
          <Route path="/precipitation" element={<WeatherDetail name="Precipitation" />} />
          <Route path="/wind" element={<WeatherDetail name="Wind" />} />
          <Route path="/aqi" element={<WeatherDetail name="AQI" />} />
          <Route path="/visibility" element={<WeatherDetail name="Visibility" />} />
          <Route path="/surface-pressure" element={<WeatherDetail name="Surface Pressure" />} />
          <Route path="/sealevel-pressure" element={<WeatherDetail name="Sealevel Pressure" />} />
        </Routes>

        {/* Weekly Forecast - Only visible for logged-in users */}
        {isLoggedIn && <WeeklyForecast />}
        
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