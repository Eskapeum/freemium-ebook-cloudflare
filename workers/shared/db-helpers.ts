// Database helper functions for Cloudflare D1

import { 
  EmailSubscriber, 
  ReadingProgress, 
  UserSession, 
  ContentAccessLog,
  Env 
} from './types';
import { generateUUID, withRetry } from './utils';

// Email Subscriber operations
export class EmailSubscriberDB {
  constructor(private env: Env) {}

  async findByEmail(email: string): Promise<EmailSubscriber | null> {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        'SELECT * FROM email_subscribers WHERE email = ?'
      ).bind(email).first();
      
      return result as EmailSubscriber | null;
    });
  }

  async create(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    discountCode?: string;
  }): Promise<EmailSubscriber> {
    return withRetry(async () => {
      const id = generateUUID();
      const now = new Date().toISOString();
      
      await this.env.DB.prepare(`
        INSERT INTO email_subscribers 
        (id, email, first_name, last_name, discount_code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.email,
        data.firstName || null,
        data.lastName || null,
        data.discountCode || null,
        now,
        now
      ).run();

      return this.findByEmail(data.email) as Promise<EmailSubscriber>;
    });
  }

  async updateEmailsSent(email: string): Promise<void> {
    return withRetry(async () => {
      const now = new Date().toISOString();
      
      await this.env.DB.prepare(`
        UPDATE email_subscribers 
        SET emails_sent = emails_sent + 1, 
            last_email_sent = ?,
            updated_at = ?
        WHERE email = ?
      `).bind(now, now, email).run();
    });
  }

  async updateAccess(email: string, hasAccess: boolean, hasPurchased?: boolean): Promise<void> {
    return withRetry(async () => {
      const now = new Date().toISOString();

      if (hasPurchased !== undefined) {
        await this.env.DB.prepare(`
          UPDATE email_subscribers
          SET has_access = ?, has_purchased = ?, updated_at = ?
          WHERE email = ?
        `).bind(hasAccess ? 1 : 0, hasPurchased ? 1 : 0, now, email).run();
      } else {
        await this.env.DB.prepare(`
          UPDATE email_subscribers
          SET has_access = ?, updated_at = ?
          WHERE email = ?
        `).bind(hasAccess ? 1 : 0, now, email).run();
      }
    });
  }

  async createWithUnlockCode(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    unlockCode: string;
    expiresAt: Date;
  }): Promise<EmailSubscriber> {
    return withRetry(async () => {
      const id = generateUUID();
      const now = new Date().toISOString();

      await this.env.DB.prepare(`
        INSERT INTO email_subscribers
        (id, email, first_name, last_name, unlock_code, unlock_code_expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.email,
        data.firstName || null,
        data.lastName || null,
        data.unlockCode,
        data.expiresAt.toISOString(),
        now,
        now
      ).run();

      return this.findByEmail(data.email) as Promise<EmailSubscriber>;
    });
  }

  async updateUnlockCode(
    email: string,
    unlockCode: string,
    expiresAt: Date,
    firstName?: string,
    lastName?: string
  ): Promise<void> {
    return withRetry(async () => {
      const now = new Date().toISOString();

      await this.env.DB.prepare(`
        UPDATE email_subscribers
        SET unlock_code = ?,
            unlock_code_expires_at = ?,
            first_name = COALESCE(?, first_name),
            last_name = COALESCE(?, last_name),
            updated_at = ?
        WHERE email = ?
      `).bind(
        unlockCode,
        expiresAt.toISOString(),
        firstName || null,
        lastName || null,
        now,
        email
      ).run();
    });
  }

  async grantAccess(email: string): Promise<void> {
    return withRetry(async () => {
      const now = new Date().toISOString();

      await this.env.DB.prepare(`
        UPDATE email_subscribers
        SET has_access = 1,
            unlock_code = NULL,
            unlock_code_expires_at = NULL,
            access_granted_at = ?,
            updated_at = ?
        WHERE email = ?
      `).bind(now, now, email).run();
    });
  }
}

// Reading Progress operations
export class ReadingProgressDB {
  constructor(private env: Env) {}

  async findByEmail(email: string): Promise<ReadingProgress[]> {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        'SELECT * FROM reading_progress WHERE email = ? ORDER BY chapter_number'
      ).bind(email).all();
      
      return result.results as ReadingProgress[];
    });
  }

  async findByEmailAndChapter(email: string, chapterNumber: number): Promise<ReadingProgress | null> {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        'SELECT * FROM reading_progress WHERE email = ? AND chapter_number = ?'
      ).bind(email, chapterNumber).first();
      
      return result as ReadingProgress | null;
    });
  }

  async upsert(data: {
    email: string;
    chapterNumber: number;
    completed?: boolean;
    timeSpent?: number;
    videosWatched?: string[];
    quizzesPassed?: string[];
  }): Promise<ReadingProgress> {
    return withRetry(async () => {
      const id = generateUUID();
      const now = new Date().toISOString();
      
      // Convert arrays to JSON strings
      const videosWatchedJson = JSON.stringify(data.videosWatched || []);
      const quizzesPassedJson = JSON.stringify(data.quizzesPassed || []);
      
      await this.env.DB.prepare(`
        INSERT INTO reading_progress 
        (id, email, chapter_number, completed, time_spent, videos_watched, quizzes_passed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email, chapter_number) DO UPDATE SET
          completed = excluded.completed,
          time_spent = excluded.time_spent,
          videos_watched = excluded.videos_watched,
          quizzes_passed = excluded.quizzes_passed,
          updated_at = excluded.updated_at
      `).bind(
        id,
        data.email,
        data.chapterNumber,
        data.completed ? 1 : 0,
        data.timeSpent || 0,
        videosWatchedJson,
        quizzesPassedJson,
        now,
        now
      ).run();

      return this.findByEmailAndChapter(data.email, data.chapterNumber) as Promise<ReadingProgress>;
    });
  }

  async getCompletionStats(email: string): Promise<{
    totalChapters: number;
    completedChapters: number;
    totalTimeSpent: number;
  }> {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_chapters,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_chapters,
          SUM(time_spent) as total_time_spent
        FROM reading_progress 
        WHERE email = ?
      `).bind(email).first();
      
      return {
        totalChapters: result?.total_chapters || 0,
        completedChapters: result?.completed_chapters || 0,
        totalTimeSpent: result?.total_time_spent || 0
      };
    });
  }
}

// User Session operations
export class UserSessionDB {
  constructor(private env: Env) {}

  async create(userEmail: string, sessionToken: string, expiresAt: Date): Promise<UserSession> {
    return withRetry(async () => {
      const id = generateUUID();
      const now = new Date().toISOString();
      
      await this.env.DB.prepare(`
        INSERT INTO user_sessions 
        (id, user_email, session_token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(
        id,
        userEmail,
        sessionToken,
        expiresAt.toISOString(),
        now
      ).run();

      return {
        id,
        user_email: userEmail,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: now
      };
    });
  }

  async findByToken(sessionToken: string): Promise<UserSession | null> {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(
        'SELECT * FROM user_sessions WHERE session_token = ? AND expires_at > ?'
      ).bind(sessionToken, new Date().toISOString()).first();
      
      return result as UserSession | null;
    });
  }

  async deleteByToken(sessionToken: string): Promise<void> {
    return withRetry(async () => {
      await this.env.DB.prepare(
        'DELETE FROM user_sessions WHERE session_token = ?'
      ).bind(sessionToken).run();
    });
  }

  async deleteExpired(): Promise<void> {
    return withRetry(async () => {
      await this.env.DB.prepare(
        'DELETE FROM user_sessions WHERE expires_at <= ?'
      ).bind(new Date().toISOString()).run();
    });
  }
}

// Content Access Log operations
export class ContentAccessLogDB {
  constructor(private env: Env) {}

  async log(data: {
    email: string;
    chapterNumber?: number;
    accessType: 'view' | 'download' | 'share';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    return withRetry(async () => {
      const id = generateUUID();
      const now = new Date().toISOString();
      
      await this.env.DB.prepare(`
        INSERT INTO content_access_logs 
        (id, email, chapter_number, access_type, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        data.email,
        data.chapterNumber || null,
        data.accessType,
        data.ipAddress || null,
        data.userAgent || null,
        now
      ).run();
    });
  }

  async getAccessStats(email: string): Promise<{
    totalViews: number;
    totalDownloads: number;
    totalShares: number;
    lastAccess: string | null;
  }> {
    return withRetry(async () => {
      const result = await this.env.DB.prepare(`
        SELECT 
          SUM(CASE WHEN access_type = 'view' THEN 1 ELSE 0 END) as total_views,
          SUM(CASE WHEN access_type = 'download' THEN 1 ELSE 0 END) as total_downloads,
          SUM(CASE WHEN access_type = 'share' THEN 1 ELSE 0 END) as total_shares,
          MAX(created_at) as last_access
        FROM content_access_logs 
        WHERE email = ?
      `).bind(email).first();
      
      return {
        totalViews: result?.total_views || 0,
        totalDownloads: result?.total_downloads || 0,
        totalShares: result?.total_shares || 0,
        lastAccess: result?.last_access || null
      };
    });
  }
}
