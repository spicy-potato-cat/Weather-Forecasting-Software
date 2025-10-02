import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/navbar/navbar.jsx';
import './profile.css';

function ProfilePage() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [preferences, setPreferences] = useState({
        preferred_location: '',
        temperature_unit: 'celsius',
        wind_speed_unit: 'kmh',
        pressure_unit: 'hpa',
        precipitation_unit: 'mm',
        time_format: '24h',
        theme: 'dark',
        notifications_enabled: true,
    });
    const [savedLocations, setSavedLocations] = useState([]);
    const [locationInput, setLocationInput] = useState('');
    const [status, setStatus] = useState({ loading: false, message: '', type: '' });
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        // Check authentication
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('user');
        
        if (!token || !userData) {
            navigate('/login');
            return;
        }

        setUser(JSON.parse(userData));
        fetchUserPreferences(token);
        fetchSavedLocations(token);
    }, [navigate]);

    const fetchUserPreferences = async (token) => {
        try {
            const res = await fetch('http://localhost:5000/api/user/preferences', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.preferences) {
                    setPreferences(prev => ({ ...prev, ...data.preferences }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch preferences:', err);
        }
    };

    const fetchSavedLocations = async (token) => {
        try {
            const res = await fetch('http://localhost:5000/api/user/locations', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                setSavedLocations(data.locations || []);
            }
        } catch (err) {
            console.error('Failed to fetch locations:', err);
        }
    };

    const handlePreferenceChange = (key, value) => {
        setPreferences(prev => ({ ...prev, [key]: value }));
    };

    const savePreferences = async () => {
        setStatus({ loading: true, message: 'Saving preferences...', type: 'info' });
        
        const token = localStorage.getItem('authToken');
        
        try {
            const res = await fetch('http://localhost:5000/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(preferences)
            });

            if (!res.ok) throw new Error('Failed to save preferences');

            setStatus({ loading: false, message: 'Preferences saved successfully!', type: 'success' });
            
            setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
        } catch (err) {
            setStatus({ loading: false, message: err.message || 'Failed to save preferences', type: 'error' });
        }
    };

    const addLocation = async () => {
        if (!locationInput.trim()) return;

        const token = localStorage.getItem('authToken');
        setStatus({ loading: true, message: 'Adding location...', type: 'info' });

        try {
            // Geocode the location using OpenWeather API
            const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationInput)}&limit=1&appid=${import.meta.env.VITE_OPENWEATHER_API_KEY}`;
            const geoRes = await fetch(geocodeUrl);
            
            if (!geoRes.ok) throw new Error('Location not found');
            
            const geoData = await geoRes.json();
            if (geoData.length === 0) throw new Error('Location not found');

            const { name, lat, lon, country } = geoData[0];

            // Save to backend
            const res = await fetch('http://localhost:5000/api/user/locations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    location_name: `${name}, ${country}`,
                    latitude: lat,
                    longitude: lon
                })
            });

            if (!res.ok) throw new Error('Failed to save location');

            const data = await res.json();
            setSavedLocations(prev => [...prev, data.location]);
            setLocationInput('');
            setStatus({ loading: false, message: 'Location added successfully!', type: 'success' });
            
            setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
        } catch (err) {
            setStatus({ loading: false, message: err.message || 'Failed to add location', type: 'error' });
        }
    };

    const removeLocation = async (locationId) => {
        const token = localStorage.getItem('authToken');
        
        try {
            const res = await fetch(`http://localhost:5000/api/user/locations/${locationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });

            if (!res.ok) throw new Error('Failed to remove location');

            setSavedLocations(prev => prev.filter(loc => loc.id !== locationId));
        } catch (err) {
            console.error('Failed to remove location:', err);
        }
    };

    if (!user) return null;

    return (
        <>
            <NavBar title="My Profile" />
            
            <div className="profile-container">
                <div className="profile-card">
                    <div className="profile-tabs">
                        <button
                            className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            Profile Info
                        </button>
                        <button
                            className={`profile-tab ${activeTab === 'preferences' ? 'active' : ''}`}
                            onClick={() => setActiveTab('preferences')}
                        >
                            Preferences
                        </button>
                        <button
                            className={`profile-tab ${activeTab === 'locations' ? 'active' : ''}`}
                            onClick={() => setActiveTab('locations')}
                        >
                            Saved Locations
                        </button>
                    </div>

                    {status.message && (
                        <div className={`profile-notice ${status.type === 'success' ? 'profile-notice-success' : status.type === 'error' ? 'profile-notice-error' : ''}`}>
                            {status.message}
                        </div>
                    )}

                    {/* Profile Info Tab */}
                    {activeTab === 'profile' && (
                        <div className="profile-content">
                            <h2 className="profile-heading">Profile Information</h2>
                            
                            <div className="profile-info-grid">
                                <div className="profile-info-item">
                                    <span className="profile-info-label">Name</span>
                                    <span className="profile-info-value">{user.name}</span>
                                </div>
                                
                                <div className="profile-info-item">
                                    <span className="profile-info-label">Email</span>
                                    <span className="profile-info-value">{user.email}</span>
                                </div>
                                
                                <div className="profile-info-item">
                                    <span className="profile-info-label">Member Since</span>
                                    <span className="profile-info-value">
                                        {new Date().toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === 'preferences' && (
                        <div className="profile-content">
                            <h2 className="profile-heading">Weather Preferences</h2>
                            
                            <div className="preference-section">
                                <h3 className="preference-section-title">Units</h3>
                                
                                <div className="preference-group">
                                    <label className="preference-label">
                                        <span className="preference-label-text">Temperature</span>
                                        <select
                                            className="preference-select"
                                            value={preferences.temperature_unit}
                                            onChange={(e) => handlePreferenceChange('temperature_unit', e.target.value)}
                                        >
                                            <option value="celsius">Celsius (°C)</option>
                                            <option value="fahrenheit">Fahrenheit (°F)</option>
                                            <option value="kelvin">Kelvin (K)</option>
                                        </select>
                                    </label>

                                    <label className="preference-label">
                                        <span className="preference-label-text">Wind Speed</span>
                                        <select
                                            className="preference-select"
                                            value={preferences.wind_speed_unit}
                                            onChange={(e) => handlePreferenceChange('wind_speed_unit', e.target.value)}
                                        >
                                            <option value="kmh">Kilometers per hour (km/h)</option>
                                            <option value="mph">Miles per hour (mph)</option>
                                            <option value="ms">Meters per second (m/s)</option>
                                            <option value="knots">Knots</option>
                                        </select>
                                    </label>

                                    <label className="preference-label">
                                        <span className="preference-label-text">Pressure</span>
                                        <select
                                            className="preference-select"
                                            value={preferences.pressure_unit}
                                            onChange={(e) => handlePreferenceChange('pressure_unit', e.target.value)}
                                        >
                                            <option value="hpa">Hectopascals (hPa)</option>
                                            <option value="mb">Millibars (mb)</option>
                                            <option value="inhg">Inches of mercury (inHg)</option>
                                            <option value="mmhg">Millimeters of mercury (mmHg)</option>
                                        </select>
                                    </label>

                                    <label className="preference-label">
                                        <span className="preference-label-text">Precipitation</span>
                                        <select
                                            className="preference-select"
                                            value={preferences.precipitation_unit}
                                            onChange={(e) => handlePreferenceChange('precipitation_unit', e.target.value)}
                                        >
                                            <option value="mm">Millimeters (mm)</option>
                                            <option value="inches">Inches (in)</option>
                                        </select>
                                    </label>
                                </div>
                            </div>

                            <div className="preference-section">
                                <h3 className="preference-section-title">Display</h3>
                                
                                <div className="preference-group">
                                    <label className="preference-label">
                                        <span className="preference-label-text">Time Format</span>
                                        <select
                                            className="preference-select"
                                            value={preferences.time_format}
                                            onChange={(e) => handlePreferenceChange('time_format', e.target.value)}
                                        >
                                            <option value="12h">12-hour (AM/PM)</option>
                                            <option value="24h">24-hour</option>
                                        </select>
                                    </label>

                                    <label className="preference-label">
                                        <span className="preference-label-text">Theme</span>
                                        <select
                                            className="preference-select"
                                            value={preferences.theme}
                                            onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                                        >
                                            <option value="dark">Dark</option>
                                            <option value="light">Light</option>
                                            <option value="auto">Auto (System)</option>
                                        </select>
                                    </label>

                                    <label className="preference-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={preferences.notifications_enabled}
                                            onChange={(e) => handlePreferenceChange('notifications_enabled', e.target.checked)}
                                        />
                                        <span>Enable weather alerts and notifications</span>
                                    </label>
                                </div>
                            </div>

                            <button
                                className="profile-save-btn"
                                onClick={savePreferences}
                                disabled={status.loading}
                            >
                                {status.loading ? 'Saving...' : 'Save Preferences'}
                            </button>
                        </div>
                    )}

                    {/* Saved Locations Tab */}
                    {activeTab === 'locations' && (
                        <div className="profile-content">
                            <h2 className="profile-heading">Saved Locations</h2>
                            
                            <div className="location-input-group">
                                <input
                                    type="text"
                                    className="location-input"
                                    placeholder="Enter city name (e.g., London, Paris)"
                                    value={locationInput}
                                    onChange={(e) => setLocationInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && addLocation()}
                                />
                                <button
                                    className="location-add-btn"
                                    onClick={addLocation}
                                    disabled={status.loading || !locationInput.trim()}
                                >
                                    Add Location
                                </button>
                            </div>

                            <div className="locations-list">
                                {savedLocations.length === 0 ? (
                                    <p className="locations-empty">No saved locations yet. Add your favorite cities!</p>
                                ) : (
                                    savedLocations.map((loc) => (
                                        <div key={loc.id} className="location-card">
                                            <div className="location-info">
                                                <span className="location-name">{loc.location_name}</span>
                                                <span className="location-coords">
                                                    {typeof loc.latitude === 'number' ? loc.latitude.toFixed(4) : loc.latitude}°, {typeof loc.longitude === 'number' ? loc.longitude.toFixed(4) : loc.longitude}°
                                                </span>
                                            </div>
                                            <button
                                                className="location-remove-btn"
                                                onClick={() => removeLocation(loc.id)}
                                                aria-label="Remove location"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default ProfilePage;
