import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import emailService from '../services/emailService.js';

const router = express.Router();

router.post(
  '/simulate',
  authenticate,
  [
    body('to').isEmail().withMessage('Valid "to" email required'),
    body('subject').notEmpty().withMessage('subject required'),
    body('template').optional().isString(),
    body('variables').optional()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      if (!process.env.MAILTRAP_API_KEY) { // FIXED: Changed to MAILTRAP_API_KEY
        return res.status(500).json({ success: false, message: 'MAILTRAP_API_KEY not set' });
      }

      const { to, subject, template, variables } = req.body;

      const result = await emailService.simulate({
        to,
        subject,
        template,
        variables,
        user: req.user
      });

      return res.json({
        success: true,
        message: 'Simulated send queued',
        result
      });
    } catch (err) {
      console.error('Email simulation error:', err);
      return res.status(500).json({
        success: false,
        message: err.message,
        debug: {
          originalMessage: err.message,
          code: err.code
        }
      });
    }
  }
);

export default router;