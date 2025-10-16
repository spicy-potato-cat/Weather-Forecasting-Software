import { useState, useEffect } from 'react';

const DEFAULT_PREFERENCES = {
  temperature_unit: 'celsius',
  wind_speed_unit: 'kmh',
  pressure_unit: 'hPa',
  time_format: '24h'
};

/**
 * Custom hook to fetch and use user preferences
 * Returns default metric system if user is not logged in
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      fetchPreferences(token);
    } else {
      setPreferences(DEFAULT_PREFERENCES);
      setLoading(false);
    }
    
    // Listen for logout to reset preferences
    const handleLogout = () => {
      console.log('🧹 Resetting user preferences to defaults');
      setPreferences(DEFAULT_PREFERENCES);
      setLoading(false);
      setError(null);
    };
    
    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      window.removeEventListener('user-logout', handleLogout);
    };
  }, []);

  const fetchPreferences = async (token) => {
    try {
      const response = await fetch('http://localhost:5000/api/user/preferences', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // If 401, token is invalid - clear it and use defaults
        if (response.status === 401) {
          console.warn('Token invalid or expired, clearing auth data');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.dispatchEvent(new Event('storage')); // Update navbar
        }
        
        console.warn('Failed to fetch preferences, using defaults');
        setPreferences(DEFAULT_PREFERENCES);
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.preferences) {
        setPreferences(data.preferences);
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (newPreferences) => {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.warn('Cannot update preferences without auth token');
        return false;
      }

      const response = await fetch('http://localhost:5000/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPreferences)
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      const data = await response.json();
      
      if (data.success) {
        setPreferences(data.preferences);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  };

  return {
    preferences,
    loading,
    updatePreferences,
    refreshPreferences: fetchPreferences
  };
}
