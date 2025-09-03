// Resend Email Service for Creator's Handbook
// Handles all email delivery via Resend API

import { Env, ResendEmailRequest, ResendEmailResponse, ResendErrorResponse } from './types';
import { log, getRequestId } from './utils';
// Note: EmailTemplateService will be imported dynamically in the email worker

export class ResendEmailService {
  private apiKey: string;
  private baseUrl = 'https://api.resend.com';

  constructor(env: Env) {
    this.apiKey = env.RESEND_API_KEY;
  }

  /**
   * Send unlock code email to user
   */
  async sendUnlockCodeEmail(
    email: string,
    unlockCode: string,
    firstName?: string,
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Render React email template
      const emailTemplate = await EmailTemplateService.renderUnlockCodeEmail({
        firstName,
        unlockCode,
        expiryHours: 24
      });

      const emailData: ResendEmailRequest = {
        from: 'Acme <onboarding@resend.dev>',
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        tags: [
          { name: 'type', value: 'unlock_code' },
          { name: 'source', value: 'freemium_gate' }
        ]
      };

      const response = await this.sendEmail(emailData, requestId);
      
      if (response.success) {
        log('info', 'Unlock code email sent successfully', { 
          email, 
          messageId: response.messageId 
        }, requestId);
        
        return { success: true, messageId: response.messageId };
      } else {
        log('error', 'Failed to send unlock code email', { 
          email, 
          error: response.error 
        }, requestId);
        
        return { success: false, error: response.error };
      }
    } catch (error) {
      log('error', 'Error sending unlock code email', { 
        email, 
        error: error.message 
      }, requestId);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email after access granted
   */
  async sendWelcomeEmail(
    email: string,
    firstName?: string,
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Render React email template
      const emailTemplate = await EmailTemplateService.renderWelcomeEmail({
        firstName
      });

      const emailData: ResendEmailRequest = {
        from: 'Acme <onboarding@resend.dev>',
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        tags: [
          { name: 'type', value: 'welcome' },
          { name: 'source', value: 'access_granted' }
        ]
      };

      const response = await this.sendEmail(emailData, requestId);
      
      if (response.success) {
        log('info', 'Welcome email sent successfully', { 
          email, 
          messageId: response.messageId 
        }, requestId);
        
        return { success: true, messageId: response.messageId };
      } else {
        log('error', 'Failed to send welcome email', { 
          email, 
          error: response.error 
        }, requestId);
        
        return { success: false, error: response.error };
      }
    } catch (error) {
      log('error', 'Error sending welcome email', { 
        email, 
        error: error.message 
      }, requestId);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Core email sending method
   */
  private async sendEmail(
    emailData: ResendEmailRequest, 
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        const result: ResendEmailResponse = await response.json();
        return { success: true, messageId: result.id };
      } else {
        const errorResult: ResendErrorResponse = await response.json();
        return { success: false, error: errorResult.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Legacy HTML template for unlock code email (kept for fallback)
   */
  private generateUnlockCodeHTML(unlockCode: string, firstName?: string): string {
    const name = firstName ? firstName : 'Creator';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Creator's Handbook Access Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .code-box { background: #f8f9fa; border: 2px solid #22d172; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .code { font-size: 32px; font-weight: bold; color: #22d172; letter-spacing: 4px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔓 Your Access Code is Ready!</h1>
    </div>
    
    <p>Hi ${name},</p>
    
    <p>Thanks for your interest in the Creator's Handbook! Here's your 6-digit access code to unlock all premium chapters:</p>
    
    <div class="code-box">
      <div class="code">${unlockCode}</div>
    </div>
    
    <p><strong>What's next?</strong></p>
    <ul>
      <li>Go back to the Creator's Handbook</li>
      <li>Enter this code when prompted</li>
      <li>Enjoy instant access to all 28 premium chapters!</li>
    </ul>
    
    <p>This code expires in 24 hours for security reasons.</p>
    
    <div class="footer">
      <p>Happy creating!<br>The Creator's Handbook Team</p>
      <p><em>This email was sent because you requested access to premium content. If you didn't request this, you can safely ignore this email.</em></p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate plain text template for unlock code email
   */
  private generateUnlockCodeText(unlockCode: string, firstName?: string): string {
    const name = firstName ? firstName : 'Creator';
    
    return `
Hi ${name},

Thanks for your interest in the Creator's Handbook! Here's your 6-digit access code to unlock all premium chapters:

ACCESS CODE: ${unlockCode}

What's next?
- Go back to the Creator's Handbook
- Enter this code when prompted  
- Enjoy instant access to all 28 premium chapters!

This code expires in 24 hours for security reasons.

Happy creating!
The Creator's Handbook Team

---
This email was sent because you requested access to premium content. If you didn't request this, you can safely ignore this email.
`;
  }

  /**
   * Generate HTML template for welcome email
   */
  private generateWelcomeHTML(firstName?: string): string {
    const name = firstName ? firstName : 'Creator';
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Creator's Handbook Premium!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .success-box { background: #f0f9ff; border: 2px solid #22d172; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to Premium Access!</h1>
    </div>
    
    <p>Hi ${name},</p>
    
    <div class="success-box">
      <h2>✅ Access Granted!</h2>
      <p>You now have full access to all 28 chapters of the Creator's Handbook.</p>
    </div>
    
    <p><strong>What you get:</strong></p>
    <ul>
      <li>Complete access to all premium chapters</li>
      <li>Advanced strategies and business-building techniques</li>
      <li>Downloadable resources and templates</li>
      <li>Lifetime access to updates</li>
    </ul>
    
    <p>Ready to dive in? Head back to the handbook and start exploring!</p>
    
    <div class="footer">
      <p>Happy creating!<br>The Creator's Handbook Team</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate plain text template for welcome email
   */
  private generateWelcomeText(firstName?: string): string {
    const name = firstName ? firstName : 'Creator';
    
    return `
Hi ${name},

🎉 Welcome to Premium Access!

✅ Access Granted!
You now have full access to all 28 chapters of the Creator's Handbook.

What you get:
- Complete access to all premium chapters
- Advanced strategies and business-building techniques  
- Downloadable resources and templates
- Lifetime access to updates

Ready to dive in? Head back to the handbook and start exploring!

Happy creating!
The Creator's Handbook Team
`;
  }
}
