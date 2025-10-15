import nodemailer from 'nodemailer';
import pg from 'pg';

const { Client } = pg;

class EmailService {
  constructor() {
    this.apiKey = process.env.MAILERSEND_API_KEY;
    this.fromEmail = 'admin@aether.com'; // Use hMail admin account
    this.fromName = 'Aether Weather Alerts';
    
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

    // hMail database configuration
    this.hmailDbConfig = {
      host: 'localhost',
      port: 5432,
      database: process.env.HM_DB_NAME || 'AetherDB',
      user: process.env.HM_DB_USER || 'postgres',
      password: process.env.HM_DB_PASSWORD || 'Pass@123'
    };

    // Use hMail SMTP in development
    if (process.env.NODE_ENV === 'development') {
      this.transporter = nodemailer.createTransport(this.hmailConfig);
      
      // Test SMTP connection
      this.transporter.verify()
        .then(() => {
          console.log('✅ hMail SMTP connected successfully on port 25');
          this.configured = true;
        })
        .catch((error) => {
          console.error('❌ hMail SMTP connection failed:', error.message);
          console.error('   Ensure hMailServer is running and listening on port 25');
          this.configured = false;
        });
    } else {
      if (!this.apiKey) {
        this.configured = false;
      } else {
        this.configured = true;
        console.log('✅ MailerSend email service initialized');
      }
    }
  }

  /**
   * Create email account in hMail server
   */
  async createHmailAccount(email, password = 'default@123') {
    if (process.env.NODE_ENV !== 'development') {
      return { success: false, message: 'Not in development mode' };
    }

    let client;
    try {
      const [localPart, domain] = email.split('@');
      
      if (!localPart || !domain) {
        throw new Error('Invalid email format');
      }

      client = new Client(this.hmailDbConfig);
      await client.connect();
      
      console.log(`🔍 Checking hMail domain: ${domain}`);

      // Check if domain exists
      const domainCheck = await client.query(
        'SELECT domainid FROM hm_domains WHERE domainname = $1',
        [domain]
      );

      let domainId;

      if (domainCheck.rows.length === 0) {
        console.log(`📧 Creating hMail domain: ${domain}`);
        
        // Create minimal domain entry
        const domainInsert = await client.query(
          `INSERT INTO hm_domains (
            domainname, 
            domainactive, 
            domainpostmaster, 
            domainmaxsize, 
            domainaddomain, 
            domainmaxmessagesize,
            domainuseplusaddressing,
            domainplusaddressingchar,
            domainantispamoptions,
            domainenablesignature,
            domainsignatureplaintext,
            domainsignaturehtml,
            domainaddsignaturestoreplies,
            domainaddsignaturestolocalemail,
            domainmaxnoofaccounts,
            domainmaxnoofaliases,
            domainmaxnoofdistributionlists,
            domainlimitationsenabled,
            domainmaxaccountsize,
            domaindkimselector,
            domaindkimprivatekeyfile
          ) VALUES (
            $1, 1, '', 0, '', 0, 0, '+', 0, 0, '', '', 0, 0, 0, 0, 0, 0, 0, '', ''
          ) RETURNING domainid`,
          [domain]
        );
        
        domainId = domainInsert.rows[0].domainid;
        console.log(`✅ Domain created with ID: ${domainId}`);
      } else {
        domainId = domainCheck.rows[0].domainid;
        console.log(`✅ Domain exists with ID: ${domainId}`);
      }

      // Check if account already exists
      const accountCheck = await client.query(
        'SELECT accountid, accountaddress FROM hm_accounts WHERE accountaddress = $1',
        [email]
      );

      if (accountCheck.rows.length > 0) {
        console.log(`✅ hMail account already exists: ${email} (ID: ${accountCheck.rows[0].accountid})`);
        await client.end();
        return { success: true, message: 'Account already exists', accountId: accountCheck.rows[0].accountid };
      }

      // Create account with all required fields
      console.log(`📧 Creating hMail account: ${email}`);
      
      const accountInsert = await client.query(
        `INSERT INTO hm_accounts (
          accountdomainid,
          accountaddress,
          accountpassword,
          accountactive,
          accountisad,
          accountaddomain,
          accountadusername,
          accountmaxsize,
          accountvacationmessageon,
          accountvacationmessage,
          accountvacationsubject,
          accountpwencryption,
          accountforwardenabled,
          accountforwardaddress,
          accountforwardkeeporiginal,
          accountenablesignature,
          accountsignatureplaintext,
          accountsignaturehtml,
          accountlastlogontime,
          accountvacationexpires,
          accountvacationexpiredate,
          accountpersonfirstname,
          accountpersonlastname,
          accountadminlevel
        ) VALUES (
          $1, $2, $3, 1, 0, '', '', 0, 0, '', '', 2, 0, '', 0, 0, '', '', '1900-01-01 00:00:00', 0, '1900-01-01 00:00:00', '', '', 0
        ) RETURNING accountid`,
        [domainId, email, password]
      );

      const accountId = accountInsert.rows[0].accountid;
      console.log(`✅ hMail account created: ${email} (ID: ${accountId})`);

      await client.end();

      return { 
        success: true, 
        message: 'Account created successfully',
        accountId,
        domainId,
        email
      };

    } catch (error) {
      console.error('❌ hMail account creation error:', error);
      console.error('   Error details:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.error('   → PostgreSQL connection refused. Check if AetherDB is running.');
      } else if (error.code === '42P01') {
        console.error('   → Table does not exist. Check hMail database schema.');
      } else if (error.code === '23505') {
        console.error('   → Account already exists (duplicate key).');
      }
      
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

  async sendAlert({ to, subject, html, text, metadata = {} }) {
    // Fallback: Console simulation if SMTP not configured
    if (process.env.NODE_ENV === 'development' && !this.configured) {
      console.log('\n📧 ========== SIMULATED EMAIL ==========');
      console.log(`To: ${to}`);
      console.log(`From: ${this.fromName} <${this.fromEmail}>`);
      console.log(`Subject: ${subject}`);
      console.log(`Metadata:`, metadata);
      console.log('Text Content:');
      console.log(text);
      console.log('========================================\n');
      
      return {
        success: true,
        messageId: `simulated-${Date.now()}`,
        response: 'Email simulated (SMTP not available)'
      };
    }

    // Development: Use hMail SMTP
    if (process.env.NODE_ENV === 'development' && this.configured) {
      try {
        const mailOptions = {
          from: `"${this.fromName}" <${this.fromEmail}>`,
          to,
          subject,
          html,
          text
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✉️ Email sent via hMail to ${to}: ${info.messageId}`);
        
        return {
          success: true,
          messageId: info.messageId,
          response: info.response
        };
      } catch (error) {
        console.error(`❌ hMail send failed:`, error.message);
        
        // Fallback to console
        console.log('\n📧 ========== FALLBACK: SIMULATED EMAIL ==========');
        console.log(`To: ${to} | Subject: ${subject}`);
        console.log('================================================\n');
        
        return {
          success: true,
          messageId: `fallback-${Date.now()}`,
          response: 'Email simulated (SMTP send failed)'
        };
      }
    }

    // Production: MailerSend API (existing code)
    // ...existing production code...
  }

  async simulate({ to, subject, template, variables, user }) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); color: #f4fff9; border-radius: 12px;">
        <div style="text-align: center; padding: 30px 0;">
          <h1 style="color: #61ffd0; font-size: 2.5rem; margin: 0;">🌦️ Test Weather Alert</h1>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="font-size: 1.1rem; line-height: 1.6;">This is a <strong>test email</strong> from Aether Weather Forecasting System.</p>
          
          <div style="margin: 20px 0; padding: 15px; background: rgba(47,231,159,0.2); border-left: 4px solid #2fe79f; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Template:</strong> ${template || 'default'}</p>
            <p style="margin: 5px 0;"><strong>Sent to:</strong> ${to}</p>
            <p style="margin: 5px 0;"><strong>Requested by:</strong> ${user?.email || 'system'}</p>
            ${variables ? `<p style="margin: 5px 0;"><strong>Variables:</strong> <pre style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px;">${JSON.stringify(variables, null, 2)}</pre></p>` : ''}
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.2);">
          <p style="color: #c9f5e8; font-size: 0.9rem;">Powered by <strong style="color: #2fe79f;">Aether</strong></p>
        </div>
      </div>
    `;

    const text = `
🌦️ Test Weather Alert

Template: ${template || 'default'}
Sent to: ${to}
Requested by: ${user?.email || 'system'}
${variables ? `\nVariables:\n${JSON.stringify(variables, null, 2)}` : ''}

Powered by Aether Weather
    `.trim();

    return await this.sendAlert({
      to,
      subject: subject || '[TEST] Aether Weather Alert',
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