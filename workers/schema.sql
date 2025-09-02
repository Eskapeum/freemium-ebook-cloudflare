-- Cloudflare D1 Database Schema
-- Migration from PostgreSQL to SQLite

-- Email Subscribers Table (Updated for Freemium Model)
CREATE TABLE email_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  has_access BOOLEAN DEFAULT 0, -- Changed: Now requires unlock code for premium access
  has_purchased BOOLEAN DEFAULT 0, -- Legacy field for migration
  discount_code TEXT, -- Legacy 10% discount code
  unlock_code TEXT, -- 6-digit unlock code for premium access
  unlock_code_expires_at DATETIME, -- Expiry time for unlock code
  access_granted_at DATETIME, -- When premium access was granted
  emails_sent INTEGER DEFAULT 0,
  last_email_sent DATETIME
);

-- Reading Progress Table
CREATE TABLE reading_progress (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  completed BOOLEAN DEFAULT 0,
  time_spent INTEGER DEFAULT 0,
  videos_watched TEXT, -- JSON array as TEXT
  quizzes_passed TEXT, -- JSON array as TEXT
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email, chapter_number)
);

-- User Sessions (for authentication)
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content Access Logs
CREATE TABLE content_access_logs (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  chapter_number INTEGER,
  access_type TEXT, -- 'view', 'download', 'share'
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX idx_reading_progress_email ON reading_progress(email);
CREATE INDEX idx_reading_progress_chapter ON reading_progress(chapter_number);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_email ON user_sessions(user_email);
CREATE INDEX idx_content_access_email ON content_access_logs(email);
CREATE INDEX idx_content_access_chapter ON content_access_logs(chapter_number);
