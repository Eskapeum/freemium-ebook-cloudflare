# Cloudflare Workers Backend Implementation Guide
## Content Creator's Handbook Project

**Version:** 1.0  
**Date:** August 31, 2025  
**Team:** Development Team  
**Project:** The Complete Content Creator's Handbook

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Database Migration Plan](#database-migration-plan)
5. [Worker Structure](#worker-structure)
6. [Authentication Implementation](#authentication-implementation)
7. [Development Workflow](#development-workflow)
8. [Best Practices](#best-practices)
9. [Sequential Implementation Plan](#sequential-implementation-plan)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)
12. [Monitoring & Debugging](#monitoring--debugging)

---

## 🎯 Project Overview

### Current State
- **Frontend:** Next.js 15.3.0 with TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Current Backend:** Next.js API routes
- **Hosting:** Planning to migrate to Cloudflare ecosystem

### Target State
- **Frontend:** Next.js static export on Cloudflare Pages
- **Backend:** Cloudflare Workers (serverless)
- **Database:** Cloudflare D1 (SQLite)
- **Cache:** Cloudflare KV
- **Queues:** Cloudflare Queues for email processing
- **Authentication:** JWT with Web Crypto API

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Static)                        │
│              Cloudflare Pages                              │
│           (Next.js Static Export)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 API Gateway Worker                          │
│              (Route Management)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Business Logic Workers                      │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│   │   Auth      │ │   Email     │ │  Progress   │          │
│   │  Worker     │ │  Worker     │ │   Worker    │          │
│   └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│   │ Cloudflare  │ │ Cloudflare  │ │ Cloudflare  │          │
│   │     D1      │ │     KV      │ │   Queues    │          │
│   │ (Database)  │ │  (Cache)    │ │ (Email Jobs)│          │
│   └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Core Technologies
- **Runtime:** Cloudflare Workers (V8 JavaScript engine)
- **Database:** Cloudflare D1 (SQLite-compatible)
- **Cache:** Cloudflare KV (Key-Value store)
- **Queues:** Cloudflare Queues
- **Authentication:** JWT with Web Crypto API
- **Email:** SendGrid API (via Queues)

### Development Tools
- **CLI:** Wrangler 3.x
- **Language:** TypeScript
- **Testing:** Vitest with Cloudflare Workers testing framework
- **Deployment:** GitHub Actions + Wrangler

---

## 🗄️ Database Migration Plan

### Phase 1: Schema Migration (PostgreSQL → D1)

#### Current Prisma Schema
```prisma
model EmailSubscriber {
  id            String   @id @default(cuid())
  email         String   @unique
  firstName     String?
  lastName      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  hasAccess     Boolean  @default(true)
  hasPurchased  Boolean  @default(false)
  discountCode  String?
  emailsSent    Int      @default(0)
  lastEmailSent DateTime?
}

model ReadingProgress {
  id                String   @id @default(cuid())
  email             String   
  chapterNumber     Int
  completed         Boolean  @default(false)
  timeSpent         Int      @default(0)
  videosWatched     String[] @default([])
  quizzesPassed     String[] @default([])
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([email, chapterNumber])
}
```

#### Target D1 Schema
```sql
-- Email Subscribers Table
CREATE TABLE email_subscribers (
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
```

### Migration Commands
```bash
# Create D1 database
wrangler d1 create handbook-db

# Apply schema
wrangler d1 execute handbook-db --file=./schema.sql

# Export data from PostgreSQL
pg_dump --data-only --table=email_subscribers handbook_db > subscribers.sql
pg_dump --data-only --table=reading_progress handbook_db > progress.sql

# Import to D1 (after format conversion)
wrangler d1 execute handbook-db --file=./subscribers_d1.sql
wrangler d1 execute handbook-db --file=./progress_d1.sql
```

---

## ⚙️ Worker Structure

### File Organization
```
workers/
├── api-gateway/
│   ├── src/
│   │   ├── index.ts
│   │   └── router.ts
│   ├── wrangler.toml
│   └── package.json
├── auth-worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── jwt.ts
│   │   └── handlers/
│   │       ├── login.ts
│   │       ├── verify.ts
│   │       └── refresh.ts
│   ├── wrangler.toml
│   └── package.json
├── email-worker/
│   ├── src/
│   │   ├── index.ts
│   │   └── handlers/
│   │       ├── signup.ts
│   │       ├── send-chapters.ts
│   │       └── queue-consumer.ts
│   ├── wrangler.toml
│   └── package.json
├── progress-worker/
│   ├── src/
│   │   ├── index.ts
│   │   └── handlers/
│   │       ├── update.ts
│   │       ├── get.ts
│   │       └── analytics.ts
│   ├── wrangler.toml
│   └── package.json
└── shared/
    ├── types.ts
    ├── utils.ts
    └── db-helpers.ts
```

### API Gateway Worker
```typescript
// workers/api-gateway/src/index.ts
export interface Env {
  AUTH_WORKER: Fetcher;
  EMAIL_WORKER: Fetcher;
  PROGRESS_WORKER: Fetcher;
  CONTENT_WORKER: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      let response: Response;

      // Route to appropriate worker
      switch (true) {
        case path.startsWith('/api/auth'):
          response = await env.AUTH_WORKER.fetch(request);
          break;
        
        case path.startsWith('/api/email'):
          response = await env.EMAIL_WORKER.fetch(request);
          break;
        
        case path.startsWith('/api/progress'):
          response = await env.PROGRESS_WORKER.fetch(request);
          break;
        
        case path.startsWith('/api/content'):
          response = await env.CONTENT_WORKER.fetch(request);
          break;
        
        default:
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      console.error('API Gateway Error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: corsHeaders 
      });
    }
  },
};
```

---

## 🔐 Authentication Implementation

### JWT Utilities
```typescript
// workers/auth-worker/src/jwt.ts
export async function generateJWT(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
  
  const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<any> {
  const [header, payload, signature] = token.split('.');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = encoder.encode(`${header}.${payload}`);
  const signatureBuffer = Uint8Array.from(
    atob(signature.replace(/-/g, '+').replace(/_/g, '/')), 
    c => c.charCodeAt(0)
  );
  
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, data);
  
  if (isValid) {
    const decodedPayload = JSON.parse(atob(payload));
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    
    return decodedPayload;
  }
  
  throw new Error('Invalid token');
}
```

### Magic Link Authentication
```typescript
// workers/auth-worker/src/handlers/login.ts
export async function handleMagicLinkLogin(request: Request, env: Env): Promise<Response> {
  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    // Check if user exists
    const user = await env.DB.prepare(
      'SELECT * FROM email_subscribers WHERE email = ?'
    ).bind(email).first();

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Generate magic link token (15 minutes expiry)
    const token = await generateJWT(
      {
        email,
        type: 'magic_link',
        exp: Math.floor(Date.now() / 1000) + (15 * 60)
      },
      env.JWT_SECRET
    );

    // Queue magic link email
    await env.EMAIL_QUEUE.send({
      type: 'magic_link',
      email,
      firstName: user.first_name,
      token,
      loginUrl: `${env.FRONTEND_URL}/auth/verify?token=${token}`
    });

    return Response.json({
      success: true,
      message: "Magic link sent to your email"
    });

  } catch (error) {
    console.error('Magic link error:', error);
    return Response.json({ error: "Login failed" }, { status: 500 });
  }
}
```

---

## 🔄 Development Workflow

### Local Development Setup

1. **Install Dependencies**
```bash
npm install -g wrangler@latest
cd workers/api-gateway && npm install
cd ../auth-worker && npm install
cd ../email-worker && npm install
cd ../progress-worker && npm install
```

2. **Environment Setup**
```bash
# Copy environment template
cp .env.example .env.local

# Configure each worker's wrangler.toml
# Add database bindings, KV namespaces, etc.
```

3. **Local Development**
```bash
# Start local D1 database
wrangler d1 execute handbook-db --local --file=./schema.sql

# Start individual workers in development
cd workers/api-gateway && wrangler dev --local
cd workers/auth-worker && wrangler dev --local --port 8788
cd workers/email-worker && wrangler dev --local --port 8789
cd workers/progress-worker && wrangler dev --local --port 8790
```

### Git Workflow

1. **Branch Strategy**
```bash
main                    # Production
├── develop            # Integration branch
├── feature/auth       # Feature branches
├── feature/email      # Feature branches
└── hotfix/bug-fix     # Hotfix branches
```

2. **Commit Convention**
```bash
feat: add magic link authentication
fix: resolve JWT token expiration issue
docs: update API documentation
test: add unit tests for email worker
refactor: optimize database queries
```

---

## 📋 Best Practices

### Code Organization

1. **Separation of Concerns**
   - Each worker handles a specific domain
   - Shared utilities in `/shared` directory
   - Clear interfaces between workers

2. **Error Handling**
```typescript
// Consistent error response format
interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
}

// Error handling wrapper
async function handleRequest(handler: Function, request: Request, env: Env) {
  try {
    return await handler(request, env);
  } catch (error) {
    console.error('Request error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
```

3. **Input Validation**
```typescript
// Validation schemas
interface EmailSignupRequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

function validateEmailSignup(data: any): EmailSignupRequest {
  if (!data.email || typeof data.email !== 'string') {
    throw new Error('Valid email is required');
  }

  if (!data.email.includes('@')) {
    throw new Error('Invalid email format');
  }

  return {
    email: data.email.toLowerCase().trim(),
    firstName: data.firstName?.trim(),
    lastName: data.lastName?.trim()
  };
}
```

### Performance Optimization

1. **Database Queries**
```typescript
// Use prepared statements
const stmt = env.DB.prepare('SELECT * FROM users WHERE email = ?');
const user = await stmt.bind(email).first();

// Batch operations when possible
const batch = [
  env.DB.prepare('INSERT INTO logs (action) VALUES (?)').bind('login'),
  env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, userId)
];
await env.DB.batch(batch);
```

2. **Caching Strategy**
```typescript
// Cache frequently accessed data
async function getCachedUser(email: string, env: Env) {
  const cacheKey = `user:${email}`;

  // Try cache first
  const cached = await env.CACHE_KV.get(cacheKey, 'json');
  if (cached) return cached;

  // Fetch from database
  const user = await env.DB.prepare(
    'SELECT * FROM email_subscribers WHERE email = ?'
  ).bind(email).first();

  if (user) {
    // Cache for 5 minutes
    await env.CACHE_KV.put(cacheKey, JSON.stringify(user), {
      expirationTtl: 300
    });
  }

  return user;
}
```

3. **Request Optimization**
```typescript
// Minimize cold starts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Use ctx.waitUntil for non-blocking operations
    ctx.waitUntil(logAnalytics(request));

    return handleRequest(request, env);
  }
};
```

---

## 📝 Sequential Implementation Plan

### Week 1-2: Foundation Setup
- [ ] Set up Wrangler CLI and development environment
- [ ] Create D1 database and apply schema
- [ ] Implement basic API Gateway Worker
- [ ] Set up shared utilities and types
- [ ] Configure local development environment

### Week 3-4: Authentication System
- [ ] Implement JWT utilities with Web Crypto API
- [ ] Create Auth Worker with magic link authentication
- [ ] Add session management with KV storage
- [ ] Implement authentication middleware
- [ ] Add rate limiting for auth endpoints

### Week 5-6: Email System
- [ ] Create Email Worker for signup handling
- [ ] Implement Cloudflare Queues for email processing
- [ ] Set up SendGrid integration for email delivery
- [ ] Add email templates for magic links and welcome emails
- [ ] Implement email analytics and tracking

### Week 7-8: Progress Tracking
- [ ] Create Progress Worker for reading progress
- [ ] Implement progress analytics and reporting
- [ ] Add caching layer for frequently accessed data
- [ ] Create admin dashboard endpoints
- [ ] Add content access logging

### Week 9-10: Integration & Testing
- [ ] Integrate all workers through API Gateway
- [ ] Update frontend to use new API endpoints
- [ ] Implement comprehensive testing suite
- [ ] Performance optimization and monitoring
- [ ] Security audit and penetration testing

### Week 11-12: Deployment & Monitoring
- [ ] Set up production environment
- [ ] Configure CI/CD pipeline with GitHub Actions
- [ ] Deploy to production with gradual rollout
- [ ] Set up monitoring and alerting
- [ ] Documentation and team training

---

## 🧪 Testing Strategy

### Unit Testing
```typescript
// Example test for JWT utilities
import { generateJWT, verifyJWT } from '../src/jwt';

describe('JWT Utilities', () => {
  const secret = 'test-secret';

  test('should generate and verify valid JWT', async () => {
    const payload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) + 3600 };

    const token = await generateJWT(payload, secret);
    expect(token).toBeDefined();

    const decoded = await verifyJWT(token, secret);
    expect(decoded.email).toBe(payload.email);
  });

  test('should reject expired token', async () => {
    const payload = { email: 'test@example.com', exp: Math.floor(Date.now() / 1000) - 1 };

    const token = await generateJWT(payload, secret);

    await expect(verifyJWT(token, secret)).rejects.toThrow('Token expired');
  });
});
```

### Integration Testing
```typescript
// Example integration test
import { unstable_dev } from 'wrangler';

describe('Auth Worker Integration', () => {
  let worker: any;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  test('should handle magic link login', async () => {
    const response = await worker.fetch('/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' })
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

### Load Testing
```bash
# Use Artillery for load testing
npm install -g artillery

# Create load test configuration
cat > load-test.yml << EOF
config:
  target: 'https://api.yourhandbook.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Auth flow"
    requests:
      - post:
          url: "/api/auth/magic-link"
          json:
            email: "test@example.com"
EOF

# Run load test
artillery run load-test.yml
```

---

## 🚀 Deployment Guide

### Environment Configuration

1. **Production wrangler.toml**
```toml
name = "handbook-api-gateway"
main = "src/index.ts"
compatibility_date = "2024-08-31"

[env.production]
workers_dev = false
routes = [
  { pattern = "api.yourhandbook.com/*", zone_name = "yourhandbook.com" }
]

# D1 Database Binding
[[env.production.d1_databases]]
binding = "DB"
database_name = "handbook-db"
database_id = "your-d1-database-id"

# KV Cache Binding
[[env.production.kv_namespaces]]
binding = "CACHE_KV"
id = "your-kv-namespace-id"

# Queue Binding
[[env.production.queues]]
binding = "EMAIL_QUEUE"
queue = "email-processing"

# Service Bindings
[[env.production.services]]
binding = "AUTH_WORKER"
service = "auth-worker"

# Environment Variables
[env.production.vars]
FRONTEND_URL = "https://yourhandbook.com"
ENVIRONMENT = "production"

# Secrets (set via wrangler secret put)
# JWT_SECRET
# SENDGRID_API_KEY
```

2. **GitHub Actions Deployment**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: 'workers/api-gateway'
          command: deploy --env production
```

### Deployment Commands
```bash
# Deploy individual workers
cd workers/api-gateway && wrangler deploy --env production
cd workers/auth-worker && wrangler deploy --env production
cd workers/email-worker && wrangler deploy --env production
cd workers/progress-worker && wrangler deploy --env production

# Set secrets
wrangler secret put JWT_SECRET --env production
wrangler secret put SENDGRID_API_KEY --env production

# Deploy database migrations
wrangler d1 execute handbook-db --env production --file=./migrations/001_initial.sql
```

---

## 📊 Monitoring & Debugging

### Logging Strategy
```typescript
// Structured logging
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: any;
  requestId?: string;
}

function log(level: LogEntry['level'], message: string, context?: any, requestId?: string) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    requestId
  };

  console.log(JSON.stringify(entry));
}

// Usage
log('info', 'User login attempt', { email: 'user@example.com' }, requestId);
log('error', 'Database connection failed', { error: error.message }, requestId);
```

### Analytics and Metrics
```typescript
// Custom analytics
async function trackEvent(event: string, properties: any, env: Env) {
  const analyticsData = {
    event,
    properties,
    timestamp: Date.now(),
    ...properties
  };

  // Store in KV for batch processing
  await env.ANALYTICS_KV.put(
    `event:${Date.now()}:${crypto.randomUUID()}`,
    JSON.stringify(analyticsData),
    { expirationTtl: 86400 } // 24 hours
  );
}

// Usage
await trackEvent('user_login', { email, method: 'magic_link' }, env);
await trackEvent('chapter_completed', { email, chapter: 5 }, env);
```

### Error Monitoring
```typescript
// Error reporting
async function reportError(error: Error, context: any, env: Env) {
  const errorReport = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: context.request?.headers.get('User-Agent'),
    ip: context.request?.headers.get('CF-Connecting-IP')
  };

  // Send to external monitoring service
  await fetch('https://api.sentry.io/api/your-project/store/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENTRY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(errorReport)
  });
}
```

### Performance Monitoring
```typescript
// Performance tracking
class PerformanceTracker {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  mark(label: string) {
    const duration = Date.now() - this.startTime;
    console.log(`Performance: ${label} took ${duration}ms`);
    return duration;
  }
}

// Usage
const perf = new PerformanceTracker();
await databaseQuery();
perf.mark('Database query');
await externalApiCall();
perf.mark('External API call');
```

---

## 🔧 Troubleshooting Guide

### Common Issues

1. **Cold Start Performance**
```typescript
// Minimize cold starts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Pre-warm connections
    const dbPromise = env.DB.prepare('SELECT 1').first();

    // Handle request
    const response = await handleRequest(request, env);

    // Wait for background tasks
    ctx.waitUntil(dbPromise);

    return response;
  }
};
```

2. **Database Connection Issues**
```typescript
// Retry logic for database operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

3. **Memory Limits**
```typescript
// Optimize memory usage
function processLargeDataset(data: any[]) {
  // Process in chunks to avoid memory limits
  const chunkSize = 100;
  const results = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    results.push(...processChunk(chunk));
  }

  return results;
}
```

---

## 📚 Additional Resources

### Documentation Links
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Web Crypto API Reference](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

### Team Communication
- **Slack Channel:** #handbook-backend-dev
- **Daily Standups:** 9:00 AM EST
- **Sprint Planning:** Bi-weekly Mondays
- **Code Reviews:** Required for all PRs

### Support Contacts
- **Tech Lead:** [Your Name]
- **DevOps:** [DevOps Contact]
- **Product Owner:** Tobi Daniel Adelaja

---

**Last Updated:** August 31, 2025
**Next Review:** September 15, 2025

---

*This document is a living guide. Please update it as the implementation progresses and new best practices are discovered.*
```
