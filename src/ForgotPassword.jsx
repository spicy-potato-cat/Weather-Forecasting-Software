import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './login.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Invalid email format');
      return;
    }

    setStatus({ loading: true, message: 'Sending reset code...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send reset code');
      }

      setStatus({ 
        loading: false, 
        message: 'Reset code sent! Check your email.', 
        type: 'success' 
      });

      // Navigate to reset password page after 2 seconds
      setTimeout(() => {
        navigate('/reset-password', { state: { email: email.trim() } });
      }, 2000);

    } catch (err) {
      console.error('Forgot password error:', err);
      setStatus({ 
        loading: false, 
        message: err.message || 'Failed to send reset code', 
        type: 'error' 
      });
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-card" noValidate>
        <h1 className="login-title">Forgot Password</h1>
        <p style={{ color: '#c9f5e8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Enter your email and we'll send you a code to reset your password.
        </p>

        <label className="login-label">
          <span className="login-label-text">Email</span>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
              if (status.message) setStatus({ loading: false, message: '', type: '' });
            }}
            placeholder="you@example.com"
            className={`login-input ${error ? 'login-input-error' : ''}`}
            autoComplete="email"
            disabled={status.loading}
          />
          {error && <span className="login-error">{error}</span>}
        </label>

        <button type="submit" className="login-submit" disabled={status.loading}>
          {status.loading ? 'Sending...' : 'Send Reset Code'}
        </button>

        {status.message && (
          <div className={`login-notice ${status.type === 'success' ? 'login-notice-success' : status.type === 'error' ? 'login-notice-error' : ''}`}>
            {status.message}
          </div>
        )}

        <div className="login-footer" style={{ justifyContent: 'center', gap: '1rem' }}>
          <Link to="/login" className="login-link">← Back to Login</Link>
        </div>
      </form>
    </div>
  );
}

export default ForgotPassword;
