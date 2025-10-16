const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/authMiddleware');
const emailService = require('../services/emailService');
const crypto = require('crypto');

// Password change with current password
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  try {
    // Get user from database
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    // Send confirmation email
    try {
      await emailService.sendPasswordChangeConfirmation(user.email, user.name);
    } catch (emailErr) {
      console.error('Failed to send password change email:', emailErr);
    }

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send password reset OTP (for logged-in users)
router.post('/send-password-reset-otp', authenticateToken, async (req, res) => {
  const { email } = req.body;
  const userId = req.user.id;

  try {
    // Verify email matches user
    const [users] = await db.query('SELECT * FROM users WHERE id = ? AND email = ?', [userId, email]);
    
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database (reuse password_reset_token table)
    await db.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?, expires_at = ?',
      [userId, otp, otpExpiry, otp, otpExpiry]
    );

    // Send OTP via email
    await emailService.sendPasswordResetOTP(email, user.name, otp);

    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// Reset password with OTP (for logged-in users)
router.post('/reset-password-with-otp', authenticateToken, async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const userId = req.user.id;

  if (!otp || !newPassword) {
    return res.status(400).json({ message: 'OTP and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    // Verify OTP
    const [tokens] = await db.query(
      'SELECT * FROM password_reset_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [userId, otp]
    );

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

    // Delete used OTP
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);

    // Get user info for confirmation email
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = users[0];

    // Send confirmation email
    try {
      await emailService.sendPasswordChangeConfirmation(user.email, user.name);
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
    }

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send email change OTP
router.post('/send-email-change-otp', authenticateToken, async (req, res) => {
  const { newEmail } = req.body;
  const userId = req.user.id;

  if (!newEmail || !newEmail.includes('@')) {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  try {
    // Check if email already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ? AND id != ?', [newEmail, userId]);
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Get current user
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = users[0];

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP (create table if needed or reuse existing)
    await db.query(
      'INSERT INTO email_change_tokens (user_id, new_email, token, expires_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE new_email = ?, token = ?, expires_at = ?',
      [userId, newEmail, otp, otpExpiry, newEmail, otp, otpExpiry]
    );

    // Send OTP to new email
    await emailService.sendEmailChangeOTP(newEmail, user.name, otp);

    res.json({ message: 'Verification code sent to new email' });
  } catch (err) {
    console.error('Send email change OTP error:', err);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
});

// Change email with OTP verification
router.post('/change-email', authenticateToken, async (req, res) => {
  const { newEmail, otp } = req.body;
  const userId = req.user.id;

  if (!newEmail || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  try {
    // Verify OTP
    const [tokens] = await db.query(
      'SELECT * FROM email_change_tokens WHERE user_id = ? AND new_email = ? AND token = ? AND expires_at > NOW()',
      [userId, newEmail, otp]
    );

    if (!tokens || tokens.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Check if email is still available
    const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ? AND id != ?', [newEmail, userId]);
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    // Get old email for confirmation
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const oldEmail = users[0].email;
    const userName = users[0].name;

    // Update email
    await db.query('UPDATE users SET email = ? WHERE id = ?', [newEmail, userId]);

    // Delete used token
    await db.query('DELETE FROM email_change_tokens WHERE user_id = ?', [userId]);

    // Send confirmation to both emails
    try {
      await emailService.sendEmailChangeConfirmation(oldEmail, newEmail, userName);
    } catch (emailErr) {
      console.error('Failed to send confirmation emails:', emailErr);
    }

    res.json({ message: 'Email changed successfully' });
  } catch (err) {
    console.error('Email change error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get account settings
router.get('/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const [settings] = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
    
    if (!settings || settings.length === 0) {
      // Return default settings
      return res.json({
        settings: {
          emailNotifications: true,
          weatherAlerts: true,
          weeklyDigest: false,
          dataSharing: false,
        }
      });
    }

    res.json({
      settings: {
        emailNotifications: settings[0].email_notifications,
        weatherAlerts: settings[0].weather_alerts,
        weeklyDigest: settings[0].weekly_digest,
        dataSharing: settings[0].data_sharing,
      }
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update account settings
router.put('/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { emailNotifications, weatherAlerts, weeklyDigest, dataSharing } = req.body;

  try {
    // Insert or update settings
    await db.query(
      `INSERT INTO user_settings (user_id, email_notifications, weather_alerts, weekly_digest, data_sharing) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       email_notifications = ?, weather_alerts = ?, weekly_digest = ?, data_sharing = ?`,
      [
        userId, emailNotifications, weatherAlerts, weeklyDigest, dataSharing,
        emailNotifications, weatherAlerts, weeklyDigest, dataSharing
      ]
    );

    res.json({ message: 'Settings saved successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Get user info before deletion
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = users[0];

    // Delete related data
    await db.query('DELETE FROM user_preferences WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM user_locations WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM email_change_tokens WHERE user_id = ?', [userId]);
    
    // Delete user
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    // Send goodbye email
    try {
      await emailService.sendAccountDeletionConfirmation(user.email, user.name);
    } catch (emailErr) {
      console.error('Failed to send deletion email:', emailErr);
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;