import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import emailService from '../src/services/emailService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required')
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

      const { email, password, name } = req.body;

      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User already exists with this email'
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await query(
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_admin, created_at',
        [email, hashedPassword, name]
      );

      const user = result.rows[0];
      
      if (process.env.NODE_ENV === 'development') {
        emailService.createHmailAccount(email, password, name)
          .then(() => console.log(`✅ hMail account created for: ${email}`))
          .catch((err) => console.error(`⚠️ hMail account creation failed:`, err.message));
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: user.is_admin
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/login
router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required')
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

      const { email, password } = req.body;

      const result = await query(
        'SELECT id, email, password, name, is_admin FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      console.log(`✅ User logged in: ${email} (ID: ${user.id}, Admin: ${user.is_admin})`);

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_admin: user.is_admin
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/forgot-password
router.post('/forgot-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format')
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

      const { email } = req.body;

      const result = await query(
        'SELECT id, email, name FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset code.'
        });
      }

      const user = result.rows[0];
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await query(
        'UPDATE users SET password_reset_otp = $1, otp_expires_at = $2 WHERE id = $3',
        [otp, expiresAt, user.id]
      );

      try {
        await emailService.sendPasswordResetOTP({
          to: email,
          otp,
          userName: user.name
        });

        console.log(`✅ Password reset OTP sent to: ${email}`);

        res.json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset code.'
        });
      } catch (emailError) {
        console.error('❌ Failed to send password reset email:', emailError.message);
        
        await query(
          'UPDATE users SET password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $1',
          [user.id]
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to send reset code. Please try again later.'
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/reset-password
router.post('/reset-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
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

      const { email, otp, newPassword } = req.body;

      const result = await query(
        'SELECT id, email, name, password_reset_otp, otp_expires_at FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email or OTP'
        });
      }

      const user = result.rows[0];

      if (!user.password_reset_otp) {
        return res.status(400).json({
          success: false,
          message: 'No password reset request found. Please request a new code.'
        });
      }

      if (user.password_reset_otp !== otp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please check your email and try again.'
        });
      }

      const now = new Date();
      const expiresAt = new Date(user.otp_expires_at);
      
      if (now > expiresAt) {
        await query(
          'UPDATE users SET password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $1',
          [user.id]
        );

        return res.status(400).json({
          success: false,
          message: 'OTP expired. Please request a new password reset code.'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await query(
        'UPDATE users SET password = $1, password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $2',
        [hashedPassword, user.id]
      );

      console.log(`✅ Password reset successful for: ${email}`);

      res.json({
        success: true,
        message: 'Password reset successful! You can now login with your new password.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/send-password-reset-otp - Send OTP for password reset (authenticated users)
router.post('/send-password-reset-otp',
  authenticate,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
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

      const { email } = req.body;

      if (email !== req.user.email) {
        return res.status(403).json({
          success: false,
          message: 'Email does not match authenticated user'
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '5 minutes')
         ON CONFLICT (user_id) 
         DO UPDATE SET token = $2, expires_at = NOW() + INTERVAL '5 minutes', created_at = NOW()`,
        [req.user.id, otp]
      );

      try {
        await emailService.sendAlert({
          to: email,
          subject: 'Password Reset Verification Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2fe79f;">Password Reset Verification</h2>
              <p>You requested to reset your password. Use the verification code below:</p>
              <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="color: #053943; letter-spacing: 5px; margin: 0;">${otp}</h1>
              </div>
              <p><strong>This code will expire in 5 minutes.</strong></p>
              <p>If you didn't request this, please ignore this email.</p>
              <hr style="border: 1px solid #eee; margin: 20px 0;">
              <p style="color: #666; font-size: 12px;">Aether Weather - Your trusted weather companion</p>
            </div>
          `,
          text: `Password Reset Verification Code: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you didn't request this, please ignore this email.`,
          metadata: {
            alert_id: `password-reset-${Date.now()}`,
            severity: 'INFO',
            hazard_type: 'PASSWORD_RESET'
          }
        });
      } catch (emailErr) {
        console.error('Failed to send OTP email:', emailErr);
      }

      console.log(`✅ Password reset OTP sent to ${email} (User ID: ${req.user.id})`);

      res.json({
        success: true,
        message: 'Verification code sent to your email'
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/reset-password-with-otp - Reset password using OTP (authenticated users)
router.post('/reset-password-with-otp',
  authenticate,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

      const { email, otp, newPassword } = req.body;

      if (email !== req.user.email) {
        return res.status(403).json({
          success: false,
          message: 'Email does not match authenticated user'
        });
      }

      const otpResult = await query(
        `SELECT * FROM password_reset_tokens 
         WHERE user_id = $1 AND token = $2 AND expires_at > NOW()`,
        [req.user.id, otp]
      );

      if (otpResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, req.user.id]
      );

      await query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [req.user.id]
      );

      console.log(`✅ Password reset successful for user ${req.user.email} (ID: ${req.user.id})`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

export default router;