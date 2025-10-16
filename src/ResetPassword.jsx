import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './login.css';

function ResetPassword() {
  const [form, setForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Pre-fill email if passed from forgot password page
    if (location.state?.email) {
      setForm(prev => ({ ...prev, email: location.state.email }));
    }
  }, [location]);

  const validate = () => {
    const e = {};
    
    if (!form.email.trim()) {
      e.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      e.email = 'Invalid email format';
    }
    
    if (!form.otp.trim()) {
      e.otp = 'Verification code is required';
    } else if (form.otp.length !== 6) {
      e.otp = 'Code must be 6 digits';
    }
    
    if (!form.newPassword) {
      e.newPassword = 'New password is required';
    } else if (form.newPassword.length < 6) {
      e.newPassword = 'Password must be at least 6 characters';
    }
    
    if (!form.confirmPassword) {
      e.confirmPassword = 'Please confirm your password';
    } else if (form.newPassword !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
    if (status.message) setStatus({ loading: false, message: '', type: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setStatus({ loading: true, message: 'Resetting password...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          otp: form.otp.trim(),
          newPassword: form.newPassword
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setStatus({ 
        loading: false, 
        message: 'Password reset successful! Redirecting to login...', 
        type: 'success' 
      });

      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {
      console.error('Reset password error:', err);
      setStatus({ 
        loading: false, 
        message: err.message || 'Failed to reset password', 
        type: 'error' 
      });
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-card" noValidate>
        <h1 className="login-title">Reset Password</h1>
        <p style={{ color: '#c9f5e8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Enter the verification code sent to your email and create a new password.
        </p>

        <label className="login-label">
          <span className="login-label-text">Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={`login-input ${errors.email ? 'login-input-error' : ''}`}
            autoComplete="email"
            disabled={status.loading}
          />
          {errors.email && <span className="login-error">{errors.email}</span>}
        </label>

        <label className="login-label">
          <span className="login-label-text">Verification Code</span>
          <input
            type="text"
            name="otp"
            value={form.otp}
            onChange={handleChange}
            placeholder="123456"
            maxLength={6}
            className={`login-input ${errors.otp ? 'login-input-error' : ''}`}
            autoComplete="off"
            disabled={status.loading}
            style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '4px', textAlign: 'center' }}
          />
          {errors.otp && <span className="login-error">{errors.otp}</span>}
        </label>

        <label className="login-label">
          <span className="login-label-text">New Password</span>
          <div className="login-password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`login-input ${errors.newPassword ? 'login-input-error' : ''}`}
              style={{ flex: 1 }}
              autoComplete="new-password"
              disabled={status.loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="login-toggle-btn"
              disabled={status.loading}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.newPassword && <span className="login-error">{errors.newPassword}</span>}
        </label>

        <label className="login-label">
          <span className="login-label-text">Confirm New Password</span>
          <div className="login-password-row">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`login-input ${errors.confirmPassword ? 'login-input-error' : ''}`}
              style={{ flex: 1 }}
              autoComplete="new-password"
              disabled={status.loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(s => !s)}
              className="login-toggle-btn"
              disabled={status.loading}
            >
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {errors.confirmPassword && <span className="login-error">{errors.confirmPassword}</span>}
        </label>

        <button type="submit" className="login-submit" disabled={status.loading}>
          {status.loading ? 'Resetting...' : 'Reset Password'}
        </button>

        {status.message && (
          <div className={`login-notice ${status.type === 'success' ? 'login-notice-success' : status.type === 'error' ? 'login-notice-error' : ''}`}>
            {status.message}
          </div>
        )}

        <div className="login-footer" style={{ justifyContent: 'center', gap: '1rem' }}>
          <Link to="/forgot-password" className="login-link">Didn't receive code?</Link>
          <Link to="/login" className="login-link">← Back to Login</Link>
        </div>
      </form>
    </div>
  );
}

export default ResetPassword;
