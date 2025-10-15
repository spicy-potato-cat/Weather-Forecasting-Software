import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.apiKey = process.env.SENDER_MAIL_API_KEY;
    
    if (!this.apiKey || this.apiKey === 'your_sendermail_api_key_here') {
      console.warn('⚠️ SENDER_MAIL_API_KEY not configured - email service will not work');
      this.configured = false;
      return;
    }

    this.configured = true;

    // Configure SenderMail SMTP transport
    this.transporter = nodemailer.createTransport({
      host: 'smtp.sendermailapp.com',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: this.apiKey
      }
    });

    console.log('✅ Email service initialized');
  }

  async sendAlert({ to, subject, html, text, metadata = {} }) {
    if (!this.configured) {
      throw new Error('Email service not configured - check SENDER_MAIL_API_KEY');
    }

    try {
      const mailOptions = {
        from: 'alerts@aether-weather.com',
        to,
        subject,
        html,
        text,
        headers: {
          'X-Alert-ID': metadata.alert_id || '',
          'X-Severity': metadata.severity || '',
          'X-Hazard-Type': metadata.hazard_type || ''
        }
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✉️ Alert email sent to ${to}: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error(`❌ Email send failed to ${to}:`, error.message);
      throw error;
    }
  }

  async sendBatch(recipients) {
    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendAlert(recipient);
        results.push({ ...recipient, success: true, result });
      } catch (error) {
        results.push({ ...recipient, success: false, error: error.message });
      }
    }
    
    return results;
  }

  // Simulate method for testing
  async simulate({ to, subject, template, variables, user }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2fe79f;">🌦️ Test Weather Alert</h2>
        <p>This is a test email from Aether Weather Forecasting System.</p>
        <p><strong>Template:</strong> ${template || 'default'}</p>
        <p><strong>Sent to:</strong> ${to}</p>
        <p><strong>Requested by:</strong> ${user?.email || 'system'}</p>
        ${variables ? `<p><strong>Variables:</strong> ${JSON.stringify(variables, null, 2)}</p>` : ''}
        <hr style="border: 1px solid #2fe79f; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is a test message. No real weather alert.</p>
      </div>
    `;

    const text = `
🌦️ Test Weather Alert
This is a test email from Aether Weather Forecasting System.
Template: ${template || 'default'}
Sent to: ${to}
Requested by: ${user?.email || 'system'}
    `.trim();

    return await this.sendAlert({
      to,
      subject: subject || '[TEST] Weather Alert System',
      html,
      text,
      metadata: {
        alert_id: 'test-' + Date.now(),
        severity: 'TEST',
        hazard_type: 'SIMULATION'
      }
    });
  }
}

export default new EmailService();