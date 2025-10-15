import { useState, useEffect } from 'react';
import './AlertBanner.css';

function AlertBanner() {
  const [activeAlerts, setActiveAlerts] = useState([]);

  useEffect(() => {
    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const fetchActiveAlerts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/alerts');
      const data = await res.json();
      if (data.success) {
        setActiveAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  if (activeAlerts.length === 0) return null;

  const getSeverityClass = (severity) => {
    return `alert-banner--${severity.toLowerCase()}`;
  };

  return (
    <div className="alert-banner-container">
      {activeAlerts.map(alert => (
        <div key={alert.id} className={`alert-banner ${getSeverityClass(alert.severity)}`}>
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>{alert.hazard_type} {alert.severity}</strong>
            <p>{alert.details}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default AlertBanner;