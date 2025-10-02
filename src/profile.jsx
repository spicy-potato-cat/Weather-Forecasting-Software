import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './components/navbar/navbar.jsx';
import './profile.css';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Location Item Component
function SortableLocationItem({ location, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="location-card sortable-location"
    >
      <div className="location-drag-handle" {...attributes} {...listeners}>
        ⋮⋮
      </div>
      <div className="location-info">
        <span className="location-name">{location.location_name}</span>
        <span className="location-coords">
          {typeof location.latitude === 'number' ? location.latitude.toFixed(4) : location.latitude}°, {typeof location.longitude === 'number' ? location.longitude.toFixed(4) : location.longitude}°
        </span>
        <span className="location-rank">Rank: #{location.rank + 1}</span>
      </div>
      <button
        className="location-remove-btn"
        onClick={() => onRemove(location.id)}
        aria-label="Remove location"
      >
        Remove
      </button>
    </div>
  );
}

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

    // Drag and drop sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
            // Step 1: Geocode the location using OpenWeather Geocoding API
            const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
            const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationInput)}&limit=5&appid=${apiKey}`;
            
            console.log('Searching for location:', locationInput);
            
            const geoRes = await fetch(geocodeUrl);
            
            if (!geoRes.ok) {
                throw new Error('Failed to search for location');
            }
            
            const geoData = await geoRes.json();
            
            if (!geoData || geoData.length === 0) {
                throw new Error('Location not found. Try a different search term.');
            }

            // Use the first (most relevant) result
            const location = geoData[0];
            
            // Construct standardized location name from OpenWeather response
            // Format: "City, State, Country" or "City, Country" if no state
            const locationParts = [location.name];
            
            if (location.state) {
                locationParts.push(location.state);
            }
            
            locationParts.push(location.country);
            
            const standardizedName = locationParts.join(', ');
            
            console.log('Found location:', {
                name: standardizedName,
                lat: location.lat,
                lon: location.lon,
                local_names: location.local_names
            });

            // Step 2: Save to backend with standardized name
            const saveRes = await fetch('http://localhost:5000/api/user/locations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    location_name: standardizedName,
                    latitude: location.lat,
                    longitude: location.lon
                })
            });

            const saveData = await saveRes.json();
            
            if (!saveRes.ok) {
                // Handle specific error cases
                if (saveRes.status === 409) {
                    throw new Error('This location is already in your saved locations');
                }
                throw new Error(saveData.message || 'Failed to save location');
            }

            // Step 3: Update UI
            setSavedLocations(prev => [...prev, saveData.location]);
            setLocationInput('');
            setStatus({ 
                loading: false, 
                message: `Added: ${standardizedName}`, 
                type: 'success' 
            });
            
            setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
            
        } catch (err) {
            console.error('Error adding location:', err);
            setStatus({ 
                loading: false, 
                message: err.message || 'Failed to add location. Please try again.', 
                type: 'error' 
            });
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

    const handleDragEnd = async (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setSavedLocations((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update ranks in backend
                updateLocationRanks(newItems.map(item => item.id));

                return newItems;
            });
        }
    };

    const updateLocationRanks = async (locationIds) => {
        const token = localStorage.getItem('authToken');

        try {
            await fetch('http://localhost:5000/api/user/locations/reorder', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ locationIds })
            });
        } catch (err) {
            console.error('Failed to update location ranks:', err);
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

                    {/* Saved Locations Tab - WITH DRAG AND DROP */}
                    {activeTab === 'locations' && (
                        <div className="profile-content">
                            <h2 className="profile-heading">Saved Locations</h2>

                            <div className="location-help-text">
                                💡 Drag locations to reorder them. The top location will be used for your 7-day forecast.
                            </div>

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
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={savedLocations.map(loc => loc.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {savedLocations.map((loc) => (
                                                <SortableLocationItem
                                                    key={loc.id}
                                                    location={loc}
                                                    onRemove={removeLocation}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
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
