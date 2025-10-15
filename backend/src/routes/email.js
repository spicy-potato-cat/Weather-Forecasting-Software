import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../../middleware/auth.js'; // FIXED: Correct path (go up 2 levels)
import EmailService from '../services/emailService.js'; // FIXED: Removed duplicate 'src'

const router = express.Router();

// POST /api/protected/email/simulate
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

      if (!process.env.SENDER_MAIL_API_KEY) {
        return res.status(500).json({ success: false, message: 'SENDER_MAIL_API_KEY not set' });
      }

      const { to, subject, template, variables } = req.body;

      // Try to call a simulate function if EmailService exposes one,
      // otherwise call send() with a simulate flag.
      let result;
      if (typeof EmailService.simulate === 'function') {
        result = await EmailService.simulate({ to, subject, template, variables, user: req.user });
      } else if (typeof EmailService.send === 'function') {
        // Many services accept an options flag; adjust if your service API differs.
        result = await EmailService.send({ to, subject, template, variables, simulate: true, user: req.user });
      } else {
        return res.status(500).json({ success: false, message: 'Email service not available' });
      }

      res.json({ success: true, message: 'Simulated send queued', result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;