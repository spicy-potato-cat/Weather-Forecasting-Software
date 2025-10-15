import { useNavigate } from 'react-router-dom';
import './LegalPages.css';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="legal-page-container">
      <div className="legal-page-card glass glass--lg">
        <h1 className="legal-page-title">Terms and Conditions</h1>
        <p className="legal-page-subtitle">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="legal-content">
          <section className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Aether Weather Forecasting Software ("the Service"), you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Description of Service</h2>
            <p>
              Aether provides weather forecasting and atmospheric data visualization services. Our platform aggregates weather data from various sources to provide current conditions, forecasts, and interactive maps.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. User Accounts</h2>
            <div className="subsection">
              <h3>3.1 Registration</h3>
              <p>To access certain features, you must create an account with accurate and complete information.</p>
              
              <h3>3.2 Account Security</h3>
              <p>You are responsible for maintaining the security of your account credentials and for all activities under your account.</p>
              
              <h3>3.3 Account Termination</h3>
              <p>We reserve the right to suspend or terminate accounts that violate these terms or engage in prohibited activities.</p>
            </div>
          </section>

          <section className="legal-section">
            <h2>4. Acceptable Use</h2>
            <div className="legal-list">
              <h3>You agree NOT to:</h3>
              <ul>
                <li>Use the service for any unlawful purpose or in violation of applicable laws</li>
                <li>Attempt to gain unauthorized access to our systems or networks</li>
                <li>Distribute malware, viruses, or other harmful code</li>
                <li>Scrape, crawl, or systematically extract data beyond normal usage</li>
                <li>Interfere with or disrupt the service or servers</li>
                <li>Impersonate other users or entities</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>5. Weather Data Disclaimer</h2>
            <div className="warning-box">
              <h3>⚠️ Important Weather Data Notice</h3>
              <p>
                Weather forecasts and data are provided for informational purposes only. Weather conditions can change rapidly and without notice. 
                <strong> Do not rely solely on our forecasts for critical decisions involving safety, travel, or property.</strong>
              </p>
              <p>
                Always consult official meteorological services and multiple sources for weather-dependent activities.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <h2>6. API Usage and Limitations</h2>
            <p>
              Our service relies on third-party weather APIs with usage limitations. We cannot guarantee uninterrupted access to weather data due to:
            </p>
            <ul>
              <li>API rate limits and quotas</li>
              <li>Third-party service availability</li>
              <li>Network connectivity issues</li>
              <li>Maintenance periods</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>7. Intellectual Property</h2>
            <p>
              The Aether platform, including its design, code, and original content, is protected by copyright and other intellectual property laws. Weather data is sourced from third-party providers and subject to their respective terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Limitation of Liability</h2>
            <p>
              In no event shall Aether be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service, including but not limited to damages for loss of profits, data, or other intangible losses.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Privacy</h2>
            <p>
              Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the modified terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Contact Information</h2>
            <p>
              If you have questions about these Terms and Conditions, please contact us through our support channels available in the application.
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

export default TermsAndConditions;
