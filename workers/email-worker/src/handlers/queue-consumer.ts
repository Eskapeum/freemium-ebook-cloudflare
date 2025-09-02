// Email queue consumer for processing email jobs

import { Env, EmailQueueMessage } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
import { log } from '../../../shared/utils';

export default {
  async queue(batch: MessageBatch<EmailQueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        const { type, email, firstName, discountCode, token, loginUrl, chapterNumber } = message.body;
        
        log('info', 'Processing email queue message', { type, email });

        switch (type) {
          case 'welcome':
            await sendWelcomeEmail(email, firstName, discountCode, env);
            break;
          
          case 'magic_link':
            await sendMagicLinkEmail(email, firstName, token, loginUrl, env);
            break;
          
          case 'chapter_delivery':
            await sendChapterEmail(email, firstName, chapterNumber, env);
            break;
          
          case 'reminder':
            await sendReminderEmail(email, firstName, env);
            break;
          
          default:
            log('warn', 'Unknown email type', { type, email });
        }
        
        // Mark message as processed
        message.ack();
        
        log('info', 'Email message processed successfully', { type, email });
        
      } catch (error) {
        log('error', 'Failed to process email message', { 
          error: error.message,
          messageId: message.id,
          body: message.body
        });
        
        // Retry the message (don't ack)
        message.retry();
      }
    }
  }
};

async function sendWelcomeEmail(
  email: string, 
  firstName: string | undefined, 
  discountCode: string | undefined, 
  env: Env
): Promise<void> {
  const emailContent = {
    to: [{ email }],
    from: { email: 'noreply@yourhandbook.com', name: 'Content Creator Handbook' },
    subject: '🎉 Welcome! Your Free Chapters + 10% Discount Inside',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome ${firstName || 'Fellow Creator'}! 🎉</h1>
        
        <p>Thank you for joining thousands of content creators who are transforming their content strategy!</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #1f2937; margin-top: 0;">🎁 Your Welcome Package:</h2>
          <ul style="color: #374151;">
            <li><strong>FREE Access</strong> to the first 7 chapters</li>
            <li><strong>50+ Viral Content Templates</strong></li>
            <li><strong>Platform-specific optimization guides</strong></li>
            ${discountCode ? `<li><strong>10% Discount Code:</strong> <code style="background: #e5e7eb; padding: 4px 8px; border-radius: 4px;">${discountCode}</code></li>` : ''}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${env.FRONTEND_URL}/chapters" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Start Reading Now →
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          Ready to unlock the complete handbook? Use your discount code for 10% off the full version!
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="color: #9ca3af; font-size: 12px;">
          You're receiving this because you signed up for the Content Creator's Handbook. 
          <a href="${env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #6b7280;">Unsubscribe</a>
        </p>
      </div>
    `
  };

  await sendEmailViaSendGrid(emailContent, env);
  
  // Update email sent count
  const emailDB = new EmailSubscriberDB(env);
  await emailDB.updateEmailsSent(email);
}

async function sendMagicLinkEmail(
  email: string, 
  firstName: string | undefined, 
  token: string | undefined, 
  loginUrl: string | undefined, 
  env: Env
): Promise<void> {
  const emailContent = {
    to: [{ email }],
    from: { email: 'noreply@yourhandbook.com', name: 'Content Creator Handbook' },
    subject: '🔐 Your Magic Link - Access Your Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Your Magic Link 🔐</h1>
        
        <p>Hi ${firstName || 'there'}!</p>
        
        <p>Click the button below to securely access your Content Creator's Handbook account:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Access My Account →
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          This link will expire in 15 minutes for security reasons. If you didn't request this, you can safely ignore this email.
        </p>
        
        <p style="color: #9ca3af; font-size: 12px;">
          Having trouble? Copy and paste this link into your browser:<br>
          <a href="${loginUrl}" style="color: #6b7280; word-break: break-all;">${loginUrl}</a>
        </p>
      </div>
    `
  };

  await sendEmailViaSendGrid(emailContent, env);
  
  // Update email sent count
  const emailDB = new EmailSubscriberDB(env);
  await emailDB.updateEmailsSent(email);
}

async function sendChapterEmail(
  email: string, 
  firstName: string | undefined, 
  chapterNumber: number | undefined, 
  env: Env
): Promise<void> {
  const emailContent = {
    to: [{ email }],
    from: { email: 'noreply@yourhandbook.com', name: 'Content Creator Handbook' },
    subject: `📚 Chapter ${chapterNumber} is Ready!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">New Chapter Available! 📚</h1>
        
        <p>Hi ${firstName || 'Fellow Creator'}!</p>
        
        <p>Chapter ${chapterNumber} of the Content Creator's Handbook is now available for you to read.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${env.FRONTEND_URL}/chapters/${chapterNumber}" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Read Chapter ${chapterNumber} →
          </a>
        </div>
        
        <p style="color: #6b7280;">Keep up the great work on your content creation journey!</p>
      </div>
    `
  };

  await sendEmailViaSendGrid(emailContent, env);
  
  // Update email sent count
  const emailDB = new EmailSubscriberDB(env);
  await emailDB.updateEmailsSent(email);
}

async function sendReminderEmail(
  email: string, 
  firstName: string | undefined, 
  env: Env
): Promise<void> {
  const emailContent = {
    to: [{ email }],
    from: { email: 'noreply@yourhandbook.com', name: 'Content Creator Handbook' },
    subject: '👋 Continue Your Content Creation Journey',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Don't Let Your Progress Slip Away! 👋</h1>
        
        <p>Hi ${firstName || 'Fellow Creator'}!</p>
        
        <p>We noticed you haven't been back to continue reading the Content Creator's Handbook. Your progress is waiting for you!</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${env.FRONTEND_URL}/chapters" 
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Continue Reading →
          </a>
        </div>
        
        <p style="color: #6b7280;">Remember, consistency is key to mastering content creation!</p>
      </div>
    `
  };

  await sendEmailViaSendGrid(emailContent, env);
  
  // Update email sent count
  const emailDB = new EmailSubscriberDB(env);
  await emailDB.updateEmailsSent(email);
}

async function sendEmailViaSendGrid(emailContent: any, env: Env): Promise<void> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailContent)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }
}
