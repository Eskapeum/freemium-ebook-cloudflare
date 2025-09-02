// Shared TypeScript types for Cloudflare Workers

export interface Env {
  // Database bindings
  DB: D1Database;
  
  // KV bindings
  CACHE_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  ANALYTICS_KV: KVNamespace;
  
  // Queue bindings
  EMAIL_QUEUE: Queue;
  
  // Service bindings
  AUTH_WORKER: Fetcher;
  EMAIL_WORKER: Fetcher;
  PROGRESS_WORKER: Fetcher;
  CONTENT_WORKER: Fetcher;
  
  // Environment variables
  JWT_SECRET: string;
  SENDGRID_API_KEY: string;
  FRONTEND_URL: string;
  ENVIRONMENT: string;
  SENTRY_TOKEN?: string;
}

// Database Models
export interface EmailSubscriber {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
  updated_at: string;
  has_access: boolean;
  has_purchased: boolean;
  discount_code?: string;
  unlock_code?: string;
  unlock_code_expires_at?: string;
  access_granted_at?: string;
  emails_sent: number;
  last_email_sent?: string;
}

export interface ReadingProgress {
  id: string;
  email: string;
  chapter_number: number;
  completed: boolean;
  time_spent: number;
  videos_watched: string; // JSON string
  quizzes_passed: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string;
  user_email: string;
  session_token: string;
  expires_at: string;
  created_at: string;
}

export interface ContentAccessLog {
  id: string;
  email: string;
  chapter_number?: number;
  access_type: 'view' | 'download' | 'share';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// API Request/Response Types
export interface EmailSignupRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface EmailSignupResponse {
  success: boolean;
  message: string;
  user?: Partial<EmailSubscriber>;
  discountCode?: string;
  hasAccess?: boolean;
}

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkResponse {
  success: boolean;
  message: string;
}

export interface VerifyTokenRequest {
  token: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    email: string;
    firstName?: string;
    hasAccess: boolean;
    hasPurchased: boolean;
  };
  error?: string;
}

export interface ProgressUpdateRequest {
  email: string;
  chapterNumber: number;
  completed?: boolean;
  timeSpent?: number;
  videosWatched?: string[];
  quizzesPassed?: string[];
}

export interface ProgressResponse {
  success: boolean;
  progress?: ReadingProgress[];
  error?: string;
}

// Queue Message Types
export interface EmailQueueMessage {
  type: 'welcome' | 'magic_link' | 'chapter_delivery' | 'reminder';
  email: string;
  firstName?: string;
  discountCode?: string;
  token?: string;
  loginUrl?: string;
  chapterNumber?: number;
}

// Error Response
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

// JWT Payload
export interface JWTPayload {
  email: string;
  userId?: string;
  type?: 'magic_link' | 'session';
  hasAccess?: boolean;
  hasPurchased?: boolean;
  exp: number;
  iat?: number;
}

// Analytics Event
export interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
  email?: string;
  sessionId?: string;
}

// Log Entry
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: any;
  requestId?: string;
}

// Unlock Code Request/Response Types
export interface UnlockCodeRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface UnlockCodeResponse {
  success: boolean;
  message: string;
  codeExpiry?: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
  user?: {
    email: string;
    first_name?: string;
    last_name?: string;
    has_access: boolean;
  };
}
