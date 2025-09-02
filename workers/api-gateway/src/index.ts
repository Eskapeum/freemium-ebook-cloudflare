// API Gateway Worker - Main entry point and router

import { Env } from '../../shared/types';
import { handleOptions, addCorsHeaders, log, getRequestId } from '../../shared/utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    log('info', 'API Gateway request', { 
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

      // Route to appropriate worker
      switch (true) {
        // Authentication routes
        case path.startsWith('/api/auth'):
          response = await routeToAuthWorker(request, env);
          break;
        
        // Email routes
        case path.startsWith('/api/email'):
          response = await routeToEmailWorker(request, env);
          break;
        
        // Progress routes
        case path.startsWith('/api/progress'):
          response = await routeToProgressWorker(request, env);
          break;
        
        // Health check
        case path === '/api/health' && method === 'GET':
          response = await handleHealthCheck(env);
          break;
        
        // API documentation
        case path === '/api/docs' && method === 'GET':
          response = handleApiDocs();
          break;
        
        default:
          log('warn', 'API Gateway route not found', { method, path }, requestId);
          response = new Response(JSON.stringify({
            error: 'Not Found',
            message: 'The requested endpoint does not exist',
            availableEndpoints: [
              'POST /api/auth/magic-link',
              'POST /api/auth/verify',
              'POST /api/auth/refresh',
              'POST /api/email/signup',
              'POST /api/progress',
              'GET /api/progress',
              'GET /api/progress/analytics',
              'GET /api/health',
              'GET /api/docs'
            ]
          }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
      }

      // Add CORS headers
      response = addCorsHeaders(response);
      
      // Add common headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Powered-By', 'Cloudflare Workers');
      
      log('info', 'API Gateway response', { 
        status: response.status,
        method,
        path
      }, requestId);

      return response;

    } catch (error) {
      log('error', 'API Gateway error', { 
        error: error.message,
        stack: error.stack,
        method,
        path
      }, requestId);
      
      const errorResponse = new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          requestId 
        }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      return addCorsHeaders(errorResponse);
    }
  },
};

async function routeToAuthWorker(request: Request, env: Env): Promise<Response> {
  // Remove /api prefix for the auth worker
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/api', '');
  
  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  return await env.AUTH_WORKER.fetch(modifiedRequest);
}

async function routeToEmailWorker(request: Request, env: Env): Promise<Response> {
  // Remove /api prefix for the email worker
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/api', '');
  
  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  return await env.EMAIL_WORKER.fetch(modifiedRequest);
}

async function routeToProgressWorker(request: Request, env: Env): Promise<Response> {
  // Remove /api prefix for the progress worker
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/api', '');
  
  const modifiedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  return await env.PROGRESS_WORKER.fetch(modifiedRequest);
}

async function handleHealthCheck(env: Env): Promise<Response> {
  const healthChecks = {
    gateway: { status: 'healthy' },
    auth: { status: 'unknown' },
    email: { status: 'unknown' },
    progress: { status: 'unknown' },
    database: { status: 'unknown' }
  };

  // Check auth worker
  try {
    const authResponse = await env.AUTH_WORKER.fetch(new Request('http://localhost/auth/health'));
    healthChecks.auth.status = authResponse.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthChecks.auth.status = 'error';
  }

  // Check email worker
  try {
    const emailResponse = await env.EMAIL_WORKER.fetch(new Request('http://localhost/email/health'));
    healthChecks.email.status = emailResponse.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthChecks.email.status = 'error';
  }

  // Check progress worker
  try {
    const progressResponse = await env.PROGRESS_WORKER.fetch(new Request('http://localhost/progress/health'));
    healthChecks.progress.status = progressResponse.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthChecks.progress.status = 'error';
  }

  // Check database
  try {
    await env.DB.prepare('SELECT 1').first();
    healthChecks.database.status = 'healthy';
  } catch (error) {
    healthChecks.database.status = 'error';
  }

  const overallStatus = Object.values(healthChecks).every(check => check.status === 'healthy') 
    ? 'healthy' 
    : 'degraded';

  return new Response(JSON.stringify({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks: healthChecks,
    version: '1.0.0'
  }), {
    status: overallStatus === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

function handleApiDocs(): Response {
  const docs = {
    title: 'Content Creator Handbook API',
    version: '1.0.0',
    description: 'API for the Content Creator Handbook platform',
    endpoints: {
      authentication: {
        'POST /api/auth/magic-link': {
          description: 'Request a magic link for passwordless login',
          body: { email: 'string' },
          response: { success: 'boolean', message: 'string' }
        },
        'POST /api/auth/verify': {
          description: 'Verify magic link token and get session token',
          body: { token: 'string' },
          response: { success: 'boolean', token: 'string', user: 'object' }
        },
        'POST /api/auth/refresh': {
          description: 'Refresh session token',
          headers: { Authorization: 'Bearer <token>' },
          response: { success: 'boolean', token: 'string', user: 'object' }
        }
      },
      email: {
        'POST /api/email/signup': {
          description: 'Sign up for email list and get free access',
          body: { email: 'string', firstName: 'string?', lastName: 'string?' },
          response: { success: 'boolean', message: 'string', discountCode: 'string' }
        }
      },
      progress: {
        'POST /api/progress': {
          description: 'Update reading progress',
          body: { 
            email: 'string', 
            chapterNumber: 'number', 
            completed: 'boolean?', 
            timeSpent: 'number?',
            videosWatched: 'string[]?',
            quizzesPassed: 'string[]?'
          },
          response: { success: 'boolean', progress: 'object[]' }
        },
        'GET /api/progress?email=<email>': {
          description: 'Get reading progress for user',
          response: { success: 'boolean', progress: 'object[]' }
        },
        'GET /api/progress/analytics?email=<email>': {
          description: 'Get detailed analytics for user',
          response: { completion: 'object', engagement: 'object', progress: 'object[]' }
        }
      },
      system: {
        'GET /api/health': {
          description: 'System health check',
          response: { status: 'string', checks: 'object' }
        },
        'GET /api/docs': {
          description: 'API documentation',
          response: 'This documentation'
        }
      }
    }
  };

  return new Response(JSON.stringify(docs, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
