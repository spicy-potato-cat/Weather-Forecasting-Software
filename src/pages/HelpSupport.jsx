import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HelpSupport.css';

const HelpSupport = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faq');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    description: ''
  });

  useEffect(() => {
    // Load tickets from localStorage
    const savedTickets = localStorage.getItem('supportTickets');
    if (savedTickets) {
      setTickets(JSON.parse(savedTickets));
    }
  }, []);

  const faqs = [
    {
      id: 1,
      question: "Why am I seeing 'API limit exceeded' errors?",
      answer: "Weather APIs have usage limitations. We use free-tier OpenWeatherMap API which allows 1,000 calls per day. During peak usage, this limit may be reached. Try refreshing later or check our API Limitations page for more details.",
      category: "API"
    },
    {
      id: 2,
      question: "How accurate are the weather forecasts?",
      answer: "Our forecasts are sourced from OpenWeatherMap, which provides reliable meteorological data. However, weather is inherently unpredictable. For critical decisions, always consult multiple weather sources and official meteorological services.",
      category: "Accuracy"
    },
    {
      id: 3,
      question: "Why can't the app detect my location?",
      answer: "Location detection requires browser permission. If denied, we fall back to IP-based location which is less accurate. Enable location services in your browser settings or search for your city manually.",
      category: "Location"
    },
    {
      id: 4,
      question: "What's the difference between Surface and Sea-level Pressure?",
      answer: "Surface pressure is measured at your current elevation, while sea-level pressure is adjusted to what the pressure would be at sea level. Sea-level pressure is used for weather maps and comparing locations at different elevations.",
      category: "Weather"
    },
    {
      id: 5,
      question: "How is the Air Quality Index (AQI) calculated?",
      answer: "Our AQI is based on PM2.5, PM10, NO2, SO2, CO, and O3 levels from OpenWeatherMap. We scale the API's 1-5 rating to a 0-250 scale for better granularity. Higher values indicate worse air quality.",
      category: "Weather"
    },
    {
      id: 6,
      question: "Why do I need to create an account?",
      answer: "Accounts enable personalized features like weekly forecasts, saved preferences, location history, and custom units. Guest users can still access current weather and basic forecasts.",
      category: "Account"
    },
    {
      id: 7,
      question: "Can I change temperature units from Celsius to Fahrenheit?",
      answer: "Yes! Logged-in users can customize units in their profile settings. You can change temperature (°C/°F), wind speed (m/s, km/h, mph), and pressure units (hPa, inHg, mmHg).",
      category: "Settings"
    },
    {
      id: 8,
      question: "What does 'Precipitation' show if it's not raining?",
      answer: "When there's no active precipitation, we display humidity percentage instead. This gives you an idea of moisture in the air, which affects comfort and weather patterns.",
      category: "Weather"
    },
    {
      id: 9,
      question: "Why is the map not loading or showing data?",
      answer: "Map issues can occur due to API limits, network connectivity, or browser compatibility. Try refreshing the page, clearing browser cache, or using a different browser. Some ad blockers may also interfere with map functionality.",
      category: "Technical"
    },
    {
      id: 10,
      question: "How often is weather data updated?",
      answer: "We fetch fresh data every time you visit or refresh the page. OpenWeatherMap updates their data every 10-15 minutes for current conditions. Forecast data is updated every 3 hours.",
      category: "Data"
    },
    {
      id: 11,
      question: "Is my location data stored or shared?",
      answer: "No, we don't permanently store your precise location. Coordinates are only used for real-time weather requests and are not saved to our servers or shared with third parties. See our Privacy Policy for details.",
      category: "Privacy"
    },
    {
      id: 12,
      question: "What should I do if weather data seems incorrect?",
      answer: "Weather data comes from OpenWeatherMap's network of weather stations. If data seems inaccurate, it may be due to local conditions or station proximity. Cross-reference with other weather services and report persistent issues through our support system."
    }
  ];

  const categories = ['All', 'API', 'Weather', 'Location', 'Account', 'Technical', 'Privacy', 'Settings', 'Data', 'Accuracy'];

  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredFaqs = selectedCategory === 'All' 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  const handleSubmitTicket = (e) => {
    e.preventDefault();
    
    const ticket = {
      id: Date.now().toString(),
      ...newTicket,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 1,
          sender: 'user',
          message: newTicket.description,
          timestamp: new Date().toISOString()
        }
      ]
    };

    const updatedTickets = [ticket, ...tickets];
    setTickets(updatedTickets);
    localStorage.setItem('supportTickets', JSON.stringify(updatedTickets));
    
    setNewTicket({
      subject: '',
      category: 'general',
      priority: 'medium',
      description: ''
    });

    alert('Support ticket created successfully! We\'ll respond within 24 hours.');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#ffd43b';
      case 'in-progress': return '#61ffd0';
      case 'resolved': return '#2fe79f';
      case 'closed': return '#c9f5e8';
      default: return '#ffd43b';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return '#2fe79f';
      case 'medium': return '#ffd43b';
      case 'high': return '#ff6b6b';
      case 'urgent': return '#ff4757';
      default: return '#ffd43b';
    }
  };

  return (
    <div className="help-support-container">
      <div className="help-support-card glass glass--lg">
        <h1 className="help-support-title">Help & Support</h1>
        <p className="help-support-subtitle">Find answers to common questions or get personalized help</p>
        
        <div className="help-tabs">
          <button 
            className={`help-tab ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            📚 Frequently Asked Questions
          </button>
          <button 
            className={`help-tab ${activeTab === 'tickets' ? 'active' : ''}`}
            onClick={() => setActiveTab('tickets')}
          >
            🎫 Support Tickets
          </button>
          <button 
            className={`help-tab ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            📧 Contact Information
          </button>
        </div>

        {activeTab === 'faq' && (
          <div className="faq-section">
            <div className="faq-categories">
              {categories.map(category => (
                <button
                  key={category}
                  className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="faq-list">
              {filteredFaqs.map(faq => (
                <div key={faq.id} className="faq-item">
                  <button
                    className="faq-question"
                    onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  >
                    <span className="faq-question-text">{faq.question}</span>
                    <span className="faq-toggle">
                      {expandedFaq === faq.id ? '−' : '+'}
                    </span>
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="faq-answer">
                      <p>{faq.answer}</p>
                      {faq.category && (
                        <span className="faq-category-tag">{faq.category}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="tickets-section">
            <div className="ticket-form-container">
              <h3>Create New Support Ticket</h3>
              <form onSubmit={handleSubmitTicket} className="ticket-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Subject</label>
                    <input
                      type="text"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={newTicket.category}
                      onChange={(e) => setNewTicket({...newTicket, category: e.target.value})}
                    >
                      <option value="general">General Support</option>
                      <option value="technical">Technical Issue</option>
                      <option value="account">Account Problem</option>
                      <option value="api">API/Data Issues</option>
                      <option value="feature">Feature Request</option>
                      <option value="bug">Bug Report</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket({...newTicket, priority: e.target.value})}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                    placeholder="Provide detailed information about your issue..."
                    rows="4"
                    required
                  />
                </div>
                <button type="submit" className="submit-ticket-btn">
                  Create Ticket
                </button>
              </form>
            </div>

            <div className="tickets-list">
              <h3>Your Support Tickets</h3>
              {tickets.length === 0 ? (
                <div className="no-tickets">
                  <p>No support tickets yet. Create one above if you need help!</p>
                </div>
              ) : (
                <div className="tickets-grid">
                  {tickets.map(ticket => (
                    <div key={ticket.id} className="ticket-card">
                      <div className="ticket-header">
                        <h4>{ticket.subject}</h4>
                        <span 
                          className="ticket-status"
                          style={{ backgroundColor: getStatusColor(ticket.status) }}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <div className="ticket-meta">
                        <span className="ticket-id">#{ticket.id}</span>
                        <span 
                          className="ticket-priority"
                          style={{ color: getPriorityColor(ticket.priority) }}
                        >
                          {ticket.priority} priority
                        </span>
                      </div>
                      <p className="ticket-preview">
                        {ticket.description.substring(0, 100)}...
                      </p>
                      <div className="ticket-footer">
                        <span className="ticket-date">
                          Created: {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                        <button className="view-ticket-btn">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="contact-section">
            <div className="contact-grid">
              <div className="contact-card">
                <div className="contact-icon">📧</div>
                <h3>Email Support</h3>
                <p>Get help via email for non-urgent issues</p>
                <a href="mailto:support@aether-weather.com" className="contact-link">
                  support@aether-weather.com
                </a>
                <small>Response time: 24-48 hours</small>
              </div>

              <div className="contact-card">
                <div className="contact-icon">💬</div>
                <h3>Live Chat</h3>
                <p>Chat with our support team in real-time</p>
                <button className="contact-link" disabled>
                  Coming Soon
                </button>
                <small>Available: Mon-Fri 9AM-6PM</small>
              </div>

              <div className="contact-card">
                <div className="contact-icon">📋</div>
                <h3>Documentation</h3>
                <p>Comprehensive guides and tutorials</p>
                <button 
                  className="contact-link"
                  onClick={() => navigate('/api-limitations')}
                >
                  View Documentation
                </button>
                <small>Updated regularly</small>
              </div>

              <div className="contact-card">
                <div className="contact-icon">🐛</div>
                <h3>Bug Reports</h3>
                <p>Report bugs and technical issues</p>
                <button 
                  className="contact-link"
                  onClick={() => setActiveTab('tickets')}
                >
                  Create Bug Report
                </button>
                <small>Include steps to reproduce</small>
              </div>
            </div>

            <div className="contact-info">
              <h3>Additional Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <strong>Business Hours:</strong>
                  <p>Monday - Friday: 9:00 AM - 6:00 PM (UTC)</p>
                </div>
                <div className="info-item">
                  <strong>Emergency Contact:</strong>
                  <p>For critical issues affecting multiple users</p>
                </div>
                <div className="info-item">
                  <strong>Response Time:</strong>
                  <p>Urgent: 4 hours | High: 12 hours | Medium/Low: 24-48 hours</p>
                </div>
                <div className="info-item">
                  <strong>Languages Supported:</strong>
                  <p>English (primary), with plans for multilingual support</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <button 
          className="help-back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
      </div>
    </div>
  );
};

export default HelpSupport;
