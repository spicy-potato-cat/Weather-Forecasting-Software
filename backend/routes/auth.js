import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import emailService from '../src/services/emailService.js';

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

      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 Registration attempt for: ${email}`);
      }

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
        'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [email, hashedPassword, name]
      );

      const user = result.rows[0];
      
      // Create hMail account in development (pass full name)
      if (process.env.NODE_ENV === 'development') {
        emailService.createHmailAccount(email, password, name) // Pass name as third argument
          .then(() => {
            console.log(`✅ hMail account created for: ${email} (${name})`);
          })
          .catch((hmailError) => {
            console.error(`⚠️ hMail account creation failed (non-critical):`, hmailError.message);
            // Don't fail registration - continue normally
          });
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ User created: ${user.email} (ID: ${user.id})`);
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
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
          name: user.name
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

      // Server-side logging only
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔐 Login attempt for: ${email}`);
      }

      const result = await query(
        'SELECT id, email, password, name FROM users WHERE email = $1',
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
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      if (process.env.NODE_ENV === 'development') {
        console.log(`Login successful: ${email}`);
      }

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      next(error); // Pass to error handler
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  console.log('Logout request received');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

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

      // Check if user exists
      const result = await query(
        'SELECT id, email, name FROM users WHERE email = $1',
        [email]
      );

      // Always return success to prevent email enumeration
      if (result.rows.length === 0) {
        console.log(`⚠️ Password reset attempted for non-existent email: ${email}`);
        return res.json({
          success: true,
          message: 'If an account exists with this email, you will receive a password reset code.'
        });
      }

      const user = result.rows[0];

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Store OTP in database
      await query(
        'UPDATE users SET password_reset_otp = $1, otp_expires_at = $2 WHERE id = $3',
        [otp, expiresAt, user.id]
      );

      // Send OTP via email
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
        
        // Clear OTP if email fails
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

      // Get user with OTP
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

      // Check if OTP exists
      if (!user.password_reset_otp) {
        return res.status(400).json({
          success: false,
          message: 'No password reset request found. Please request a new code.'
        });
      }

      // Check if OTP matches
      if (user.password_reset_otp !== otp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please check your email and try again.'
        });
      }

      // Check if OTP expired
      const now = new Date();
      const expiresAt = new Date(user.otp_expires_at);
      
      if (now > expiresAt) {
        // Clear expired OTP
        await query(
          'UPDATE users SET password_reset_otp = NULL, otp_expires_at = NULL WHERE id = $1',
          [user.id]
        );

        return res.status(400).json({
          success: false,
          message: 'OTP expired. Please request a new password reset code.'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
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

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  console.log('Logout request received');
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

export default router;
