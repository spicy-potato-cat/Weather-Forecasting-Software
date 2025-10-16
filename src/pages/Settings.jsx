import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/navbar/navbar.jsx';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('security');
  const [status, setStatus] = useState({ loading: false, message: '', type: '' });

  // Security tab states
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [useOtp, setUseOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  // Email change states
  const [emailData, setEmailData] = useState({
    newEmail: '',
    otp: '',
  });
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpTimer, setEmailOtpTimer] = useState(0);

  // Account settings states
  const [accountSettings, setAccountSettings] = useState({
    emailNotifications: true,
    weatherAlerts: true,
    weeklyDigest: false,
    dataSharing: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(userData));
    fetchAccountSettings(token);
    
    // ADDED: Listen for logout to clear settings
    const handleLogout = () => {
      console.log('🧹 Clearing settings state');
      setUser(null);
      setAccountSettings({
        emailNotifications: true,
        weatherAlerts: true,
        weeklyDigest: false,
        dataSharing: false,
      });
    };
    
    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      window.removeEventListener('user-logout', handleLogout);
    };
  }, [navigate]);

  // OTP timer countdown
  useEffect(() => {
    let interval;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  useEffect(() => {
    let interval;
    if (emailOtpTimer > 0) {
      interval = setInterval(() => {
        setEmailOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailOtpTimer]);

  const fetchAccountSettings = async (token) => {
    try {
      const res = await fetch('http://localhost:5000/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setAccountSettings(prev => ({ ...prev, ...data.settings }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  // PASSWORD CHANGE FUNCTIONS
  const sendPasswordOtp = async () => {
    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Sending OTP...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/auth/send-password-reset-otp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: user.email })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      setOtpSent(true);
      setOtpTimer(300); // 5 minutes
      setStatus({ loading: false, message: 'OTP sent to your email!', type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const changePasswordWithCurrent = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatus({ loading: false, message: 'New passwords do not match', type: 'error' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setStatus({ loading: false, message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Changing password...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/user/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setStatus({ loading: false, message: 'Password changed successfully!', type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const changePasswordWithOtp = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setStatus({ loading: false, message: 'New passwords do not match', type: 'error' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setStatus({ loading: false, message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Verifying OTP...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password-with-otp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          otp: otp,
          newPassword: passwordData.newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setOtp('');
      setOtpSent(false);
      setOtpTimer(0);
      setStatus({ loading: false, message: 'Password changed successfully!', type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  // EMAIL CHANGE FUNCTIONS
  const sendEmailChangeOtp = async () => {
    if (!emailData.newEmail || !emailData.newEmail.includes('@')) {
      setStatus({ loading: false, message: 'Please enter a valid email', type: 'error' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Sending verification code...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/user/send-email-change-otp', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ newEmail: emailData.newEmail })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to send verification code');

      setEmailOtpSent(true);
      setEmailOtpTimer(300); // 5 minutes
      setStatus({ loading: false, message: `Verification code sent to ${emailData.newEmail}!`, type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const changeEmail = async () => {
    if (!emailData.otp || emailData.otp.length !== 6) {
      setStatus({ loading: false, message: 'Please enter a valid 6-digit code', type: 'error' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Verifying code...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/user/change-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          newEmail: emailData.newEmail,
          otp: emailData.otp
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to change email');

      // Update user data
      const updatedUser = { ...user, email: emailData.newEmail };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      setEmailData({ newEmail: '', otp: '' });
      setEmailOtpSent(false);
      setEmailOtpTimer(0);
      setStatus({ loading: false, message: 'Email changed successfully!', type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  // ACCOUNT SETTINGS FUNCTIONS
  const saveAccountSettings = async () => {
    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Saving settings...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/user/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(accountSettings)
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to save settings');

      setStatus({ loading: false, message: 'Settings saved successfully!', type: 'success' });
      
      setTimeout(() => setStatus({ loading: false, message: '', type: '' }), 3000);
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to delete your account?\n\nThis action cannot be undone. All your data, saved locations, and preferences will be permanently deleted.'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'This is your final warning. Type "DELETE" in the next prompt to confirm account deletion.'
    );

    if (!doubleConfirm) return;

    const deleteConfirmation = prompt('Type DELETE to confirm account deletion:');

    if (deleteConfirmation !== 'DELETE') {
      setStatus({ loading: false, message: 'Account deletion cancelled', type: 'info' });
      return;
    }

    const token = localStorage.getItem('authToken');
    setStatus({ loading: true, message: 'Deleting account...', type: 'info' });

    try {
      const res = await fetch('http://localhost:5000/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to delete account');

      // Clear all user data
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      sessionStorage.clear();

      alert('Account deleted successfully. You will be redirected to the home page.');
      navigate('/');
    } catch (err) {
      setStatus({ loading: false, message: err.message, type: 'error' });
    }
  };

  if (!user) return null;

  return (
    <>
      <NavBar title="Settings" />
      
      <div className="settings-container">
        <div className="settings-card">
          <h1 className="settings-title">Account Settings</h1>

          {/* Tabs */}
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              🔒 Security
            </button>
            <button
              className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              ⚙️ Account
            </button>
            <button
              className={`settings-tab ${activeTab === 'danger' ? 'active' : ''}`}
              onClick={() => setActiveTab('danger')}
            >
              ⚠️ Danger Zone
            </button>
          </div>

          {/* Status Message */}
          {status.message && (
            <div className={`settings-notice settings-notice-${status.type}`}>
              {status.message}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="settings-content">
              {/* Change Password Section */}
              <div className="settings-section">
                <h2 className="settings-section-title">Change Password</h2>
                
                <div className="settings-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={useOtp}
                      onChange={(e) => {
                        setUseOtp(e.target.checked);
                        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setOtp('');
                        setOtpSent(false);
                      }}
                    />
                    <span>Use OTP instead of current password</span>
                  </label>
                </div>

                {!useOtp ? (
                  <>
                    <div className="settings-input-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        placeholder="Enter current password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      />
                    </div>

                    <div className="settings-input-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        placeholder="Enter new password (min 6 characters)"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      />
                    </div>

                    <div className="settings-input-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      />
                    </div>

                    <button
                      className="settings-btn settings-btn-primary"
                      onClick={changePasswordWithCurrent}
                      disabled={status.loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                    >
                      Change Password
                    </button>
                  </>
                ) : (
                  <>
                    {!otpSent ? (
                      <>
                        <p className="settings-help-text">
                          We'll send a verification code to <strong>{user.email}</strong>
                        </p>
                        <button
                          className="settings-btn settings-btn-secondary"
                          onClick={sendPasswordOtp}
                          disabled={status.loading}
                        >
                          Send OTP
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="settings-input-group">
                          <label>Verification Code</label>
                          <input
                            type="text"
                            placeholder="Enter 6-digit code"
                            maxLength="6"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          />
                          {otpTimer > 0 && (
                            <span className="settings-timer">
                              Code expires in {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
                            </span>
                          )}
                        </div>

                        <div className="settings-input-group">
                          <label>New Password</label>
                          <input
                            type="password"
                            placeholder="Enter new password (min 6 characters)"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          />
                        </div>

                        <div className="settings-input-group">
                          <label>Confirm New Password</label>
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          />
                        </div>

                        <div className="settings-btn-group">
                          <button
                            className="settings-btn settings-btn-primary"
                            onClick={changePasswordWithOtp}
                            disabled={status.loading || !otp || !passwordData.newPassword || !passwordData.confirmPassword}
                          >
                            Verify & Change Password
                          </button>
                          <button
                            className="settings-btn settings-btn-link"
                            onClick={sendPasswordOtp}
                            disabled={status.loading || otpTimer > 240}
                          >
                            Resend Code
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Change Email Section */}
              <div className="settings-section">
                <h2 className="settings-section-title">Change Email Address</h2>
                <p className="settings-help-text">
                  Current email: <strong>{user.email}</strong>
                </p>

                {!emailOtpSent ? (
                  <>
                    <div className="settings-input-group">
                      <label>New Email Address</label>
                      <input
                        type="email"
                        placeholder="Enter new email"
                        value={emailData.newEmail}
                        onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
                      />
                    </div>

                    <button
                      className="settings-btn settings-btn-secondary"
                      onClick={sendEmailChangeOtp}
                      disabled={status.loading || !emailData.newEmail}
                    >
                      Send Verification Code
                    </button>
                  </>
                ) : (
                  <>
                    <div className="settings-input-group">
                      <label>Verification Code</label>
                      <input
                        type="text"
                        placeholder="Enter 6-digit code sent to new email"
                        maxLength="6"
                        value={emailData.otp}
                        onChange={(e) => setEmailData({ ...emailData, otp: e.target.value.replace(/\D/g, '') })}
                      />
                      {emailOtpTimer > 0 && (
                        <span className="settings-timer">
                          Code expires in {Math.floor(emailOtpTimer / 60)}:{(emailOtpTimer % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    <div className="settings-btn-group">
                      <button
                        className="settings-btn settings-btn-primary"
                        onClick={changeEmail}
                        disabled={status.loading || !emailData.otp}
                      >
                        Verify & Change Email
                      </button>
                      <button
                        className="settings-btn settings-btn-link"
                        onClick={sendEmailChangeOtp}
                        disabled={status.loading || emailOtpTimer > 240}
                      >
                        Resend Code
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="settings-content">
              <div className="settings-section">
                <h2 className="settings-section-title">Notification Preferences</h2>

                <div className="settings-checkbox-group">
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={accountSettings.emailNotifications}
                      onChange={(e) => setAccountSettings({ ...accountSettings, emailNotifications: e.target.checked })}
                    />
                    <div>
                      <span className="settings-checkbox-title">Email Notifications</span>
                      <span className="settings-checkbox-desc">Receive weather updates and alerts via email</span>
                    </div>
                  </label>

                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={accountSettings.weatherAlerts}
                      onChange={(e) => setAccountSettings({ ...accountSettings, weatherAlerts: e.target.checked })}
                    />
                    <div>
                      <span className="settings-checkbox-title">Severe Weather Alerts</span>
                      <span className="settings-checkbox-desc">Get notified about severe weather in your saved locations</span>
                    </div>
                  </label>

                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={accountSettings.weeklyDigest}
                      onChange={(e) => setAccountSettings({ ...accountSettings, weeklyDigest: e.target.checked })}
                    />
                    <div>
                      <span className="settings-checkbox-title">Weekly Digest</span>
                      <span className="settings-checkbox-desc">Receive a weekly summary of weather trends</span>
                    </div>
                  </label>
                </div>

                <button
                  className="settings-btn settings-btn-primary"
                  onClick={saveAccountSettings}
                  disabled={status.loading}
                >
                  Save Settings
                </button>
              </div>

              <div className="settings-section">
                <h2 className="settings-section-title">Privacy & Data</h2>

                <div className="settings-checkbox-group">
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={accountSettings.dataSharing}
                      onChange={(e) => setAccountSettings({ ...accountSettings, dataSharing: e.target.checked })}
                    />
                    <div>
                      <span className="settings-checkbox-title">Anonymous Data Sharing</span>
                      <span className="settings-checkbox-desc">Help improve our service by sharing anonymous usage data</span>
                    </div>
                  </label>
                </div>

                <button
                  className="settings-btn settings-btn-primary"
                  onClick={saveAccountSettings}
                  disabled={status.loading}
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="settings-content">
              <div className="settings-section settings-danger-zone">
                <h2 className="settings-section-title">Danger Zone</h2>
                
                <div className="settings-danger-warning">
                  <span className="settings-danger-icon">⚠️</span>
                  <div>
                    <strong>Warning:</strong> The following actions are irreversible and permanent.
                  </div>
                </div>

                <div className="settings-danger-item">
                  <div>
                    <h3>Delete Account</h3>
                    <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                  </div>
                  <button
                    className="settings-btn settings-btn-danger"
                    onClick={deleteAccount}
                    disabled={status.loading}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Settings;
