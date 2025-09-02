// Progress Worker - Main entry point

import { Env } from '../../shared/types';
import { handleOptions, addCorsHeaders, log, getRequestId } from '../../shared/utils';
import { handleProgressUpdate } from './handlers/update';
import { handleGetProgress } from './handlers/get';
import { handleProgressAnalytics } from './handlers/analytics';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    log('info', 'Progress worker request', { 
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
        case path === '/progress' && method === 'POST':
          response = await handleProgressUpdate(request, env);
          break;
        
        case path === '/progress' && method === 'GET':
          response = await handleGetProgress(request, env);
          break;
        
        case path === '/progress/analytics' && method === 'GET':
          response = await handleProgressAnalytics(request, env);
          break;
        
        case path === '/progress/health' && method === 'GET':
          response = new Response(JSON.stringify({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            worker: 'progress-worker'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
          break;
        
        default:
          log('warn', 'Progress worker route not found', { method, path }, requestId);
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers
      response = addCorsHeaders(response);
      
      log('info', 'Progress worker response', { 
        status: response.status,
        method,
        path
      }, requestId);

      return response;

    } catch (error) {
      log('error', 'Progress worker error', { 
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
