import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate } from '../../middleware/auth.js';
import EmailService from '../services/emailService.js';

const router = express.Router();

// POST /api/email/simulate
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
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed', 
          errors: errors.array() 
        });
      }

      const { to, subject, template, variables } = req.body;

      const result = await EmailService.simulate({ 
        to, 
        subject, 
        template, 
        variables, 
        user: req.user 
      });

      res.json({ 
        success: true, 
        message: 'Test email sent successfully', 
        result 
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
