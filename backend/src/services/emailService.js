import fetch from 'node-fetch';

class EmailService {
  constructor() {
    this.apiKey = process.env.MAILTRAP_API_KEY; // FIXED: Changed to MAILTRAP_API_KEY
    this.fromEmail = process.env.MAILTRAP_FROM_EMAIL || 'hello@demomailtrap.com';
    this.fromName = process.env.MAILTRAP_FROM_NAME || 'Aether Weather Alerts';
    
    if (!this.apiKey) {
      console.warn('⚠️ MAILTRAP_API_KEY not configured - email service will not work');
      this.configured = false;
      return;
    }

    this.configured = true;
    console.log('✅ Mailtrap email service initialized');
  }

  async sendAlert({ to, subject, html, text, metadata = {} }) {
    if (!this.configured) {
      throw new Error('Email service not configured - check MAILTRAP_API_KEY');
    }

    try {
      const payload = {
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        to: [
          {
            email: to
          }
        ],
        subject: subject,
        text: text,
        html: html,
        category: metadata.hazard_type || 'Weather Alert'
      };

      const response = await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Mailtrap API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json().catch(() => ({ message: 'Email sent' }));
      
      console.log(`✉️ Alert email sent to ${to} via Mailtrap`);
      
      return {
        success: true,
        messageId: result.message_id || `mailtrap-${Date.now()}`,
        response: result
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
        
        // Small delay between emails to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.push({ ...recipient, success: false, error: error.message });
      }
    }
    
    return results;
  }

  async simulate({ to, subject, template, variables, user }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); color: #f4fff9; border-radius: 12px;">
        <div style="text-align: center; padding: 30px 0;">
          <h1 style="color: #61ffd0; font-size: 2.5rem; margin: 0;">🌦️ Test Weather Alert</h1>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="font-size: 1.1rem; line-height: 1.6;">This is a <strong>test email</strong> from the Aether Weather Forecasting System.</p>
          
          <div style="margin: 20px 0; padding: 15px; background: rgba(47,231,159,0.2); border-left: 4px solid #2fe79f; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Template:</strong> ${template || 'default'}</p>
            <p style="margin: 5px 0;"><strong>Sent to:</strong> ${to}</p>
            <p style="margin: 5px 0;"><strong>Requested by:</strong> ${user?.email || 'system'}</p>
            ${variables ? `<p style="margin: 5px 0;"><strong>Variables:</strong> <pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(variables, null, 2)}</pre></p>` : ''}
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 30px;">
          <p style="color: #c9f5e8; font-size: 0.9rem; margin: 5px 0;">Powered by <strong style="color: #2fe79f;">Aether</strong></p>
          <p style="color: #c9f5e8; font-size: 0.8rem; margin: 5px 0;">This is a test message. No real weather alert.</p>
        </div>
      </div>
    `;

    const text = `
🌦️ Test Weather Alert

This is a test email from the Aether Weather Forecasting System.

Template: ${template || 'default'}
Sent to: ${to}
Requested by: ${user?.email || 'system'}
${variables ? `\nVariables:\n${JSON.stringify(variables, null, 2)}` : ''}

---
Powered by Aether Weather
This is a test message. No real weather alert.
    `.trim();

    return await this.sendAlert({
      to,
      subject: subject || '[TEST] Aether Weather Alert System',
      html,
      text,
      metadata: {
        alert_id: 'test-' + Date.now(),
        severity: 'TEST',
        hazard_type: 'Integration Test'
      }
    });
  }
}

export default new EmailService();