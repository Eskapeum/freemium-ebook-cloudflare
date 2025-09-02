// Authentication Worker - Main entry point

import { Env } from '../../shared/types';
import { handleOptions, addCorsHeaders, log, getRequestId } from '../../shared/utils';
import { handleMagicLinkLogin } from './handlers/login';
import { handleVerifyToken } from './handlers/verify';
import { handleRefreshToken } from './handlers/refresh';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    log('info', 'Auth worker request', { 
      method, 
      path, 
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP')
    }, requestId);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      let response: Response;

      // Route to appropriate handler
      switch (true) {
        case path === '/auth/magic-link' && method === 'POST':
          response = await handleMagicLinkLogin(request, env);
          break;
        
        case path === '/auth/verify' && method === 'POST':
          response = await handleVerifyToken(request, env);
          break;
        
        case path === '/auth/refresh' && method === 'POST':
          response = await handleRefreshToken(request, env);
          break;
        
        case path === '/auth/health' && method === 'GET':
          response = new Response(JSON.stringify({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            worker: 'auth-worker'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
          break;
        
        default:
          log('warn', 'Auth worker route not found', { method, path }, requestId);
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers
      response = addCorsHeaders(response);
      
      log('info', 'Auth worker response', { 
        status: response.status,
        method,
        path
      }, requestId);

      return response;

    } catch (error) {
      log('error', 'Auth worker error', { 
        error: error.message,
        stack: error.stack,
        method,
        path
      }, requestId);
      
      const errorResponse = new Response(
        JSON.stringify({ error: 'Internal server error' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      return addCorsHeaders(errorResponse);
    }
  },
};

// Authentication middleware for other workers
export async function authenticateRequest(request: Request, env: Env): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No valid authorization header');
  }

  const token = authHeader.substring(7);
  
  // Try to get from cache first
  try {
    const cached = await env.SESSIONS_KV.get(`session:${token}`, 'json');
    if (cached) {
      return cached;
    }
  } catch (kvError) {
    log('warn', 'Failed to get session from cache', { error: kvError.message });
  }

  // Verify JWT if not in cache
  const { verifyJWT } = await import('./jwt');
  
  try {
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    // Check if token is expired
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}
