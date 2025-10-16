// Send password reset OTP (for settings page)
exports.sendPasswordResetOTP = async (email, userName, otp) => {
  const mailOptions = {
    from: '"Aether Weather" <noreply@aether.local>',
    to: email,
    subject: '🔒 Password Reset Code - Aether',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); border-radius: 12px;">
        <div style="background: rgba(255,255,255,0.95); padding: 30px; border-radius: 8px;">
          <h2 style="color: #053943; margin-bottom: 20px;">Password Reset Request</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            You requested to reset your password. Use the code below to proceed:
          </p>
          <div style="background: #f0f9ff; border: 2px solid #2fe79f; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #053943; letter-spacing: 8px;">${otp}</div>
            <p style="color: #666; font-size: 14px; margin-top: 10px;">This code expires in 5 minutes</p>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            If you didn't request this, please ignore this email or contact support if you're concerned.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Aether Weather | Secure Weather Forecasting
            </p>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Send password change confirmation
exports.sendPasswordChangeConfirmation = async (email, userName) => {
  const mailOptions = {
    from: '"Aether Weather" <noreply@aether.local>',
    to: email,
    subject: '✅ Password Changed Successfully - Aether',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); border-radius: 12px;">
        <div style="background: rgba(255,255,255,0.95); padding: 30px; border-radius: 8px;">
          <h2 style="color: #2fe79f; margin-bottom: 20px;">✅ Password Changed</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your password has been successfully changed. If you didn't make this change, please contact support immediately.
          </p>
          <div style="background: #f0fff4; border-left: 4px solid #2fe79f; padding: 15px; margin: 20px 0;">
            <p style="color: #333; margin: 0;">
              <strong>Security Tip:</strong> Use a unique, strong password and enable two-factor authentication for maximum security.
            </p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Aether Weather | Secure Weather Forecasting
            </p>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Send email change OTP
exports.sendEmailChangeOTP = async (newEmail, userName, otp) => {
  const mailOptions = {
    from: '"Aether Weather" <noreply@aether.local>',
    to: newEmail,
    subject: '📧 Email Verification Code - Aether',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); border-radius: 12px;">
        <div style="background: rgba(255,255,255,0.95); padding: 30px; border-radius: 8px;">
          <h2 style="color: #053943; margin-bottom: 20px;">Email Verification</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            You requested to change your email address. Enter this code to verify:
          </p>
          <div style="background: #f0f9ff; border: 2px solid #2fe79f; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #053943; letter-spacing: 8px;">${otp}</div>
            <p style="color: #666; font-size: 14px; margin-top: 10px;">This code expires in 5 minutes</p>
          </div>
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            If you didn't request this change, please ignore this email.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Aether Weather | Secure Weather Forecasting
            </p>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Send email change confirmation
exports.sendEmailChangeConfirmation = async (oldEmail, newEmail, userName) => {
  // Send to old email
  const oldEmailOptions = {
    from: '"Aether Weather" <noreply@aether.local>',
    to: oldEmail,
    subject: '📧 Email Address Changed - Aether',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); border-radius: 12px;">
        <div style="background: rgba(255,255,255,0.95); padding: 30px; border-radius: 8px;">
          <h2 style="color: #2fe79f; margin-bottom: 20px;">Email Address Changed</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your email address has been changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            If you didn't make this change, please contact support immediately.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Aether Weather | Secure Weather Forecasting
            </p>
          </div>
        </div>
      </div>
    `
  };

  // Send to new email
  const newEmailOptions = {
    from: '"Aether Weather" <noreply@aether.local>',
    to: newEmail,
    subject: '✅ Welcome to Your New Email - Aether',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); border-radius: 12px;">
        <div style="background: rgba(255,255,255,0.95); padding: 30px; border-radius: 8px;">
          <h2 style="color: #2fe79f; margin-bottom: 20px;">✅ Email Verified</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your email address has been successfully updated. This is now your primary email for Aether.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Aether Weather | Secure Weather Forecasting
            </p>
          </div>
        </div>
      </div>
    `
  };

  await transporter.sendMail(oldEmailOptions);
  return transporter.sendMail(newEmailOptions);
};

// Send account deletion confirmation
exports.sendAccountDeletionConfirmation = async (email, userName) => {
  const mailOptions = {
    from: '"Aether Weather" <noreply@aether.local>',
    to: email,
    subject: '👋 Account Deleted - Aether',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #053943 0%, #064f46 100%); border-radius: 12px;">
        <div style="background: rgba(255,255,255,0.95); padding: 30px; border-radius: 8px;">
          <h2 style="color: #666; margin-bottom: 20px;">Account Deleted</h2>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hi ${userName},
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your Aether account has been permanently deleted as requested. All your data, including saved locations and preferences, has been removed.
          </p>
          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            We're sorry to see you go! If you change your mind, you're always welcome to create a new account.
          </p>
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; font-size: 14px; margin: 0;">
              Thank you for using Aether Weather. We hope to see you again! 🌤️
            </p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              Aether Weather | Stay Weather-Aware
            </p>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};