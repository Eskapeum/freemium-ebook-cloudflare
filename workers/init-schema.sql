-- Initialize database schema with IF NOT EXISTS to avoid conflicts
-- This can be run multiple times safely

-- Email Subscribers Table
CREATE TABLE IF NOT EXISTS email_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  has_access BOOLEAN DEFAULT 1,
  has_purchased BOOLEAN DEFAULT 0,
  discount_code TEXT,
  emails_sent INTEGER DEFAULT 0,
  last_email_sent DATETIME
);

-- Reading Progress Table
CREATE TABLE IF NOT EXISTS reading_progress (
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
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content Access Logs
CREATE TABLE IF NOT EXISTS content_access_logs (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  chapter_number INTEGER,
  access_type TEXT, -- 'view', 'download', 'share'
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance (IF NOT EXISTS is implicit for indexes)
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_reading_progress_email ON reading_progress(email);
CREATE INDEX IF NOT EXISTS idx_reading_progress_chapter ON reading_progress(chapter_number);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_content_access_email ON content_access_logs(email);
CREATE INDEX IF NOT EXISTS idx_content_access_chapter ON content_access_logs(chapter_number);
