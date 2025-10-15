import { useNavigate } from 'react-router-dom';
import './LegalPages.css';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="legal-page-container">
      <div className="legal-page-card glass glass--lg">
        <h1 className="legal-page-title">Privacy Policy</h1>
        <p className="legal-page-subtitle">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="legal-content">
          <section className="legal-section">
            <h2>1. Information We Collect</h2>
            
            <div className="subsection">
              <h3>1.1 Personal Information</h3>
              <ul>
                <li><strong>Account Information:</strong> Username, email address, and encrypted password</li>
                <li><strong>Profile Data:</strong> Optional display name and preferences</li>
                <li><strong>Location Data:</strong> Geographic coordinates for weather services (with your permission)</li>
              </ul>
              
              <h3>1.2 Automatically Collected Information</h3>
              <ul>
                <li><strong>Usage Data:</strong> Pages visited, features used, and interaction patterns</li>
                <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
                <li><strong>Log Data:</strong> IP addresses, access times, and error logs</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>2. How We Use Your Information</h2>
            <div className="legal-list">
              <h3>We use collected information to:</h3>
              <ul>
                <li>Provide personalized weather forecasts and services</li>
                <li>Maintain and improve our platform</li>
                <li>Ensure account security and prevent fraud</li>
                <li>Communicate important updates and notifications</li>
                <li>Analyze usage patterns to enhance user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>3. Location Data</h2>
            <div className="info-box">
              <h3>🗺️ Location Services</h3>
              <p>
                We request location access to provide accurate local weather forecasts. Your precise location is:
              </p>
              <ul>
                <li><strong>Never stored permanently</strong> on our servers</li>
                <li><strong>Used only</strong> for current weather requests</li>
                <li><strong>Not shared</strong> with third parties</li>
                <li><strong>Can be disabled</strong> at any time in your browser settings</li>
              </ul>
              <p>Without location access, you can still search for weather in specific cities.</p>
            </div>
          </section>

          <section className="legal-section">
            <h2>4. Data Sharing and Disclosure</h2>
            
            <div className="subsection">
              <h3>4.1 Third-Party Services</h3>
              <p>We use the following external services:</p>
              <ul>
                <li><strong>OpenWeatherMap API:</strong> For weather data (subject to their privacy policy)</li>
                <li><strong>IP Geolocation Services:</strong> For approximate location when GPS is unavailable</li>
              </ul>
              
              <h3>4.2 We DO NOT:</h3>
              <ul>
                <li>Sell your personal information to third parties</li>
                <li>Share your data for marketing purposes</li>
                <li>Track you across other websites</li>
                <li>Store your precise location data</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information:
            </p>
            <ul>
              <li><strong>Encryption:</strong> All data transmissions use HTTPS</li>
              <li><strong>Password Security:</strong> Passwords are hashed and salted</li>
              <li><strong>Access Controls:</strong> Limited access to personal data</li>
              <li><strong>Regular Updates:</strong> Security patches and monitoring</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Your Rights and Choices</h2>
            
            <div className="subsection">
              <h3>6.1 Account Control</h3>
              <ul>
                <li><strong>Access:</strong> View your account information</li>
                <li><strong>Update:</strong> Modify your profile and preferences</li>
                <li><strong>Delete:</strong> Request account deletion</li>
                <li><strong>Export:</strong> Download your data</li>
              </ul>
              
              <h3>6.2 Privacy Settings</h3>
              <ul>
                <li>Disable location services</li>
                <li>Opt out of non-essential communications</li>
                <li>Adjust data collection preferences</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>7. Data Retention</h2>
            <p>We retain your information for as long as necessary to provide our services:</p>
            <ul>
              <li><strong>Account Data:</strong> Until account deletion</li>
              <li><strong>Usage Logs:</strong> 30 days for debugging purposes</li>
              <li><strong>Location Queries:</strong> Not stored permanently</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>8. Cookies and Tracking</h2>
            <div className="info-box">
              <h3>🍪 Cookie Usage</h3>
              <p>We use minimal cookies for:</p>
              <ul>
                <li><strong>Authentication:</strong> Keeping you logged in</li>
                <li><strong>Preferences:</strong> Remembering your settings</li>
                <li><strong>Security:</strong> Preventing unauthorized access</li>
              </ul>
              <p>We do not use advertising or tracking cookies.</p>
            </div>
          </section>

          <section className="legal-section">
            <h2>9. Children's Privacy</h2>
            <p>
              Our service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided personal information, please contact us immediately.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Changes to Privacy Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Significant changes will be communicated through the application or via email. Continued use after changes indicates acceptance.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Contact Us</h2>
            <p>
              For privacy-related questions, concerns, or requests, please contact us through the support channels available in the application.
            </p>
          </section>
        </div>

        <button 
          className="legal-back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
