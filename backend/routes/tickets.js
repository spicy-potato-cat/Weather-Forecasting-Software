import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

// ========================================
// USER TICKET ROUTES
// ========================================

// GET /api/tickets - Get user's tickets
router.get('/',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { status, page = 1, limit = 10 } = req.query;

      const offset = (page - 1) * limit;

      let whereClause = 'WHERE user_id = $1';
      const params = [userId];

      if (status) {
        whereClause += ' AND status = $2';
        params.push(status);
      }

      const result = await query(
        `SELECT 
          t.id, t.subject, t.category, t.priority, t.status, 
          t.created_at, t.updated_at, t.closed_at,
          (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count
         FROM support_tickets t
         ${whereClause}
         ORDER BY 
           CASE WHEN t.status = 'open' THEN 0 WHEN t.status = 'reopened' THEN 1 ELSE 2 END,
           t.updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const countResult = await query(
        `SELECT COUNT(*) FROM support_tickets ${whereClause}`,
        params
      );

      res.json({
        success: true,
        tickets: result.rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResult.rows[0].count / limit),
          totalTickets: parseInt(countResult.rows[0].count),
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// GET /api/tickets/:ticketId - Get single ticket with messages
router.get('/:ticketId',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { ticketId } = req.params;

      // Get ticket details
      const ticketResult = await query(
        `SELECT 
          t.*,
          u.name as user_name, u.email as user_email,
          closer.name as closed_by_name
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users closer ON t.closed_by = closer.id
         WHERE t.id = $1`,
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      const ticket = ticketResult.rows[0];

      // Check if user owns the ticket or is admin
      const userResult = await query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );

      const isAdmin = userResult.rows[0]?.is_admin;

      if (ticket.user_id !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Get messages
      const messagesResult = await query(
        `SELECT 
          m.id, m.message, m.is_admin_reply, m.created_at,
          u.name as sender_name, u.email as sender_email
         FROM ticket_messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.ticket_id = $1
         ORDER BY m.created_at ASC`,
        [ticketId]
      );

      // Get status history
      const historyResult = await query(
        `SELECT 
          h.old_status, h.new_status, h.changed_at, h.reason,
          u.name as changed_by_name
         FROM ticket_status_history h
         JOIN users u ON h.changed_by = u.id
         WHERE h.ticket_id = $1
         ORDER BY h.changed_at DESC`,
        [ticketId]
      );

      res.json({
        success: true,
        ticket: {
          ...ticket,
          messages: messagesResult.rows,
          history: historyResult.rows
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/tickets - Create new ticket
router.post('/',
  authenticate,
  [
    body('subject').trim().isLength({ min: 3, max: 255 }).withMessage('Subject must be 3-255 characters'),
    body('category').isIn(['technical', 'billing', 'feature_request', 'bug_report', 'other']).withMessage('Invalid category'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
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
      const { subject, category, priority = 'medium', message } = req.body;

      // Create ticket
      const ticketResult = await query(
        `INSERT INTO support_tickets (user_id, subject, category, priority, status)
         VALUES ($1, $2, $3, $4, 'open')
         RETURNING *`,
        [userId, subject, category, priority]
      );

      const ticket = ticketResult.rows[0];

      // Add initial message
      await query(
        `INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin_reply)
         VALUES ($1, $2, $3, FALSE)`,
        [ticket.id, userId, message]
      );

      // Add status history
      await query(
        `INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_by)
         VALUES ($1, NULL, 'open', $2)`,
        [ticket.id, userId]
      );

      console.log(`✅ Ticket #${ticket.id} created by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Support ticket created successfully',
        ticket: ticket
      });

    } catch (error) {
      next(error);
    }
  }
);

// POST /api/tickets/:ticketId/messages - Add message to ticket
router.post('/:ticketId/messages',
  authenticate,
  [
    body('message').trim().isLength({ min: 1 }).withMessage('Message cannot be empty')
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
      const { ticketId } = req.params;
      const { message } = req.body;

      // Check ticket exists and user has access
      const ticketResult = await query(
        'SELECT user_id, status FROM support_tickets WHERE id = $1',
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      const ticket = ticketResult.rows[0];

      // Check access
      const userResult = await query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );

      const isAdmin = userResult.rows[0]?.is_admin;

      if (ticket.user_id !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Add message
      const messageResult = await query(
        `INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin_reply)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ticketId, userId, message, isAdmin]
      );

      // Update ticket updated_at
      await query(
        'UPDATE support_tickets SET updated_at = NOW() WHERE id = $1',
        [ticketId]
      );

      console.log(`✅ Message added to ticket #${ticketId} by user ${userId}`);

      res.status(201).json({
        success: true,
        message: 'Message added successfully',
        ticketMessage: messageResult.rows[0]
      });

    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/tickets/:ticketId/close - Close ticket (user or admin)
router.patch('/:ticketId/close',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { ticketId } = req.params;
      const { reason } = req.body;

      // Check ticket exists
      const ticketResult = await query(
        'SELECT user_id, status FROM support_tickets WHERE id = $1',
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      const ticket = ticketResult.rows[0];

      // Check access
      const userResult = await query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );

      const isAdmin = userResult.rows[0]?.is_admin;

      if (ticket.user_id !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      if (ticket.status === 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Ticket is already closed'
        });
      }

      // Close ticket
      await query(
        `UPDATE support_tickets 
         SET status = 'closed', closed_at = NOW(), closed_by = $1
         WHERE id = $2`,
        [userId, ticketId]
      );

      // Add status history
      await query(
        `INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_by, reason)
         VALUES ($1, $2, 'closed', $3, $4)`,
        [ticketId, ticket.status, userId, reason || null]
      );

      console.log(`✅ Ticket #${ticketId} closed by user ${userId}`);

      res.json({
        success: true,
        message: 'Ticket closed successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/tickets/:ticketId/reopen - Reopen ticket (user only)
router.patch('/:ticketId/reopen',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { ticketId } = req.params;
      const { reason } = req.body;

      // Check ticket exists and user owns it
      const ticketResult = await query(
        'SELECT user_id, status FROM support_tickets WHERE id = $1',
        [ticketId]
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      const ticket = ticketResult.rows[0];

      if (ticket.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the ticket creator can reopen'
        });
      }

      if (ticket.status !== 'closed') {
        return res.status(400).json({
          success: false,
          message: 'Ticket is not closed'
        });
      }

      // Reopen ticket
      await query(
        `UPDATE support_tickets 
         SET status = 'reopened', closed_at = NULL, closed_by = NULL
         WHERE id = $1`,
        [ticketId]
      );

      // Add status history
      await query(
        `INSERT INTO ticket_status_history (ticket_id, old_status, new_status, changed_by, reason)
         VALUES ($1, 'closed', 'reopened', $2, $3)`,
        [ticketId, userId, reason || null]
      );

      console.log(`✅ Ticket #${ticketId} reopened by user ${userId}`);

      res.json({
        success: true,
        message: 'Ticket reopened successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

// ========================================
// ADMIN TICKET ROUTES
// ========================================

// GET /api/tickets/admin/all - Get all tickets (admin only)
router.get('/admin/all',
  authenticate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Check admin status
      const userResult = await query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );

      if (!userResult.rows[0]?.is_admin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { status, priority, page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (status) {
        params.push(status);
        whereClause += ` AND t.status = $${params.length}`;
      }

      if (priority) {
        params.push(priority);
        whereClause += ` AND t.priority = $${params.length}`;
      }

      const result = await query(
        `SELECT 
          t.id, t.subject, t.category, t.priority, t.status, 
          t.created_at, t.updated_at, t.closed_at,
          u.name as user_name, u.email as user_email,
          (SELECT COUNT(*) FROM ticket_messages WHERE ticket_id = t.id) as message_count,
          (SELECT MAX(created_at) FROM ticket_messages WHERE ticket_id = t.id) as last_message_at
         FROM support_tickets t
         JOIN users u ON t.user_id = u.id
         ${whereClause}
         ORDER BY 
           CASE WHEN t.status = 'open' THEN 0 
                WHEN t.status = 'reopened' THEN 1 
                ELSE 2 END,
           t.priority = 'high' DESC,
           t.updated_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const countResult = await query(
        `SELECT COUNT(*) FROM support_tickets t ${whereClause}`,
        params
      );

      // Get statistics
      const statsResult = await query(
        `SELECT 
          COUNT(*) FILTER (WHERE status = 'open') as open_count,
          COUNT(*) FILTER (WHERE status = 'reopened') as reopened_count,
          COUNT(*) FILTER (WHERE status = 'closed') as closed_count,
          COUNT(*) FILTER (WHERE priority = 'high' AND status != 'closed') as high_priority_count
         FROM support_tickets`
      );

      res.json({
        success: true,
        tickets: result.rows,
        statistics: statsResult.rows[0],
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(countResult.rows[0].count / limit),
          totalTickets: parseInt(countResult.rows[0].count),
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;