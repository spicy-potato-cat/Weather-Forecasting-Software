import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch and use user preferences
 * Returns default metric system if user is not logged in
 */
export function usePreferences() {
  const [preferences, setPreferences] = useState({
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    pressure_unit: 'hpa',
    precipitation_unit: 'mm',
    time_format: '24h',
    theme: 'dark',
    notifications_enabled: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreferences = async () => {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        // User not logged in, use defaults (metric system)
        setLoading(false);
        return;
      }

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
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();

    // Listen for preference changes
    const handleStorageChange = () => {
      fetchPreferences();
    };

    window.addEventListener('preferencesUpdated', handleStorageChange);
    return () => window.removeEventListener('preferencesUpdated', handleStorageChange);
  }, []);

  return { preferences, loading };
}
