// Email Template Service for Creator's Handbook
// Renders React Email templates to HTML

import { render } from '@react-email/render';
import { UnlockCodeEmail } from '../email-templates/unlock-code-email';
import { WelcomeEmail } from '../email-templates/welcome-email';

export interface UnlockCodeTemplateData {
  firstName?: string;
  unlockCode: string;
  expiryHours?: number;
}

export interface WelcomeTemplateData {
  firstName?: string;
}

export interface FollowUpDay3TemplateData {
  firstName?: string;
}

export class EmailTemplateService {
  /**
   * Render unlock code email template to HTML
   */
  static async renderUnlockCodeEmail(data: UnlockCodeTemplateData): Promise<{
    html: string;
    text: string;
    subject: string;
  }> {
    try {
      const html = await render(UnlockCodeEmail({
        firstName: data.firstName || 'Creator',
        unlockCode: data.unlockCode,
        expiryHours: data.expiryHours || 24,
      }));

      const text = this.generateUnlockCodeText(
        data.unlockCode,
        data.firstName,
        data.expiryHours
      );

      const subject = '🔓 Your Creator\'s Handbook Access Code';

      // Ensure html is a string
      const htmlString = typeof html === 'string' ? html : String(html);

      return { html: htmlString, text, subject };
    } catch (error) {
      throw new Error(`Failed to render unlock code email: ${error.message}`);
    }
  }

  /**
   * Render welcome email template to HTML
   */
  static async renderWelcomeEmail(data: WelcomeTemplateData): Promise<{
    html: string;
    text: string;
    subject: string;
  }> {
    try {
      const html = await render(WelcomeEmail({
        firstName: data.firstName || 'Creator',
      }));

      const text = this.generateWelcomeText(data.firstName);

      const subject = '🎉 Welcome to Creator\'s Handbook Premium!';

      // Ensure html is a string
      const htmlString = typeof html === 'string' ? html : String(html);

      return { html: htmlString, text, subject };
    } catch (error) {
      throw new Error(`Failed to render welcome email: ${error.message}`);
    }
  }

  /**
   * Generate plain text version of unlock code email
   */
  private static generateUnlockCodeText(
    unlockCode: string, 
    firstName?: string, 
    expiryHours?: number
  ): string {
    const name = firstName || 'Creator';
    const hours = expiryHours || 24;
    
    return `
Hi ${name},

Thanks for your interest in the Creator's Handbook! Here's your 6-digit access code to unlock all premium chapters:

ACCESS CODE: ${unlockCode}

What's next?
✅ Go back to the Creator's Handbook
✅ Enter this code when prompted  
✅ Enjoy instant access to all 28 premium chapters!

⏰ This code expires in ${hours} hours for security reasons.

Ready to dive in? Access your handbook here:
https://creators-handbook-frontend.tdadelaja.workers.dev

Happy creating!
The Creator's Handbook Team

---
This email was sent because you requested access to premium content. If you didn't request this, you can safely ignore this email.
`.trim();
  }

  /**
   * Generate plain text version of welcome email
   */
  private static generateWelcomeText(firstName?: string): string {
    const name = firstName || 'Creator';
    
    return `
Hi ${name},

🎉 Welcome to Premium Access!

✅ Access Granted!
You now have full access to all 28 chapters of the Creator's Handbook.

What you get with premium access:
📚 Complete access to all premium chapters
🚀 Advanced strategies and business-building techniques
📄 Downloadable resources and templates
🔄 Lifetime access to updates
💡 Exclusive insights from successful creators

Ready to dive in? Your handbook is waiting for you!
https://creators-handbook-frontend.tdadelaja.workers.dev

💡 Pro Tips to Get Started:
• Start with Chapter 8 - "Building Your Creator Foundation"
• Download the templates in Chapter 15
• Join our community discussions (coming soon!)

Happy creating!
The Creator's Handbook Team

Follow us for more creator tips:
Twitter • LinkedIn • YouTube
`.trim();
  }

  /**
   * Validate template data
   */
  static validateUnlockCodeData(data: any): data is UnlockCodeTemplateData {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.unlockCode === 'string' &&
      data.unlockCode.length === 6 &&
      /^\d{6}$/.test(data.unlockCode)
    );
  }

  /**
   * Render Day 3 follow-up email template to HTML
   */
  static async renderFollowUpDay3Email(data: FollowUpDay3TemplateData): Promise<{
    html: string;
    text: string;
    subject: string;
  }> {
    try {
      const { FollowUpDay3Email } = await import('../email-templates/follow-up-day3');

      const html = await render(FollowUpDay3Email({
        firstName: data.firstName || 'Creator',
      }));

      const text = this.generateFollowUpDay3Text(data.firstName);

      const subject = '🌟 Success Stories from Fellow Creators';

      // Ensure html is a string
      const htmlString = typeof html === 'string' ? html : String(html);

      return { html: htmlString, text, subject };
    } catch (error) {
      throw new Error(`Failed to render Day 3 follow-up email: ${error.message}`);
    }
  }

  /**
   * Generate plain text version of Day 3 follow-up email
   */
  private static generateFollowUpDay3Text(firstName?: string): string {
    const name = firstName || 'Creator';

    return `
Success Stories from Fellow Creators

Hi ${name},

It's been 3 days since you unlocked the Creator's Handbook! I wanted to share some inspiring success stories from fellow creators who've implemented these strategies.

📈 Sarah's Newsletter Growth
"Using Chapter 12's email strategies, I grew my newsletter from 500 to 5,000 subscribers in just 2 months. The templates saved me hours every week!"
— Sarah K., Content Creator

💰 Mike's Revenue Boost
"Chapter 18's monetization framework helped me launch my first digital product. I made $10K in the first month!"
— Mike R., Course Creator

Ready to join them? Here are your next steps:
✅ Complete Chapters 8-12 (Foundation Building)
✅ Download the templates from Chapter 15
✅ Join our exclusive creator community

Continue Reading: https://creators-handbook-frontend.tdadelaja.workers.dev

🎯 Join Our Creator Community
Connect with 500+ creators implementing these strategies. Share wins, get feedback, and access exclusive resources.

Questions? Just reply to this email - I read every message personally!

Keep creating!
The Creator's Handbook Team
`.trim();
  }

  static validateWelcomeData(data: any): data is WelcomeTemplateData {
    return typeof data === 'object' && data !== null;
  }

  static validateFollowUpDay3Data(data: any): data is FollowUpDay3TemplateData {
    return typeof data === 'object' && data !== null;
  }
}
