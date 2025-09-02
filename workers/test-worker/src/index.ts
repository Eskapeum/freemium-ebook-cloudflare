// Unified Test Worker - Combines all functionality for testing
// This demonstrates that all the individual workers work correctly

import { Env } from '../../shared/types';
import { handleOptions, addCorsHeaders, log, getRequestId } from '../../shared/utils';

// Import handlers from individual workers
import { handleEmailSignup } from '../../email-worker/src/handlers/signup';
import { handleMagicLinkLogin } from '../../auth-worker/src/handlers/login';
import { handleVerifyToken } from '../../auth-worker/src/handlers/verify';
import { handleProgressUpdate } from '../../progress-worker/src/handlers/update';
import { handleGetProgress } from '../../progress-worker/src/handlers/get';
import { handleProgressAnalytics } from '../../progress-worker/src/handlers/analytics';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    log('info', 'Test worker request', { 
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
        // Email routes
        case path === '/email/signup' && method === 'POST':
          response = await handleEmailSignup(request, env);
          break;
        
        // Auth routes
        case path === '/auth/magic-link' && method === 'POST':
          response = await handleMagicLinkLogin(request, env);
          break;
        
        case path === '/auth/verify' && method === 'POST':
          response = await handleVerifyToken(request, env);
          break;
        
        // Progress routes
        case path === '/progress' && method === 'POST':
          response = await handleProgressUpdate(request, env);
          break;
        
        case path === '/progress' && method === 'GET':
          response = await handleGetProgress(request, env);
          break;
        
        case path === '/progress/analytics' && method === 'GET':
          response = await handleProgressAnalytics(request, env);
          break;
        
        // Health check
        case path === '/health' && method === 'GET':
          response = await handleHealthCheck(env);
          break;
        
        // Test endpoints
        case path === '/test/full-journey' && method === 'POST':
          response = await handleFullJourneyTest(request, env);
          break;
        
        case path === '/test/database' && method === 'GET':
          response = await handleDatabaseTest(env);
          break;
        
        default:
          log('warn', 'Test worker route not found', { method, path }, requestId);
          response = new Response(JSON.stringify({
            error: 'Not Found',
            message: 'The requested endpoint does not exist',
            availableEndpoints: [
              'POST /email/signup',
              'POST /auth/magic-link',
              'POST /auth/verify',
              'POST /progress',
              'GET /progress',
              'GET /progress/analytics',
              'GET /health',
              'POST /test/full-journey',
              'GET /test/database'
            ]
          }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
      }

      // Add CORS headers
      response = addCorsHeaders(response);
      
      log('info', 'Test worker response', { 
        status: response.status,
        method,
        path
      }, requestId);

      return response;

    } catch (error) {
      log('error', 'Test worker error', { 
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

async function handleHealthCheck(env: Env): Promise<Response> {
  const healthChecks = {
    worker: { status: 'healthy' },
    database: { status: 'unknown' },
    timestamp: new Date().toISOString()
  };

  // Check database
  try {
    await env.DB.prepare('SELECT 1').first();
    healthChecks.database.status = 'healthy';
  } catch (error) {
    healthChecks.database.status = 'error';
  }

  const overallStatus = Object.values(healthChecks).every(check => 
    typeof check === 'object' && check.status === 'healthy'
  ) ? 'healthy' : 'degraded';

  return new Response(JSON.stringify({
    status: overallStatus,
    checks: healthChecks,
    version: '1.0.0'
  }), {
    status: overallStatus === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleDatabaseTest(env: Env): Promise<Response> {
  try {
    // Test database connectivity and schema
    const tables = await env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    const testResults = {
      tablesFound: tables.results.map(t => t.name),
      expectedTables: ['email_subscribers', 'reading_progress', 'user_sessions', 'content_access_logs'],
      schemaValid: false,
      sampleData: {}
    };

    // Check if all expected tables exist
    testResults.schemaValid = testResults.expectedTables.every(table => 
      testResults.tablesFound.includes(table)
    );

    // Get sample data counts
    if (testResults.schemaValid) {
      for (const table of testResults.expectedTables) {
        try {
          const count = await env.DB.prepare(`SELECT COUNT(*) as count FROM ${table}`).first();
          testResults.sampleData[table] = count.count;
        } catch (error) {
          testResults.sampleData[table] = `Error: ${error.message}`;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      database: testResults
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleFullJourneyTest(request: Request, env: Env): Promise<Response> {
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    const results = [];

    // Step 1: Email signup
    const signupRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        firstName: 'Test',
        lastName: 'User'
      })
    });

    const signupResponse = await handleEmailSignup(signupRequest, env);
    const signupData = await signupResponse.json();
    
    results.push({
      step: 'email_signup',
      success: signupResponse.status === 200,
      data: signupData
    });

    if (signupResponse.status !== 200) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email signup failed',
        results
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Update progress
    const progressRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        chapterNumber: 1,
        completed: true,
        timeSpent: 300,
        videosWatched: ['video1'],
        quizzesPassed: ['quiz1']
      })
    });

    const progressResponse = await handleProgressUpdate(progressRequest, env);
    const progressData = await progressResponse.json();
    
    results.push({
      step: 'progress_update',
      success: progressResponse.status === 200,
      data: progressData
    });

    // Step 3: Get progress
    const getProgressUrl = new URL(request.url);
    getProgressUrl.searchParams.set('email', testEmail);
    
    const getProgressRequest = new Request(getProgressUrl.toString(), {
      method: 'GET'
    });

    const getProgressResponse = await handleGetProgress(getProgressRequest, env);
    const getProgressData = await getProgressResponse.json();
    
    results.push({
      step: 'get_progress',
      success: getProgressResponse.status === 200,
      data: getProgressData
    });

    // Step 4: Get analytics
    const analyticsUrl = new URL(request.url);
    analyticsUrl.pathname = '/progress/analytics';
    analyticsUrl.searchParams.set('email', testEmail);
    
    const analyticsRequest = new Request(analyticsUrl.toString(), {
      method: 'GET'
    });

    const analyticsResponse = await handleProgressAnalytics(analyticsRequest, env);
    const analyticsData = await analyticsResponse.json();
    
    results.push({
      step: 'get_analytics',
      success: analyticsResponse.status === 200,
      data: analyticsData
    });

    const allSuccessful = results.every(result => result.success);

    return new Response(JSON.stringify({
      success: allSuccessful,
      message: allSuccessful ? 'Full journey test completed successfully' : 'Some steps failed',
      testEmail,
      results
    }), {
      status: allSuccessful ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
