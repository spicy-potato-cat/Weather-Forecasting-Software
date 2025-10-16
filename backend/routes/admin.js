import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';
import emailService from '../src/services/emailService.js';

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, email, is_admin FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    if (!user.is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// GET /api/admin/users (List all users with pagination)
router.get('/users',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search || '';

      let queryText = `
        SELECT id, email, name, created_at, last_login, is_admin 
        FROM users 
        WHERE email ILIKE $1 OR name ILIKE $1
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;

      const searchPattern = `%${search}%`;
      const result = await query(queryText, [searchPattern, limit, offset]);

      const countResult = await query(
        'SELECT COUNT(*) FROM users WHERE email ILIKE $1 OR name ILIKE $1',
        [searchPattern]
      );
      const totalUsers = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(totalUsers / limit);

      res.json({
        success: true,
        users: result.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          usersPerPage: limit
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/users/:userId (Get single user details)
router.get('/users/:userId',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const result = await query(
        'SELECT id, email, name, created_at, last_login, is_admin FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        user: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/users (Create new user)
router.post('/users',
  authenticate,
  requireAdmin,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('is_admin').optional().isBoolean().withMessage('is_admin must be boolean')
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

      const { email, password, name, is_admin = false } = req.body;

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
        'INSERT INTO users (email, password, name, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, name, is_admin, created_at',
        [email, hashedPassword, name, is_admin]
      );

      const user = result.rows[0];

      if (process.env.NODE_ENV === 'development') {
        emailService.createHmailAccount(email, password, name)
          .then(() => {
            console.log(`✅ hMail account created for: ${email}`);
          })
          .catch((hmailError) => {
            console.error(`⚠️ hMail account creation failed:`, hmailError.message);
          });
      }

      console.log(`✅ Admin created user: ${email} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user
      });

    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/admin/users/:userId (Update user)
router.put('/users/:userId',
  authenticate,
  requireAdmin,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('is_admin').optional().isBoolean().withMessage('is_admin must be boolean'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

      const { userId } = req.params;
      const { name, email, is_admin, password } = req.body;

      const userCheck = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const oldEmail = userCheck.rows[0].email;

      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }

      if (email) {
        const emailCheck = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, userId]
        );

        if (emailCheck.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Email already in use by another user'
          });
        }

        updates.push(`email = $${paramIndex++}`);
        values.push(email);
      }

      if (typeof is_admin === 'boolean') {
        updates.push(`is_admin = $${paramIndex++}`);
        values.push(is_admin);
      }

      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);

        if (process.env.NODE_ENV === 'development') {
          const targetEmail = email || oldEmail;
          emailService.updateHmailPassword(targetEmail, password)
            .then(() => {
              console.log(`✅ hMail password updated for: ${targetEmail}`);
            })
            .catch((hmailError) => {
              console.error(`⚠️ hMail password update failed:`, hmailError.message);
            });
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      values.push(userId);

      const updateQuery = `
        UPDATE users 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, email, name, is_admin, created_at, updated_at
      `;

      const result = await query(updateQuery, values);

      console.log(`✅ Admin updated user ${userId} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'User updated successfully',
        user: result.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/users/:userId
router.delete('/users/:userId',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      if (userId === req.user.id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

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

      await query('DELETE FROM users WHERE id = $1', [userId]);

      if (process.env.NODE_ENV === 'development') {
        const hmailResult = await emailService.deleteHmailAccount(userEmail);
        if (hmailResult.success) {
          console.log(`✅ hMail account deleted: ${userEmail}`);
        } else {
          console.warn(`⚠️ hMail deletion failed: ${hmailResult.message}`);
        }
      }

      console.log(`✅ User deleted by admin ${req.user.email}: ${userEmail}`);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/admin/users/:userId/toggle-admin (Toggle admin status)
router.post('/users/:userId/toggle-admin',
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      if (userId === req.user.id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify your own admin status'
        });
      }

      const result = await query(
        'UPDATE users SET is_admin = NOT is_admin WHERE id = $1 RETURNING id, email, is_admin',
        [userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = result.rows[0];

      console.log(`✅ Admin toggled admin status for ${user.email}: ${user.is_admin}`);

      res.json({
        success: true,
        message: `User ${user.is_admin ? 'promoted to' : 'demoted from'} admin`,
        user
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;