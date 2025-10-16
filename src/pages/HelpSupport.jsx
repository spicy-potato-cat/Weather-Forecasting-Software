import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/navbar/navbar.jsx';
import './HelpSupport.css';

const HelpSupport = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faq');
  const [expandedFaq, setExpandedFaq] = useState(null);
  
  // ADDED: Ticketing system state
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'technical',
    priority: 'medium',
    message: ''
  });
  const [newMessage, setNewMessage] = useState('');
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState(''); // ADDED: Error state for ticket form

  // ADDED: Fetch user's tickets
  const fetchTickets = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    setLoadingTickets(true);
    try {
      const res = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();
      
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // ADDED: Fetch single ticket with messages
  const fetchTicketDetails = async (ticketId) => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();
      
      if (data.success) {
        setSelectedTicket(data.ticket);
      }
    } catch (err) {
      console.error('Failed to fetch ticket details:', err);
    }
  };

  // FIXED: Create new ticket with proper validation
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    
    // Clear previous error
    setTicketError('');

    const token = localStorage.getItem('authToken');
    if (!token) {
      setTicketError('Please sign in to create support tickets');
      return;
    }

    // Frontend validation
    if (!ticketForm.subject || ticketForm.subject.trim().length < 3) {
      setTicketError('Subject must be at least 3 characters');
      return;
    }

    if (!ticketForm.message || ticketForm.message.trim().length < 10) {
      setTicketError('Message must be at least 10 characters');
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          subject: ticketForm.subject.trim(),
          category: ticketForm.category,
          priority: ticketForm.priority,
          message: ticketForm.message.trim() // FIXED: Send 'message' not 'description'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.errors?.[0] || 'Failed to create ticket');
      }

      if (data.success) {
        setTicketError(''); // Clear error
        setTicketForm({ subject: '', category: 'technical', priority: 'medium', message: '' });
        fetchTickets();
        
        // Show success message briefly
        setTicketError('✅ Support ticket created successfully!');
        setTimeout(() => setTicketError(''), 3000);
      } else {
        setTicketError(data.message || 'Failed to create ticket');
      }
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setTicketError(err.message || 'Failed to create ticket. Please try again.');
    }
  };

  // ADDED: Add message to ticket
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    const token = localStorage.getItem('authToken');

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ message: newMessage })
      });

      const data = await res.json();

      if (data.success) {
        setNewMessage('');
        fetchTicketDetails(selectedTicket.id);
      } else {
        alert(data.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message');
    }
  };

  // ADDED: Close ticket
  const handleCloseTicket = async (ticketId) => {
    if (!confirm('Are you sure you want to close this ticket?')) return;

    const token = localStorage.getItem('authToken');

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/close`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();

      if (data.success) {
        alert('Ticket closed successfully');
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          fetchTicketDetails(ticketId);
        }
      } else {
        alert(data.message || 'Failed to close ticket');
      }
    } catch (err) {
      console.error('Failed to close ticket:', err);
      alert('Failed to close ticket');
    }
  };

  // ADDED: Reopen ticket
  const handleReopenTicket = async (ticketId) => {
    const reason = prompt('Reason for reopening:');
    if (!reason) return;

    const token = localStorage.getItem('authToken');

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/reopen`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await res.json();

      if (data.success) {
        alert('Ticket reopened successfully');
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          fetchTicketDetails(ticketId);
        }
      } else {
        alert(data.message || 'Failed to reopen ticket');
      }
    } catch (err) {
      console.error('Failed to reopen ticket:', err);
      alert('Failed to reopen ticket');
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const faqs = [
    {
      id: 1,
      question: "Why am I seeing 'API limit exceeded' errors?",
      answer: "Weather APIs have usage limitations. We use free-tier OpenWeatherMap API which allows 1,000 calls per day. During peak usage, this limit may be reached. Try refreshing later or check our API Limitations page for more details.",
      category: "API"
    },
    // ...existing FAQs...
  ];

  const categories = ['All', 'API', 'Weather', 'Location', 'Account', 'Technical', 'Privacy', 'Settings', 'Data', 'Accuracy'];
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredFaqs = selectedCategory === 'All' 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  return (
    <>
      <NavBar title="Help & Support" />
      
      <div className="help-support-container">
        <div className="help-support-card glass glass--lg">
          <h1 className="help-support-title">Help & Support</h1>
          <p className="help-support-subtitle">Find answers to common questions or get personalized help</p>
          
          <div className="help-tabs">
            <button 
              className={`help-tab ${activeTab === 'faq' ? 'active' : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              📚 FAQ
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
              📧 Contact
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
              {/* Create Ticket Form */}
              <details className="help-collapsible">
                <summary>Create New Ticket</summary>
                <form onSubmit={handleCreateTicket} className="ticket-form">
                  {/* ADDED: Error message display */}
                  {ticketError && (
                    <div className={`ticket-form-message ${ticketError.startsWith('✅') ? 'success' : 'error'}`}>
                      {ticketError}
                    </div>
                  )}

                  <div className="form-group">
                    <label>Subject *</label>
                    <input
                      type="text"
                      value={ticketForm.subject}
                      onChange={(e) => {
                        setTicketForm({ ...ticketForm, subject: e.target.value });
                        setTicketError(''); // Clear error on input
                      }}
                      required
                      placeholder="Brief description of your issue"
                      minLength={3}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Category *</label>
                      <select
                        value={ticketForm.category}
                        onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                      >
                        <option value="technical">Technical Issue</option>
                        <option value="billing">Billing</option>
                        <option value="feature_request">Feature Request</option>
                        <option value="bug_report">Bug Report</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Priority</label>
                      <select
                        value={ticketForm.priority}
                        onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description *</label>
                    <textarea
                      value={ticketForm.message}
                      onChange={(e) => {
                        setTicketForm({ ...ticketForm, message: e.target.value });
                        setTicketError(''); // Clear error on input
                      }}
                      required
                      rows={6}
                      placeholder="Describe your issue in detail..."
                      minLength={10}
                    />
                  </div>

                  <button type="submit" className="help-btn help-btn-primary">
                    Submit Ticket
                  </button>
                </form>
              </details>

              {/* My Tickets List */}
              <div className="tickets-list-section">
                <h3>My Tickets</h3>
                
                {loadingTickets ? (
                  <p>Loading tickets...</p>
                ) : tickets.length === 0 ? (
                  <p className="no-tickets">No support tickets yet. Create one above if you need help!</p>
                ) : (
                  <div className="tickets-list">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className={`ticket-card ${ticket.status}`}
                        onClick={() => fetchTicketDetails(ticket.id)}
                      >
                        <div className="ticket-header">
                          <span className="ticket-id">#{ticket.id}</span>
                          <span className={`ticket-status status-${ticket.status}`}>
                            {ticket.status}
                          </span>
                          <span className={`ticket-priority priority-${ticket.priority}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <h4>{ticket.subject}</h4>
                        <div className="ticket-meta">
                          <span>📂 {ticket.category}</span>
                          <span>💬 {ticket.message_count} messages</span>
                          <span>🕐 {new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ticket Details Modal */}
              {selectedTicket && (
                <div className="ticket-modal-overlay" onClick={() => setSelectedTicket(null)}>
                  <div className="ticket-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="ticket-modal-header">
                      <h3>Ticket #{selectedTicket.id}</h3>
                      <button onClick={() => setSelectedTicket(null)}>✕</button>
                    </div>

                    <div className="ticket-modal-body">
                      <div className="ticket-details">
                        <h4>{selectedTicket.subject}</h4>
                        <div className="ticket-badges">
                          <span className={`badge status-${selectedTicket.status}`}>
                            {selectedTicket.status}
                          </span>
                          <span className={`badge priority-${selectedTicket.priority}`}>
                            {selectedTicket.priority}
                          </span>
                          <span className="badge">{selectedTicket.category}</span>
                        </div>
                        <p className="ticket-date">
                          Created: {new Date(selectedTicket.created_at).toLocaleString()}
                        </p>
                      </div>

                      {/* Messages */}
                      <div className="ticket-messages">
                        {selectedTicket.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`ticket-message ${msg.is_admin_reply ? 'admin' : 'user'}`}
                          >
                            <div className="message-header">
                              <strong>{msg.sender_name}</strong>
                              {msg.is_admin_reply && <span className="admin-badge">Admin</span>}
                              <span className="message-time">
                                {new Date(msg.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p>{msg.message}</p>
                          </div>
                        ))}
                      </div>

                      {/* Reply Box (only if not closed) */}
                      {selectedTicket.status !== 'closed' && (
                        <div className="ticket-reply">
                          <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            rows={3}
                          />
                          <button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                            Send Message
                          </button>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="ticket-actions">
                        {selectedTicket.status === 'closed' ? (
                          <button onClick={() => handleReopenTicket(selectedTicket.id)} className="btn-reopen">
                            Reopen Ticket
                          </button>
                        ) : (
                          <button onClick={() => handleCloseTicket(selectedTicket.id)} className="btn-close">
                            Close Ticket
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="contact-section">
              {/* ...existing contact section code... */}
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
    </>
  );
};

export default HelpSupport;