// Email Sequence Processor
// Processes and sends scheduled follow-up emails

import { Env } from '../../../shared/types';
import { log, getRequestId } from '../../../shared/utils';
import { EmailSequenceDB } from './email-sequence-db';
import { ResendEmailService } from './resend-email-service';
import { EmailTemplateService } from './email-template-service';

export class EmailSequenceProcessor {
  private env: Env;
  private sequenceDB: EmailSequenceDB;
  private emailService: ResendEmailService;

  constructor(env: Env) {
    this.env = env;
    this.sequenceDB = new EmailSequenceDB(env);
    this.emailService = new ResendEmailService(env);
  }

  /**
   * Process all pending emails in the sequence
   */
  async processPendingEmails(requestId?: string): Promise<{
    processed: number;
    sent: number;
    failed: number;
    errors: any[];
  }> {
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get emails ready to be sent
      const emailsToSend = await this.sequenceDB.getEmailsToSend(50);
      results.processed = emailsToSend.length;

      log('info', `Processing ${emailsToSend.length} scheduled emails`, {
        count: emailsToSend.length
      }, requestId);

      for (const scheduledEmail of emailsToSend) {
        try {
          await this.sendScheduledEmail(scheduledEmail, requestId);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            scheduledEmailId: scheduledEmail.id,
            email: scheduledEmail.email,
            error: error.message
          });

          // Mark email as failed in database
          await this.sequenceDB.markEmailFailed(scheduledEmail.id, error.message);
        }
      }

      log('info', 'Email sequence processing completed', {
        processed: results.processed,
        sent: results.sent,
        failed: results.failed
      }, requestId);

      return results;

    } catch (error) {
      log('error', 'Email sequence processing failed', {
        error: error.message
      }, requestId);

      throw error;
    }
  }

  /**
   * Send a single scheduled email
   */
  private async sendScheduledEmail(scheduledEmail: any, requestId?: string): Promise<void> {
    const { id, email, first_name, email_type, subject, sequence_step } = scheduledEmail;

    log('info', 'Sending scheduled email', {
      scheduledEmailId: id,
      email,
      emailType: email_type,
      sequenceStep: sequence_step
    }, requestId);

    let emailResult;

    switch (email_type) {
      case 'welcome':
        emailResult = await this.emailService.sendWelcomeEmail(email, first_name, requestId);
        break;

      case 'follow_up_day3':
        emailResult = await this.sendFollowUpDay3Email(email, first_name, requestId);
        break;

      case 'follow_up_day7':
        emailResult = await this.sendFollowUpDay7Email(email, first_name, requestId);
        break;

      case 'follow_up_day14':
        emailResult = await this.sendFollowUpDay14Email(email, first_name, requestId);
        break;

      case 'follow_up_day30':
        emailResult = await this.sendFollowUpDay30Email(email, first_name, requestId);
        break;

      default:
        throw new Error(`Unknown email type: ${email_type}`);
    }

    if (emailResult.success) {
      await this.sequenceDB.markEmailSent(id, emailResult.messageId);
      
      log('info', 'Scheduled email sent successfully', {
        scheduledEmailId: id,
        email,
        messageId: emailResult.messageId,
        emailType: email_type
      }, requestId);
    } else {
      throw new Error(emailResult.error || 'Failed to send email');
    }
  }

  /**
   * Send Day 3 follow-up email
   */
  private async sendFollowUpDay3Email(
    email: string,
    firstName?: string,
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Import the Day 3 template dynamically
      const { FollowUpDay3Email } = await import('../email-templates/follow-up-day3');
      
      const emailTemplate = await EmailTemplateService.renderFollowUpDay3Email({
        firstName
      });

      const emailData = {
        from: 'Acme <onboarding@resend.dev>',
        to: email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        tags: [
          { name: 'type', value: 'follow_up_day3' },
          { name: 'source', value: 'email_sequence' },
          { name: 'template', value: 'react_email' }
        ]
      };

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.id };
      } else {
        const errorResult = await response.json();
        return { success: false, error: errorResult.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Day 7 follow-up email (placeholder)
   */
  private async sendFollowUpDay7Email(
    email: string,
    firstName?: string,
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // For now, send a simple email - you can create a proper template later
    const emailData = {
      from: 'Acme <onboarding@resend.dev>',
      to: email,
      subject: '🚀 Advanced Creator Tips + Free Resources',
      html: `
        <h1>Advanced Creator Tips</h1>
        <p>Hi ${firstName || 'Creator'},</p>
        <p>Here are some advanced tips to accelerate your creator journey...</p>
        <p><a href="https://creators-handbook-frontend.tdadelaja.workers.dev">Continue Reading</a></p>
      `,
      text: `Advanced Creator Tips\n\nHi ${firstName || 'Creator'},\n\nHere are some advanced tips to accelerate your creator journey...\n\nContinue Reading: https://creators-handbook-frontend.tdadelaja.workers.dev`,
      tags: [
        { name: 'type', value: 'follow_up_day7' },
        { name: 'source', value: 'email_sequence' }
      ]
    };

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.id };
      } else {
        const errorResult = await response.json();
        return { success: false, error: errorResult.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Day 14 follow-up email (placeholder)
   */
  private async sendFollowUpDay14Email(
    email: string,
    firstName?: string,
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const emailData = {
      from: 'Acme <onboarding@resend.dev>',
      to: email,
      subject: '💭 How\'s your creator journey going?',
      html: `
        <h1>How's Your Creator Journey Going?</h1>
        <p>Hi ${firstName || 'Creator'},</p>
        <p>It's been 2 weeks since you started with the Creator's Handbook. How are things going?</p>
        <p>I'd love to hear about your progress and any challenges you're facing.</p>
        <p><a href="mailto:support@creators-handbook.com">Reply and let me know!</a></p>
      `,
      text: `How's Your Creator Journey Going?\n\nHi ${firstName || 'Creator'},\n\nIt's been 2 weeks since you started with the Creator's Handbook. How are things going?\n\nI'd love to hear about your progress and any challenges you're facing.\n\nReply and let me know!`,
      tags: [
        { name: 'type', value: 'follow_up_day14' },
        { name: 'source', value: 'email_sequence' }
      ]
    };

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.id };
      } else {
        const errorResult = await response.json();
        return { success: false, error: errorResult.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send Day 30 follow-up email (placeholder)
   */
  private async sendFollowUpDay30Email(
    email: string,
    firstName?: string,
    requestId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const emailData = {
      from: 'Acme <onboarding@resend.dev>',
      to: email,
      subject: '📈 New Content + Exclusive Opportunities',
      html: `
        <h1>New Content + Exclusive Opportunities</h1>
        <p>Hi ${firstName || 'Creator'},</p>
        <p>It's been a month since you joined the Creator's Handbook community!</p>
        <p>Here's what's new:</p>
        <ul>
          <li>3 new chapters on advanced monetization</li>
          <li>Updated templates and resources</li>
          <li>Exclusive creator community access</li>
        </ul>
        <p><a href="https://creators-handbook-frontend.tdadelaja.workers.dev">Check out the updates</a></p>
      `,
      text: `New Content + Exclusive Opportunities\n\nHi ${firstName || 'Creator'},\n\nIt's been a month since you joined the Creator's Handbook community!\n\nHere's what's new:\n- 3 new chapters on advanced monetization\n- Updated templates and resources\n- Exclusive creator community access\n\nCheck out the updates: https://creators-handbook-frontend.tdadelaja.workers.dev`,
      tags: [
        { name: 'type', value: 'follow_up_day30' },
        { name: 'source', value: 'email_sequence' }
      ]
    };

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, messageId: result.id };
      } else {
        const errorResult = await response.json();
        return { success: false, error: errorResult.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Add user to email sequence when they unlock access
   */
  async addUserToSequence(
    email: string,
    firstName?: string,
    lastName?: string,
    requestId?: string
  ): Promise<void> {
    try {
      await this.sequenceDB.addSubscriber({
        email,
        firstName,
        lastName,
        subscriptionDate: new Date(),
        currentSequenceStep: 0,
        isActive: true,
        tags: ['handbook_unlock']
      });

      log('info', 'User added to email sequence', {
        email,
        firstName
      }, requestId);

    } catch (error) {
      log('error', 'Failed to add user to email sequence', {
        email,
        error: error.message
      }, requestId);

      throw error;
    }
  }
}
