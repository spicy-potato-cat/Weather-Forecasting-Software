import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/navbar/navbar.jsx';
import './AdminTickets.css';

function AdminTickets() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [statistics, setStatistics] = useState({
    open_count: 0,
    reopened_count: 0,
    closed_count: 0,
    high_priority_count: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    priority: ''
  });
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [filters]);

  const checkAdminAccess = async () => {
    const token = localStorage.getItem('authToken');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (!token || !user.is_admin) {
      alert('Admin access required');
      navigate('/');
      return;
    }
  };

  const fetchTickets = async () => {
    const token = localStorage.getItem('authToken');
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.priority) params.append('priority', filters.priority);

      const res = await fetch(`http://localhost:5000/api/tickets/admin/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();

      if (data.success) {
        setTickets(data.tickets);
        if (data.statistics) {
          setStatistics(data.statistics);
        }
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    const token = localStorage.getItem('authToken');

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
        fetchTickets();
      } else {
        alert(data.message || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message');
    }
  };

  const handleCloseTicket = async (ticketId) => {
    const reason = prompt('Resolution notes (optional):');

    const token = localStorage.getItem('authToken');

    try {
      const res = await fetch(`http://localhost:5000/api/tickets/${ticketId}/close`, {
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
        alert('Ticket marked as solved');
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'open': return '#2fe79f';
      case 'reopened': return '#ff9500';
      case 'closed': return '#666';
      default: return '#fff';
    }
  };

  const getPriorityBadgeColor = (priority) => {
    switch (priority) {
      case 'high': return '#ff6b6b';
      case 'medium': return '#ffa500';
      case 'low': return '#61ffd0';
      default: return '#fff';
    }
  };

  return (
    <>
      <NavBar title="Admin: Support Tickets" />

      <div className="admin-tickets-container">
        {/* Statistics Dashboard */}
        <div className="tickets-stats">
          <div className="stat-card">
            <div className="stat-icon">📬</div>
            <div className="stat-value">{statistics.open_count}</div>
            <div className="stat-label">Open Tickets</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔄</div>
            <div className="stat-value">{statistics.reopened_count}</div>
            <div className="stat-label">Reopened</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-value">{statistics.closed_count}</div>
            <div className="stat-label">Closed</div>
          </div>
          <div className="stat-card urgent">
            <div className="stat-icon">🔥</div>
            <div className="stat-value">{statistics.high_priority_count}</div>
            <div className="stat-label">High Priority</div>
          </div>
        </div>

        {/* Filters */}
        <div className="tickets-filters">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="reopened">Reopened</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          >
            <option value="">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button onClick={() => setFilters({ status: '', priority: '' })}>
            Clear Filters
          </button>
        </div>

        {/* Tickets Table */}
        {loading ? (
          <div className="tickets-loading">Loading tickets...</div>
        ) : (
          <div className="tickets-table-container">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>User</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Messages</th>
                  <th>Created</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>#{ticket.id}</td>
                    <td className="ticket-subject">{ticket.subject}</td>
                    <td>
                      <div className="user-info">
                        <div>{ticket.user_name}</div>
                        <div className="user-email">{ticket.user_email}</div>
                      </div>
                    </td>
                    <td>{ticket.category}</td>
                    <td>
                      <span
                        className="priority-badge"
                        style={{ background: getPriorityBadgeColor(ticket.priority) }}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: getStatusBadgeColor(ticket.status) }}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td>{ticket.message_count}</td>
                    <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                    <td>{new Date(ticket.updated_at).toLocaleString()}</td>
                    <td>
                      <button
                        className="action-btn view-btn"
                        onClick={() => fetchTicketDetails(ticket.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ticket Details Modal */}
        {selectedTicket && (
          <div className="admin-ticket-modal-overlay" onClick={() => setSelectedTicket(null)}>
            <div className="admin-ticket-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2>Ticket #{selectedTicket.id}</h2>
                <button onClick={() => setSelectedTicket(null)}>✕</button>
              </div>

              <div className="admin-modal-body">
                {/* User Info */}
                <div className="ticket-user-card">
                  <h3>Customer Information</h3>
                  <p><strong>Name:</strong> {selectedTicket.user_name}</p>
                  <p><strong>Email:</strong> {selectedTicket.user_email}</p>
                  <p><strong>Created:</strong> {new Date(selectedTicket.created_at).toLocaleString()}</p>
                </div>

                {/* Ticket Info */}
                <div className="ticket-info-card">
                  <h4>{selectedTicket.subject}</h4>
                  <div className="ticket-meta-badges">
                    <span
                      className="badge"
                      style={{ background: getStatusBadgeColor(selectedTicket.status) }}
                    >
                      {selectedTicket.status}
                    </span>
                    <span
                      className="badge"
                      style={{ background: getPriorityBadgeColor(selectedTicket.priority) }}
                    >
                      {selectedTicket.priority}
                    </span>
                    <span className="badge">{selectedTicket.category}</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="admin-ticket-messages">
                  <h3>Conversation</h3>
                  {selectedTicket.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`admin-message ${msg.is_admin_reply ? 'admin-reply' : 'user-message'}`}
                    >
                      <div className="message-sender">
                        <strong>{msg.sender_name}</strong>
                        {msg.is_admin_reply && <span className="admin-label">Admin</span>}
                        <span className="message-timestamp">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p>{msg.message}</p>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                {selectedTicket.status !== 'closed' && (
                  <div className="admin-reply-form">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your response to the customer..."
                      rows={4}
                    />
                    <div className="reply-actions">
                      <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="send-btn"
                      >
                        Send Response
                      </button>
                      <button
                        onClick={() => handleCloseTicket(selectedTicket.id)}
                        className="resolve-btn"
                      >
                        Mark as Solved
                      </button>
                    </div>
                  </div>
                )}

                {selectedTicket.status === 'closed' && (
                  <div className="ticket-closed-notice">
                    <p>✅ This ticket has been closed</p>
                    {selectedTicket.closed_by_name && (
                      <p>Closed by: {selectedTicket.closed_by_name} on {new Date(selectedTicket.closed_at).toLocaleString()}</p>
                    )}
                  </div>
                )}

                {/* Status History */}
                {selectedTicket.history && selectedTicket.history.length > 0 && (
                  <div className="ticket-history">
                    <h3>Status History</h3>
                    {selectedTicket.history.map((h, idx) => (
                      <div key={idx} className="history-item">
                        <span>{h.old_status || 'created'} → {h.new_status}</span>
                        <span>by {h.changed_by_name}</span>
                        <span>{new Date(h.changed_at).toLocaleString()}</span>
                        {h.reason && <p className="history-reason">{h.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default AdminTickets;