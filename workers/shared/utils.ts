// Shared utility functions for Cloudflare Workers

import { LogEntry, ErrorResponse, Env } from './types';

// Generate UUID v4
export function generateUUID(): string {
  return crypto.randomUUID();
}

// Structured logging
export function log(
  level: LogEntry['level'], 
  message: string, 
  context?: any, 
  requestId?: string
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    requestId
  };
  
  console.log(JSON.stringify(entry));
}

// Error response helper
export function createErrorResponse(
  error: string, 
  status: number = 500, 
  code?: string, 
  details?: any
): Response {
  const errorResponse: ErrorResponse = {
    error,
    code,
    details
  };
  
  return Response.json(errorResponse, { status });
}

// Success response helper
export function createSuccessResponse(data: any, status: number = 200): Response {
  return Response.json(data, { status });
}

// CORS headers
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Add CORS headers to response
export function addCorsHeaders(response: Response): Response {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Handle OPTIONS request
export function handleOptions(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize input
export function sanitizeString(input: string): string {
  return input.trim().toLowerCase();
}

// Generate discount code
export function generateDiscountCode(): string {
  return `CREATOR10-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
}

// Generate 6-digit unlock code
export function generateUnlockCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Retry logic for operations
export async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3,
  delay: number = 100
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
}

// Extract request ID from headers
export function getRequestId(request: Request): string {
  return request.headers.get('cf-ray') || generateUUID();
}

// Get client IP
export function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

// Get user agent
export function getUserAgent(request: Request): string {
  return request.headers.get('User-Agent') || 'unknown';
}

// Validate required fields
export function validateRequired(data: any, fields: string[]): void {
  for (const field of fields) {
    if (!data[field]) {
      throw new Error(`${field} is required`);
    }
  }
}

// Parse JSON safely
export async function parseJSON(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

// Track analytics event
export async function trackEvent(
  event: string, 
  properties: any, 
  env: Env,
  email?: string
): Promise<void> {
  try {
    const analyticsData = {
      event,
      properties,
      timestamp: Date.now(),
      email,
      ...properties
    };
    
    // Store in KV for batch processing
    await env.ANALYTICS_KV.put(
      `event:${Date.now()}:${generateUUID()}`,
      JSON.stringify(analyticsData),
      { expirationTtl: 86400 } // 24 hours
    );
  } catch (error) {
    log('error', 'Failed to track analytics event', { error: error.message, event });
  }
}

// Performance tracker
export class PerformanceTracker {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }
  
  mark(label: string): number {
    const duration = Date.now() - this.startTime;
    log('info', `Performance: ${label} took ${duration}ms`);
    return duration;
  }
}

// Rate limiting helper
export async function checkRateLimit(
  key: string, 
  limit: number, 
  window: number, 
  env: Env
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - window * 1000;
  
  // Get current count
  const current = await env.CACHE_KV.get(`rate_limit:${key}`, 'json') as { count: number, timestamp: number } | null;
  
  if (!current || current.timestamp < windowStart) {
    // Reset or initialize
    await env.CACHE_KV.put(
      `rate_limit:${key}`, 
      JSON.stringify({ count: 1, timestamp: now }),
      { expirationTtl: window }
    );
    return true;
  }
  
  if (current.count >= limit) {
    return false;
  }
  
  // Increment count
  await env.CACHE_KV.put(
    `rate_limit:${key}`, 
    JSON.stringify({ count: current.count + 1, timestamp: current.timestamp }),
    { expirationTtl: window }
  );
  
  return true;
}
