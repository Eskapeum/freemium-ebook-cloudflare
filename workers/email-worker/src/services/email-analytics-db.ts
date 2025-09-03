// Email Analytics Database Service
// Stores and retrieves email delivery and engagement analytics

import { Env } from '../../../shared/types';
import { log } from '../../../shared/utils';

export interface EmailSentRecord {
  emailId: string;
  recipient: string;
  subject: string;
  emailType: string;
  source: string;
  sentAt: Date;
}

export interface EmailDeliveredRecord {
  emailId: string;
  deliveredAt: Date;
}

export interface EmailOpenedRecord {
  emailId: string;
  openedAt: Date;
}

export interface EmailClickedRecord {
  emailId: string;
  clickedAt: Date;
  link: string;
}

export interface EmailBouncedRecord {
  emailId: string;
  bounceType: 'hard' | 'soft';
  reason: string;
  bouncedAt: Date;
}

export interface EmailComplainedRecord {
  emailId: string;
  complainedAt: Date;
}

export interface EmailDelayedRecord {
  emailId: string;
  delayedAt: Date;
}

export interface EmailAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  complaintRate: number;
}

export class EmailAnalyticsDB {
  private db: D1Database;

  constructor(env: Env) {
    this.db = env.DB;
  }

  /**
   * Initialize analytics tables
   */
  async initializeTables(): Promise<void> {
    const createEmailEventsTable = `
      CREATE TABLE IF NOT EXISTS email_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        recipient TEXT,
        subject TEXT,
        email_type TEXT,
        source TEXT,
        event_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_email_id ON email_events(email_id)',
      'CREATE INDEX IF NOT EXISTS idx_event_type ON email_events(event_type)',
      'CREATE INDEX IF NOT EXISTS idx_recipient ON email_events(recipient)',
      'CREATE INDEX IF NOT EXISTS idx_email_type ON email_events(email_type)',
      'CREATE INDEX IF NOT EXISTS idx_created_at ON email_events(created_at)'
    ];

    await this.db.prepare(createEmailEventsTable).run();

    // Create indexes
    for (const indexQuery of createIndexes) {
      await this.db.prepare(indexQuery).run();
    }
  }

  /**
   * Record email sent event
   */
  async recordEmailSent(data: EmailSentRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (
        email_id, event_type, recipient, subject, email_type, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'sent',
      data.recipient,
      data.subject,
      data.emailType,
      data.source,
      data.sentAt.toISOString()
    ).run();

    log('info', 'Email sent event recorded', {
      emailId: data.emailId,
      recipient: data.recipient,
      emailType: data.emailType
    });
  }

  /**
   * Record email delivered event
   */
  async recordEmailDelivered(data: EmailDeliveredRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (email_id, event_type, created_at)
      VALUES (?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'delivered',
      data.deliveredAt.toISOString()
    ).run();

    log('info', 'Email delivered event recorded', {
      emailId: data.emailId
    });
  }

  /**
   * Record email opened event
   */
  async recordEmailOpened(data: EmailOpenedRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (email_id, event_type, created_at)
      VALUES (?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'opened',
      data.openedAt.toISOString()
    ).run();

    log('info', 'Email opened event recorded', {
      emailId: data.emailId
    });
  }

  /**
   * Record email clicked event
   */
  async recordEmailClicked(data: EmailClickedRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (email_id, event_type, event_data, created_at)
      VALUES (?, ?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'clicked',
      JSON.stringify({ link: data.link }),
      data.clickedAt.toISOString()
    ).run();

    log('info', 'Email clicked event recorded', {
      emailId: data.emailId,
      link: data.link
    });
  }

  /**
   * Record email bounced event
   */
  async recordEmailBounced(data: EmailBouncedRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (email_id, event_type, event_data, created_at)
      VALUES (?, ?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'bounced',
      JSON.stringify({ 
        bounceType: data.bounceType, 
        reason: data.reason 
      }),
      data.bouncedAt.toISOString()
    ).run();

    log('info', 'Email bounced event recorded', {
      emailId: data.emailId,
      bounceType: data.bounceType
    });
  }

  /**
   * Record email complained event
   */
  async recordEmailComplained(data: EmailComplainedRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (email_id, event_type, created_at)
      VALUES (?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'complained',
      data.complainedAt.toISOString()
    ).run();

    log('info', 'Email complained event recorded', {
      emailId: data.emailId
    });
  }

  /**
   * Record email delayed event
   */
  async recordEmailDelayed(data: EmailDelayedRecord): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO email_events (email_id, event_type, created_at)
      VALUES (?, ?, ?)
    `);

    await stmt.bind(
      data.emailId,
      'delayed',
      data.delayedAt.toISOString()
    ).run();

    log('info', 'Email delayed event recorded', {
      emailId: data.emailId
    });
  }

  /**
   * Get email analytics for a date range
   */
  async getEmailAnalytics(
    startDate?: Date,
    endDate?: Date,
    emailType?: string
  ): Promise<EmailAnalytics> {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }

    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }

    if (emailType) {
      whereClause += ' AND email_type = ?';
      params.push(emailType);
    }

    const query = `
      SELECT 
        event_type,
        COUNT(*) as count
      FROM email_events 
      ${whereClause}
      GROUP BY event_type
    `;

    const result = await this.db.prepare(query).bind(...params).all();
    
    const counts = result.results.reduce((acc: any, row: any) => {
      acc[row.event_type] = row.count;
      return acc;
    }, {});

    const totalSent = counts.sent || 0;
    const totalDelivered = counts.delivered || 0;
    const totalOpened = counts.opened || 0;
    const totalClicked = counts.clicked || 0;
    const totalBounced = counts.bounced || 0;
    const totalComplaints = counts.complained || 0;

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalComplaints,
      deliveryRate: totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0,
      openRate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      clickRate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
      bounceRate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      complaintRate: totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0,
    };
  }
}
