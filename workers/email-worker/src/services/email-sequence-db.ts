// Email Sequence Database Service
// Manages automated follow-up email sequences

import { Env } from '../../../shared/types';
import { log } from '../../../shared/utils';

export interface EmailSequenceSubscriber {
  id?: number;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionDate: Date;
  currentSequenceStep: number;
  lastEmailSent?: Date;
  isActive: boolean;
  tags?: string[];
}

export interface EmailSequenceStep {
  stepNumber: number;
  delayDays: number;
  emailType: string;
  subject: string;
  isActive: boolean;
}

export interface ScheduledEmail {
  id?: number;
  subscriberId: number;
  sequenceStep: number;
  scheduledFor: Date;
  emailType: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sentAt?: Date;
  errorMessage?: string;
}

export class EmailSequenceDB {
  private db: D1Database;

  constructor(env: Env) {
    this.db = env.DB;
  }

  /**
   * Initialize sequence tables
   */
  async initializeTables(): Promise<void> {
    // Email sequence subscribers table
    const createSubscribersTable = `
      CREATE TABLE IF NOT EXISTS email_sequence_subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        first_name TEXT,
        last_name TEXT,
        subscription_date DATETIME NOT NULL,
        current_sequence_step INTEGER DEFAULT 0,
        last_email_sent DATETIME,
        is_active BOOLEAN DEFAULT 1,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Email sequence steps configuration
    const createSequenceStepsTable = `
      CREATE TABLE IF NOT EXISTS email_sequence_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        step_number INTEGER NOT NULL,
        delay_days INTEGER NOT NULL,
        email_type TEXT NOT NULL,
        subject TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Scheduled emails queue
    const createScheduledEmailsTable = `
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        sequence_step INTEGER NOT NULL,
        scheduled_for DATETIME NOT NULL,
        email_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES email_sequence_subscribers (id)
      )
    `;

    await this.db.prepare(createSubscribersTable).run();
    await this.db.prepare(createSequenceStepsTable).run();
    await this.db.prepare(createScheduledEmailsTable).run();

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_subscribers_email ON email_sequence_subscribers(email)',
      'CREATE INDEX IF NOT EXISTS idx_subscribers_active ON email_sequence_subscribers(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_emails(status)',
      'CREATE INDEX IF NOT EXISTS idx_scheduled_for ON scheduled_emails(scheduled_for)',
    ];

    for (const indexQuery of indexes) {
      await this.db.prepare(indexQuery).run();
    }

    // Initialize default sequence steps if they don't exist
    await this.initializeDefaultSequence();
  }

  /**
   * Initialize default email sequence
   */
  private async initializeDefaultSequence(): Promise<void> {
    const defaultSteps = [
      { stepNumber: 1, delayDays: 0, emailType: 'welcome', subject: '🎉 Welcome to Creator\'s Handbook Premium!' },
      { stepNumber: 2, delayDays: 3, emailType: 'follow_up_day3', subject: '🌟 Success Stories from Fellow Creators' },
      { stepNumber: 3, delayDays: 7, emailType: 'follow_up_day7', subject: '🚀 Advanced Creator Tips + Free Resources' },
      { stepNumber: 4, delayDays: 14, emailType: 'follow_up_day14', subject: '💭 How\'s your creator journey going?' },
      { stepNumber: 5, delayDays: 30, emailType: 'follow_up_day30', subject: '📈 New Content + Exclusive Opportunities' },
    ];

    for (const step of defaultSteps) {
      const existing = await this.db.prepare(
        'SELECT id FROM email_sequence_steps WHERE step_number = ?'
      ).bind(step.stepNumber).first();

      if (!existing) {
        await this.db.prepare(`
          INSERT INTO email_sequence_steps (step_number, delay_days, email_type, subject)
          VALUES (?, ?, ?, ?)
        `).bind(step.stepNumber, step.delayDays, step.emailType, step.subject).run();
      }
    }
  }

  /**
   * Add subscriber to email sequence
   */
  async addSubscriber(subscriber: EmailSequenceSubscriber): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO email_sequence_subscribers 
      (email, first_name, last_name, subscription_date, current_sequence_step, is_active, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await stmt.bind(
      subscriber.email,
      subscriber.firstName || null,
      subscriber.lastName || null,
      subscriber.subscriptionDate.toISOString(),
      subscriber.currentSequenceStep || 0,
      subscriber.isActive ? 1 : 0,
      subscriber.tags ? JSON.stringify(subscriber.tags) : null
    ).run();

    const subscriberId = result.meta.last_row_id as number;

    // Schedule the first email (welcome email)
    await this.scheduleNextEmail(subscriberId);

    log('info', 'Subscriber added to email sequence', {
      email: subscriber.email,
      subscriberId
    });

    return subscriberId;
  }

  /**
   * Schedule next email in sequence for subscriber
   */
  async scheduleNextEmail(subscriberId: number): Promise<void> {
    // Get subscriber info
    const subscriber = await this.db.prepare(`
      SELECT * FROM email_sequence_subscribers WHERE id = ? AND is_active = 1
    `).bind(subscriberId).first() as any;

    if (!subscriber) {
      log('warn', 'Subscriber not found or inactive', { subscriberId });
      return;
    }

    const nextStep = subscriber.current_sequence_step + 1;

    // Get next sequence step
    const sequenceStep = await this.db.prepare(`
      SELECT * FROM email_sequence_steps WHERE step_number = ? AND is_active = 1
    `).bind(nextStep).first() as any;

    if (!sequenceStep) {
      log('info', 'No more sequence steps for subscriber', { 
        subscriberId, 
        email: subscriber.email,
        completedSteps: subscriber.current_sequence_step
      });
      return;
    }

    // Calculate scheduled time
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + sequenceStep.delay_days);

    // Schedule the email
    await this.db.prepare(`
      INSERT INTO scheduled_emails (subscriber_id, sequence_step, scheduled_for, email_type)
      VALUES (?, ?, ?, ?)
    `).bind(
      subscriberId,
      nextStep,
      scheduledFor.toISOString(),
      sequenceStep.email_type
    ).run();

    log('info', 'Email scheduled', {
      subscriberId,
      email: subscriber.email,
      sequenceStep: nextStep,
      emailType: sequenceStep.email_type,
      scheduledFor: scheduledFor.toISOString()
    });
  }

  /**
   * Get emails ready to be sent
   */
  async getEmailsToSend(limit: number = 50): Promise<any[]> {
    const now = new Date().toISOString();
    
    const query = `
      SELECT 
        se.*,
        s.email,
        s.first_name,
        s.last_name,
        ss.subject
      FROM scheduled_emails se
      JOIN email_sequence_subscribers s ON se.subscriber_id = s.id
      JOIN email_sequence_steps ss ON se.sequence_step = ss.step_number
      WHERE se.status = 'pending' 
        AND se.scheduled_for <= ?
        AND s.is_active = 1
      ORDER BY se.scheduled_for ASC
      LIMIT ?
    `;

    const result = await this.db.prepare(query).bind(now, limit).all();
    return result.results as any[];
  }

  /**
   * Mark email as sent and update subscriber progress
   */
  async markEmailSent(scheduledEmailId: number, messageId?: string): Promise<void> {
    const now = new Date().toISOString();

    // Get scheduled email info
    const scheduledEmail = await this.db.prepare(`
      SELECT * FROM scheduled_emails WHERE id = ?
    `).bind(scheduledEmailId).first() as any;

    if (!scheduledEmail) {
      throw new Error('Scheduled email not found');
    }

    // Mark email as sent
    await this.db.prepare(`
      UPDATE scheduled_emails 
      SET status = 'sent', sent_at = ?
      WHERE id = ?
    `).bind(now, scheduledEmailId).run();

    // Update subscriber progress
    await this.db.prepare(`
      UPDATE email_sequence_subscribers 
      SET current_sequence_step = ?, last_email_sent = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      scheduledEmail.sequence_step,
      now,
      now,
      scheduledEmail.subscriber_id
    ).run();

    // Schedule next email
    await this.scheduleNextEmail(scheduledEmail.subscriber_id);

    log('info', 'Email marked as sent and next email scheduled', {
      scheduledEmailId,
      subscriberId: scheduledEmail.subscriber_id,
      sequenceStep: scheduledEmail.sequence_step,
      messageId
    });
  }

  /**
   * Mark email as failed
   */
  async markEmailFailed(scheduledEmailId: number, errorMessage: string): Promise<void> {
    await this.db.prepare(`
      UPDATE scheduled_emails 
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `).bind(errorMessage, scheduledEmailId).run();

    log('error', 'Email marked as failed', {
      scheduledEmailId,
      errorMessage
    });
  }

  /**
   * Unsubscribe user from sequence
   */
  async unsubscribeUser(email: string): Promise<void> {
    await this.db.prepare(`
      UPDATE email_sequence_subscribers 
      SET is_active = 0, updated_at = ?
      WHERE email = ?
    `).bind(new Date().toISOString(), email).run();

    // Cancel pending emails
    await this.db.prepare(`
      UPDATE scheduled_emails 
      SET status = 'cancelled'
      WHERE subscriber_id IN (
        SELECT id FROM email_sequence_subscribers WHERE email = ?
      ) AND status = 'pending'
    `).bind(email).run();

    log('info', 'User unsubscribed from email sequence', { email });
  }

  /**
   * Get sequence statistics
   */
  async getSequenceStats(): Promise<any> {
    const totalSubscribers = await this.db.prepare(`
      SELECT COUNT(*) as count FROM email_sequence_subscribers WHERE is_active = 1
    `).first() as any;

    const emailsSent = await this.db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_emails WHERE status = 'sent'
    `).first() as any;

    const pendingEmails = await this.db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_emails WHERE status = 'pending'
    `).first() as any;

    const stepDistribution = await this.db.prepare(`
      SELECT current_sequence_step, COUNT(*) as count 
      FROM email_sequence_subscribers 
      WHERE is_active = 1 
      GROUP BY current_sequence_step
      ORDER BY current_sequence_step
    `).all();

    return {
      totalActiveSubscribers: totalSubscribers.count,
      totalEmailsSent: emailsSent.count,
      pendingEmails: pendingEmails.count,
      stepDistribution: stepDistribution.results
    };
  }
}
