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

      // Build HTML and text content from variables
      const weatherData = variables || {};
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); color: #f4fff9; border-radius: 12px;">
          <div style="text-align: center; padding: 30px 0;">
            <div style="font-size: 3rem; margin-bottom: 10px;">⚠️</div>
            <h1 style="color: #61ffd0; font-size: 2rem; margin: 0;">${weatherData.severity || 'Weather'} Alert</h1>
            ${weatherData.hazard_type ? `<h2 style="color: #2fe79f; font-size: 1.5rem; margin: 10px 0 0 0;">${weatherData.hazard_type}</h2>` : ''}
          </div>
          
          <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
            ${weatherData.location ? `
              <div style="margin-bottom: 20px; padding: 15px; background: rgba(47,231,159,0.15); border-left: 4px solid #2fe79f; border-radius: 4px;">
                <p style="margin: 0; font-size: 1.1rem;">
                  <strong>📍 Location:</strong> ${weatherData.location}
                </p>
              </div>
            ` : ''}
            
            ${weatherData.start_time && weatherData.end_time ? `
              <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,165,0,0.15); border-left: 4px solid #ffa500; border-radius: 4px;">
                <p style="margin: 0 0 5px 0; font-size: 0.95rem;">
                  <strong>🕐 Start:</strong> ${weatherData.start_time}
                </p>
                <p style="margin: 0; font-size: 0.95rem;">
                  <strong>🕐 End:</strong> ${weatherData.end_time}
                </p>
              </div>
            ` : ''}
            
            ${weatherData.details ? `
              <div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 1rem; font-weight: bold; color: #61ffd0;">Alert Details:</p>
                <p style="margin: 0; font-size: 0.95rem; line-height: 1.6;">${weatherData.details}</p>
              </div>
            ` : ''}
          </div>
          
          <div style="background: rgba(255,0,0,0.1); border: 2px solid #ff6b6b; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 0.9rem; font-weight: bold; color: #ff6b6b;">⚡ Safety Recommendations:</p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 0.85rem; line-height: 1.6; color: #f4fff9;">
              <li>Stay indoors and avoid unnecessary travel</li>
              <li>Keep emergency supplies ready (flashlight, water, first-aid kit)</li>
              <li>Monitor local weather updates regularly</li>
              <li>Follow official evacuation orders if issued</li>
              <li>Stay away from windows during severe weather</li>
            </ul>
          </div>
          
          <div style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 30px;">
            <p style="color: #c9f5e8; font-size: 0.9rem; margin: 5px 0;">
              <strong style="color: #2fe79f;">Aether Weather Alerts</strong>
            </p>
            <p style="color: #c9f5e8; font-size: 0.75rem; margin: 5px 0;">
              Keeping you safe with real-time weather monitoring
            </p>
            <p style="color: #c9f5e8; font-size: 0.7rem; margin: 15px 0 0 0; font-style: italic;">
              This is an automated alert. Reply STOP to unsubscribe.
            </p>
          </div>
        </div>
      `;

      const text = `
⚠️ ${weatherData.severity || 'WEATHER'} ALERT ⚠️
${weatherData.hazard_type || 'Weather Advisory'}

${weatherData.location ? `📍 Location: ${weatherData.location}\n` : ''}
${weatherData.start_time ? `🕐 Start Time: ${weatherData.start_time}` : ''}
${weatherData.end_time ? `🕐 End Time: ${weatherData.end_time}\n` : ''}

Alert Details:
${weatherData.details || 'Weather conditions may be hazardous. Please stay alert.'}

⚡ SAFETY RECOMMENDATIONS:
- Stay indoors and avoid unnecessary travel
- Keep emergency supplies ready (flashlight, water, first-aid kit)
- Monitor local weather updates regularly
- Follow official evacuation orders if issued
- Stay away from windows during severe weather

---
Aether Weather Alerts
Keeping you safe with real-time weather monitoring

This is an automated alert. Reply STOP to unsubscribe.
      `.trim();

      // FIXED: Use sendAlert directly instead of simulate
      const result = await EmailService.sendAlert({
        to,
        subject,
        html,
        text,
        metadata: {
          alert_id: `alert-${Date.now()}`,
          severity: weatherData.severity || 'INFO',
          hazard_type: weatherData.hazard_type || 'GENERAL'
        }
      });

      res.json({ 
        success: true, 
        message: 'Weather alert email sent successfully', 
        result 
      });
    } catch (err) {
      console.error('Email send error:', err);
      res.status(500).json({
        success: false,
        message: err.message || 'Failed to send email'
      });
    }
  }
);

export default router;
