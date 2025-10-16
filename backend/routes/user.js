import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';
import emailService from '../src/services/emailService.js';

const router = express.Router();

// ========================================
// SAVED LOCATIONS ROUTES
// ========================================

// GET /api/user/locations - Get user's saved locations
router.get('/locations',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const result = await query(
        `SELECT id, location_name, latitude, longitude, is_primary, created_at 
         FROM saved_locations 
         WHERE user_id = $1 
         ORDER BY is_primary DESC, created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        locations: result.rows
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/user/locations - Add new saved location
router.post('/locations',
  authenticate,
  [
    body('location_name').trim().notEmpty().withMessage('Location name is required'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('is_primary').optional().isBoolean().withMessage('is_primary must be boolean')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const userId = req.user.id;
      const { location_name, latitude, longitude, is_primary = false } = req.body;

      // If setting as primary, unset other primary locations
      if (is_primary) {
        await query(
          'UPDATE saved_locations SET is_primary = FALSE WHERE user_id = $1',
          [userId]
        );
      }

      const result = await query(
        `INSERT INTO saved_locations (user_id, location_name, latitude, longitude, is_primary)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, location_name, latitude, longitude, is_primary, created_at`,
        [userId, location_name, latitude, longitude, is_primary]
      );

      console.log(`✅ Location saved: ${location_name} for user ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'Location saved successfully',
        location: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/user/locations/:locationId - Delete saved location
router.delete('/locations/:locationId',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { locationId } = req.params;

      // Verify location belongs to user
      const checkResult = await query(
        'SELECT id FROM saved_locations WHERE id = $1 AND user_id = $2',
        [locationId, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      await query(
        'DELETE FROM saved_locations WHERE id = $1 AND user_id = $2',
        [locationId, userId]
      );

      console.log(`✅ Location deleted: ID ${locationId} for user ${req.user.email}`);

      res.json({
        success: true,
        message: 'Location deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/user/locations/:locationId/primary - Set location as primary
router.put('/locations/:locationId/primary',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { locationId } = req.params;

      // Verify location belongs to user
      const checkResult = await query(
        'SELECT id FROM saved_locations WHERE id = $1 AND user_id = $2',
        [locationId, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Unset other primary locations
      await query(
        'UPDATE saved_locations SET is_primary = FALSE WHERE user_id = $1',
        [userId]
      );

      // Set this location as primary
      const result = await query(
        `UPDATE saved_locations SET is_primary = TRUE WHERE id = $1 AND user_id = $2
         RETURNING id, location_name, latitude, longitude, is_primary, created_at`,
        [locationId, userId]
      );

      console.log(`✅ Primary location set: ID ${locationId} for user ${req.user.email}`);

      res.json({
        success: true,
        message: 'Primary location updated',
        location: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  } 
);

// ========================================
// PASSWORD CHANGE ROUTES
// ========================================

// POST /api/user/change-password (with current password)
router.post('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Get user from database
      const userResult = await query(
        'SELECT id, email, password FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in PostgreSQL
      await query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, userId]
      );

      // Update hMail password
      if (process.env.NODE_ENV === 'development') {
        const hmailResult = await emailService.updateHmailPassword(user.email, newPassword);
        if (hmailResult.success) {
          console.log(`✅ hMail password updated for: ${user.email}`);
        } else {
          console.warn(`⚠️ hMail password update failed: ${hmailResult.message}`);
        }
      }

      console.log(`✅ Password changed for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/user/send-password-reset-otp (send OTP for password change)
router.post('/send-password-reset-otp',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user email
      const userResult = await query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration (5 minutes from now)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Store OTP in database
      await query(
        'UPDATE users SET password_reset_otp = $1, otp_expires_at = $2 WHERE id = $3',
        [otp, expiresAt, userId]
      );

      // Send OTP via email
      try {
        await emailService.sendPasswordResetOTP({
          to: user.email,
          otp,
          userName: user.name
        });

        console.log(`✅ Password reset OTP sent to: ${user.email}`);

        res.json({
          success: true,
          message: 'Verification code sent to your email'
        });
      } catch (emailError) {
        console.error('❌ Failed to send OTP email:', emailError.message);
        
        // Clear OTP if email fails
        await query(
          'UPDATE users SET password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $1',
          [userId]
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to send verification code. Please try again later.'
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/user/reset-password-with-otp (change password with OTP)
router.post('/reset-password-with-otp',
  authenticate,
  [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const { otp, newPassword } = req.body;
      const userId = req.user.id;

      // Get user with OTP
      const result = await query(
        'SELECT id, email, password_reset_otp, otp_expires_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = result.rows[0];

      // Check if OTP exists
      if (!user.password_reset_otp) {
        return res.status(400).json({
          success: false,
          message: 'No verification code found. Please request a new code.'
        });
      }

      // Check if OTP matches
      if (user.password_reset_otp !== otp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Check if OTP expired
      const now = new Date();
      const expiresAt = new Date(user.otp_expires_at);
      
      if (now > expiresAt) {
        await query(
          'UPDATE users SET password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $1',
          [userId]
        );

        return res.status(400).json({
          success: false,
          message: 'Verification code expired. Please request a new code.'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
      await query(
        'UPDATE users SET password = $1, password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $2',
        [hashedPassword, userId]
      );

      // Update hMail password
      if (process.env.NODE_ENV === 'development') {
        const hmailResult = await emailService.updateHmailPassword(user.email, newPassword);
        if (hmailResult.success) {
          console.log(`✅ hMail password updated for: ${user.email}`);
        }
      }

      console.log(`✅ Password reset with OTP for: ${user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// EMAIL CHANGE ROUTES
// ========================================

// POST /api/user/send-email-change-otp
router.post('/send-email-change-otp',
  authenticate,
  [
    body('newEmail').isEmail().normalizeEmail().withMessage('Invalid email format')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const { newEmail } = req.body;
      const userId = req.user.id;

      // Check if email already exists
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1',
        [newEmail]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration (5 minutes from now)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Delete any existing token for this user
      await query(
        'DELETE FROM email_change_tokens WHERE user_id = $1',
        [userId]
      );

      // Store OTP in email_change_tokens table
      await query(
        'INSERT INTO email_change_tokens (user_id, new_email, token, expires_at) VALUES ($1, $2, $3, $4)',
        [userId, newEmail, otp, expiresAt]
      );

      // Send OTP to NEW email
      try {
        await emailService.sendPasswordResetOTP({
          to: newEmail,
          otp,
          userName: 'User'
        });

        console.log(`✅ Email change OTP sent to: ${newEmail}`);

        res.json({
          success: true,
          message: `Verification code sent to ${newEmail}`
        });
      } catch (emailError) {
        console.error('❌ Failed to send email change OTP:', emailError.message);
        
        // Clear token if email fails
        await query(
          'DELETE FROM email_change_tokens WHERE user_id = $1',
          [userId]
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to send verification code. Please try again later.'
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/user/change-email
router.post('/change-email',
  authenticate,
  [
    body('newEmail').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const { newEmail, otp } = req.body;
      const userId = req.user.id;

      // Get token from database
      const tokenResult = await query(
        'SELECT * FROM email_change_tokens WHERE user_id = $1',
        [userId]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No email change request found. Please request a new code.'
        });
      }

      const tokenData = tokenResult.rows[0];

      // Verify new email matches
      if (tokenData.new_email !== newEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email does not match the request'
        });
      }

      // Verify OTP
      if (tokenData.token !== otp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Check expiration
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      
      if (now > expiresAt) {
        await query('DELETE FROM email_change_tokens WHERE user_id = $1', [userId]);

        return res.status(400).json({
          success: false,
          message: 'Verification code expired. Please request a new code.'
        });
      }

      // Get old email
      const userResult = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      const oldEmail = userResult.rows[0].email;

      // Update email in PostgreSQL
      await query(
        'UPDATE users SET email = $1 WHERE id = $2',
        [newEmail, userId]
      );

      // Delete token
      await query('DELETE FROM email_change_tokens WHERE user_id = $1', [userId]);

      // Note: hMail email addresses cannot be changed
      // We need to delete old account and create new one
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️ Note: hMail email cannot be changed. Old account: ${oldEmail}, New account needs manual creation.`);
        // Optionally: Delete old hMail account and create new one
        // await emailService.deleteHmailAccount(oldEmail);
        // await emailService.createHmailAccount(newEmail, 'temporaryPassword', userName);
      }

      console.log(`✅ Email changed from ${oldEmail} to ${newEmail}`);

      res.json({
        success: true,
        message: 'Email changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// ACCOUNT SETTINGS ROUTES
// ========================================

// GET /api/user/settings
router.get('/settings',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      const result = await query(
        'SELECT email_notifications, weather_alerts, weekly_digest, data_sharing FROM user_settings WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default settings if not exists
        await query(
          'INSERT INTO user_settings (user_id, email_notifications, weather_alerts, weekly_digest, data_sharing) VALUES ($1, TRUE, TRUE, FALSE, FALSE)',
          [userId]
        );

        return res.json({
          success: true,
          settings: {
            emailNotifications: true,
            weatherAlerts: true,
            weeklyDigest: false,
            dataSharing: false
          }
        });
      }

      const settings = result.rows[0];

      res.json({
        success: true,
        settings: {
          emailNotifications: settings.email_notifications,
          weatherAlerts: settings.weather_alerts,
          weeklyDigest: settings.weekly_digest,
          dataSharing: settings.data_sharing
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/user/settings
router.put('/settings',
  authenticate,
  [
    body('emailNotifications').optional().isBoolean(),
    body('weatherAlerts').optional().isBoolean(),
    body('weeklyDigest').optional().isBoolean(),
    body('dataSharing').optional().isBoolean()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array().map(err => err.msg)
        });
      }

      const userId = req.user.id;
      const { emailNotifications, weatherAlerts, weeklyDigest, dataSharing } = req.body;

      // Update settings (upsert)
      await query(
        `INSERT INTO user_settings (user_id, email_notifications, weather_alerts, weekly_digest, data_sharing)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
         SET email_notifications = $2, weather_alerts = $3, weekly_digest = $4, data_sharing = $5, updated_at = NOW()`,
        [userId, emailNotifications, weatherAlerts, weeklyDigest, dataSharing]
      );

      console.log(`✅ Settings updated for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Settings updated successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/user/delete-account
router.delete('/delete-account',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user email before deletion
      const userResult = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userEmail = userResult.rows[0].email;

      // Delete user (cascade will delete related records)
      await query('DELETE FROM users WHERE id = $1', [userId]);

      // Delete hMail account
      if (process.env.NODE_ENV === 'development') {
        const hmailResult = await emailService.deleteHmailAccount(userEmail);
        if (hmailResult.success) {
          console.log(`✅ hMail account deleted: ${userEmail}`);
        }
      }

      console.log(`✅ User account deleted: ${userEmail}`);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/user/delete-account
router.delete('/delete-account',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user email before deletion
      const userResult = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userEmail = userResult.rows[0].email;

      // Delete user (cascade will delete related records)
      await query('DELETE FROM users WHERE id = $1', [userId]);

      // Delete hMail account
      if (process.env.NODE_ENV === 'development') {
        const hmailResult = await emailService.deleteHmailAccount(userEmail);
        if (hmailResult.success) {
          console.log(`✅ hMail account deleted: ${userEmail}`);
        }
      }

      console.log(`✅ User account deleted: ${userEmail}`);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;