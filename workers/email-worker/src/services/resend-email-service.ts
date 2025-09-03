// Enhanced Resend Email Service with React Email Templates
// Handles all email delivery via Resend API with React templates

import { Env, ResendEmailRequest, ResendEmailResponse, ResendErrorResponse } from '../../../shared/types';
import { log, getRequestId } from '../../../shared/utils';
import { EmailTemplateService } from './email-template-service';

export class ResendEmailService {
  private apiKey: string;
  private baseUrl = 'https://api.resend.com';

  constructor(env: Env) {
    this.apiKey = env.RESEND_API_KEY;
  }

  /**
   * Send unlock code email to user using React template
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
          { name: 'source', value: 'freemium_gate' },
          { name: 'template', value: 'react_email' }
        ]
      };

      const response = await this.sendEmail(emailData, requestId);
      
      if (response.success) {
        log('info', 'Unlock code email sent successfully', { 
          email, 
          messageId: response.messageId,
          template: 'react_email'
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
   * Send welcome email after access granted using React template
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
          { name: 'source', value: 'access_granted' },
          { name: 'template', value: 'react_email' }
        ]
      };

      const response = await this.sendEmail(emailData, requestId);
      
      if (response.success) {
        log('info', 'Welcome email sent successfully', { 
          email, 
          messageId: response.messageId,
          template: 'react_email'
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
   * Test email template rendering (for development)
   */
  async testTemplateRendering(requestId?: string): Promise<{
    unlockCodeTemplate: any;
    welcomeTemplate: any;
  }> {
    try {
      const unlockCodeTemplate = await EmailTemplateService.renderUnlockCodeEmail({
        firstName: 'Test User',
        unlockCode: '123456',
        expiryHours: 24
      });

      const welcomeTemplate = await EmailTemplateService.renderWelcomeEmail({
        firstName: 'Test User'
      });

      log('info', 'Template rendering test successful', {
        unlockCodeSubject: unlockCodeTemplate.subject,
        welcomeSubject: welcomeTemplate.subject
      }, requestId);

      return {
        unlockCodeTemplate,
        welcomeTemplate
      };
    } catch (error) {
      log('error', 'Template rendering test failed', {
        error: error.message
      }, requestId);
      
      throw error;
    }
  }
}
