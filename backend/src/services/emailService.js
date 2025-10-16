import nodemailer from 'nodemailer';
import pg from 'pg';

const { Client } = pg;

class EmailService {
  constructor() {
    // hMail SMTP configuration for development
    this.hmailConfig = {
      host: '127.0.0.1',
      port: 25,
      secure: false,
      auth: {
        user: 'admin@aether.com',
        pass: 'admin@123'
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000
    };

    // FIXED: hMail database configuration using postgres role
    this.hmailDbConfig = {
      host: 'localhost',
      port: 5432,
      database: process.env.HM_DB_NAME || 'AetherDB',
      user: 'postgres', // FIXED: Use postgres role instead of HM_DB_USER
      password: process.env.DB_PASSWORD || '' // Use main DB password
    };

    // Development: Use hMail SMTP
    if (process.env.NODE_ENV === 'development') {
      try {
        this.transporter = nodemailer.createTransport(this.hmailConfig);
        
        this.transporter.verify((error, success) => {
          if (error) {
            console.warn('⚠️ hMail SMTP not available:', error.message);
            console.warn('📧 Email sending will be simulated (logged to console)');
            this.configured = false;
          } else {
            console.log('✅ hMail SMTP service connected');
            this.configured = true;
          }
        });
      } catch (err) {
        console.warn('⚠️ hMail SMTP initialization failed:', err.message);
        this.configured = false;
      }
    } else {
      console.warn('⚠️ Production mode - hMail not configured');
      this.configured = false;
    }
  }

  /**
   * Create default email folders for hMail account
   */
  async createDefaultFolders(accountId) {
    let client;
    try {
      client = new Client(this.hmailDbConfig);
      await client.connect();

      const folders = [
        { name: 'INBOX', subscribed: 1, currentuid: 1 },
        { name: 'Sent', subscribed: 1, currentuid: 1 },
        { name: 'Trash', subscribed: 1, currentuid: 1 },
        { name: 'Drafts', subscribed: 1, currentuid: 1 },
        { name: 'Spam', subscribed: 1, currentuid: 1 },
        { name: 'Junk', subscribed: 1, currentuid: 1 }
      ];

      for (const folder of folders) {
        await client.query(
          `INSERT INTO hm_imapfolders (folderaccountid, foldername, foldersubscribed, foldercurrentuid, foldercreationtime)
           VALUES ($1, $2, $3, $4, NOW())`,
          [accountId, folder.name, folder.subscribed, folder.currentuid]
        );
      }

      console.log(`✅ Default folders created for account ${accountId}`);
    } catch (error) {
      console.error('❌ Failed to create default folders:', error.message);
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Create email account in hMail server with folders
   */
  async createHmailAccount(email, password = 'default@123', fullName = '') {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, message: 'Not in development mode' };
    }

    let client;
    try {
      const [localPart, domain] = email.split('@');
      
      if (!localPart || !domain) {
        throw new Error('Invalid email format');
      }

      let firstName = '';
      let lastName = '';
      
      if (fullName && fullName.trim()) {
        const nameParts = fullName.trim().split(/\s+/);
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      client = new Client(this.hmailDbConfig);
      
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database connection timeout')), 5000)
        )
      ]);

      console.log(`✅ Connected to hMail database as postgres`);

      const domainCheck = await client.query(
        'SELECT domainid FROM hm_domains WHERE domainname = $1',
        [domain]
      );

      let domainId;

      if (domainCheck.rows.length === 0) {
        console.log(`📧 Creating hMail domain: ${domain}`);
        const domainInsert = await client.query(
          `INSERT INTO hm_domains (
            domainname, domainactive, domainpostmaster, domainmaxsize, 
            domainaddomain, domainmaxmessagesize, domainuseplusaddressing, 
            domainplusaddressingchar, domainantispamoptions, domainenablesignature, 
            domainsignatureplaintext, domainsignaturehtml, domainaddsignaturestoreplies, 
            domainaddsignaturestolocalemail, domainmaxnoofaccounts, domainmaxnoofaliases, 
            domainmaxnoofdistributionlists, domainlimitationsenabled, domainmaxaccountsize, 
            domaindkimselector, domaindkimprivatekeyfile, domainsignaturemethod
          )
          VALUES (
            $1, 1, '', 0, 
            '', 0, 0, 
            '+', 0, 0, 
            '', '', 0, 
            0, 0, 0, 
            0, 0, 0, 
            '', '', 1
          )
          RETURNING domainid`,
          [domain]
        );
        domainId = domainInsert.rows[0].domainid;
        console.log(`✅ Domain created: ${domain} (ID: ${domainId})`);
      } else {
        domainId = domainCheck.rows[0].domainid;
        console.log(`✅ hMail domain exists: ${domain} (ID: ${domainId})`);
      }

      const accountCheck = await client.query(
        'SELECT accountid FROM hm_accounts WHERE accountaddress = $1',
        [email]
      );

      if (accountCheck.rows.length > 0) {
        console.log(`✅ hMail account already exists: ${email}`);
        return { success: true, message: 'Account already exists' };
      }

      console.log(`📧 Creating hMail account: ${email} (${firstName} ${lastName})`);
      const accountResult = await client.query(
        `INSERT INTO hm_accounts (
          accountdomainid, accountaddress, accountpassword, accountactive, 
          accountisad, accountaddomain, accountadusername, accountmaxsize, 
          accountvacationmessageon, accountvacationmessage, accountvacationsubject, 
          accountpwencryption, accountforwardenabled, accountforwardaddress, 
          accountforwardkeeporiginal, accountenablesignature, accountsignatureplaintext, 
          accountsignaturehtml, accountlastlogontime, accountvacationexpires, 
          accountvacationexpiredate, accountpersonfirstname, accountpersonlastname, 
          accountadminlevel
        )
        VALUES (
          $1, $2, $3, 1, 
          0, '', '', 0, 
          0, '', '', 
          2, 0, '', 
          0, 0, '', 
          '', '2000-01-01', 0, 
          '2000-01-01', $4, $5, 
          0
        )
        RETURNING accountid`,
        [domainId, email, password, firstName, lastName]
      );

      const accountId = accountResult.rows[0].accountid;

      await this.createDefaultFolders(accountId);

      console.log(`✅ hMail account created: ${email} with default folders`);
      return { success: true, message: 'Account created successfully', accountId };

    } catch (error) {
      console.error('❌ hMail account creation error:', error);
      console.error('   Error details:', error.message);
      return { success: false, message: error.message };
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Delete hMail account (for admin use)
   */
  async deleteHmailAccount(email) {
    let client;
    try {
      client = new Client(this.hmailDbConfig);
      await client.connect();

      const accountResult = await client.query(
        'SELECT accountid FROM hm_accounts WHERE accountaddress = $1',
        [email]
      );

      if (accountResult.rows.length === 0) {
        return { success: false, message: 'Account not found' };
      }

      const accountId = accountResult.rows[0].accountid;

      await client.query('DELETE FROM hm_imapfolders WHERE folderaccountid = $1', [accountId]);
      await client.query('DELETE FROM hm_accounts WHERE accountid = $1', [accountId]);

      console.log(`✅ hMail account deleted: ${email}`);
      return { success: true, message: 'Account deleted successfully' };

    } catch (error) {
      console.error('❌ hMail account deletion failed:', error.message);
      return { success: false, message: error.message };
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  /**
   * Update hMail account password (for admin use)
   */
  async updateHmailPassword(email, newPassword) {
    let client;
    try {
      client = new Client(this.hmailDbConfig);
      await client.connect();

      const result = await client.query(
        'UPDATE hm_accounts SET accountpassword = $1 WHERE accountaddress = $2 RETURNING accountid',
        [newPassword, email]
      );

      if (result.rowCount === 0) {
        return { success: false, message: 'Account not found' };
      }

      console.log(`✅ hMail password updated: ${email}`);
      return { success: true, message: 'Password updated successfully' };

    } catch (error) {
      console.error('❌ hMail password update failed:', error.message);
      return { success: false, message: error.message };
    } finally {
      if (client) {
        try {
          await client.end();
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  /**
   * Send alert email (admin notifications, etc.)
   */
  async sendAlert({ to, subject, html, text, metadata }) {
    // Development mode WITHOUT hMail server - just log to console
    if (process.env.NODE_ENV === 'development' && !this.configured) {
      console.log('\n📧 ========== SIMULATED EMAIL ==========');
      console.log(`To: ${to}`);
      console.log(`From: admin@aether.com`);
      console.log(`Subject: ${subject}`);
      console.log(`Metadata:`, metadata);
      console.log('Text Content:');
      console.log(text);
      console.log('HTML Content (truncated):');
      console.log(html ? html.substring(0, 200) + '...' : 'N/A');
      console.log('========================================\n');
      
      return {
        success: true,
        messageId: `simulated-${Date.now()}`,
        response: 'Email simulated (logged to console)'
      };
    }

    // Development with hMail SMTP
    if (process.env.NODE_ENV === 'development' && this.configured) {
      try {
        const info = await this.transporter.sendMail({
          from: 'admin@aether.com',
          to,
          subject,
          html,
          text,
          headers: {
            'X-Custom-Header': 'AetherAlert'
          }
        });

        console.log(`✅ Email sent via hMail to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId, response: info.response };
      } catch (error) {
        console.error('❌ Failed to send alert email:', error.message);
        
        // Fallback to console simulation
        console.log('\n📧 ========== FALLBACK: SIMULATED EMAIL ==========');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('============================================\n');
        
        return {
          success: true,
          messageId: `fallback-${Date.now()}`,
          response: 'Email simulated after SMTP failure'
        };
      }
    }

    // Production mode (not configured in current setup)
    console.warn('⚠️ Production mode email not configured');
    return { success: false, message: 'Email service not configured for production' };
  }

  /**
   * Send batch email (to multiple recipients)
   */
  async sendBatch({ to, subject, html, text, metadata }) {
    if (!this.configured) {
      console.warn('⚠️ Email service not configured - batch not sent:', subject);
      console.log('📧 Batch details:', { to, subject, html, text, metadata });
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const results = await Promise.all(to.map(recipient => {
        return this.transporter.sendMail({
          from: 'admin@aether.com',
          to: recipient,
          subject,
          html,
          text,
          headers: {
            'X-Custom-Header': 'AetherBatch'
          }
        });
      }));

      console.log(`✅ Batch email sent: ${subject} to ${to.length} recipients`);
      return { success: true, message: 'Batch email sent successfully', results };
    } catch (error) {
      console.error('❌ Failed to send batch email:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Simulate email sending (for testing)
   */
  async simulate({ to, subject, html, text }) {
    console.log('📬 Simulated email send:', { to, subject, html, text });
    return { success: true, message: 'Email send simulated (check console)' };
  }

  /**
   * Send OTP email for password reset
   */
  async sendPasswordResetOTP({ to, otp, userName }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); color: #f4fff9; border-radius: 12px;">
        <div style="text-align: center; padding: 30px 0;">
          <h1 style="color: #61ffd0; font-size: 2rem; margin: 0;">🔐 Password Reset Request</h1>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="font-size: 1.1rem; line-height: 1.6;">Hi ${userName || 'there'},</p>
          <p style="font-size: 1.1rem; line-height: 1.6;">We received a request to reset your password for your Aether account.</p>
          
          <div style="background: rgba(47,231,159,0.2); border: 2px solid #2fe79f; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #c9f5e8;">Your verification code is:</p>
            <h2 style="margin: 0; font-size: 2.5rem; color: #61ffd0; letter-spacing: 8px; font-family: monospace;">${otp}</h2>
          </div>
          
          <p style="font-size: 0.95rem; line-height: 1.6; color: #c9f5e8;">
            <strong>Important:</strong>
          </p>
          <ul style="color: #c9f5e8; font-size: 0.9rem; line-height: 1.6;">
            <li>This code expires in <strong>10 minutes</strong></li>
            <li>Enter this code on the password reset page</li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Never share this code with anyone</li>
          </ul>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 30px;">
          <p style="color: #c9f5e8; font-size: 0.9rem; margin: 5px 0;">Powered by <strong style="color: #2fe79f;">Aether Weather</strong></p>
          <p style="color: #c9f5e8; font-size: 0.8rem; margin: 5px 0;">If you didn't request this reset, your account is still secure.</p>
        </div>
      </div>
    `;

    const text = `
🔐 Password Reset Request

Hi ${userName || 'there'},

We received a request to reset your password for your Aether account.

Your verification code is: ${otp}

Important:
- This code expires in 10 minutes
- Enter this code on the password reset page
- If you didn't request this, please ignore this email
- Never share this code with anyone

---
Powered by Aether Weather
If you didn't request this reset, your account is still secure.
    `.trim();

    return await this.sendAlert({
      to,
      subject: '[Aether] Password Reset Code',
      html,
      text,
      metadata: {
        alert_id: 'password-reset-' + Date.now(),
        severity: 'INFO',
        hazard_type: 'PASSWORD_RESET'
      }
    });
  }
}

export default new EmailService();