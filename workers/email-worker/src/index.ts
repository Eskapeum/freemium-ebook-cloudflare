// Email Worker - Main entry point

import { Env } from '../../shared/types';
import { handleOptions, addCorsHeaders, log, getRequestId } from '../../shared/utils';
import { handleEmailSignup } from './handlers/signup';
import { handlePurchaseCompletion, handlePurchaseConfirmationEmail } from './handlers/purchase';
import { handleSendUnlockCode } from './handlers/send-unlock-code';
import { handleVerifyUnlockCode } from './handlers/verify-unlock-code';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getRequestId(request);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    log('info', 'Email worker request', { 
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
        case path === '/email/signup' && method === 'POST':
          response = await handleEmailSignup(request, env);
          break;

        case path === '/email/purchase' && method === 'POST':
          response = await handlePurchaseCompletion(request, env);
          break;

        case path === '/email/purchase-confirmation' && method === 'POST':
          response = await handlePurchaseConfirmationEmail(request, env);
          break;

        case path === '/email/send-unlock-code' && method === 'POST':
          response = await handleSendUnlockCode(request, env);
          break;

        case path === '/email/verify-unlock-code' && method === 'POST':
          response = await handleVerifyUnlockCode(request, env);
          break;

        case path === '/email/health' && method === 'GET':
          response = new Response(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            worker: 'email-worker'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
          break;

        default:
          log('warn', 'Email worker route not found', { method, path }, requestId);
          response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers
      response = addCorsHeaders(response);
      
      log('info', 'Email worker response', { 
        status: response.status,
        method,
        path
      }, requestId);

      return response;

    } catch (error) {
      log('error', 'Email worker error', { 
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
  }

  // Queue consumer disabled for free plan
  // async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
  //   const { default: queueConsumer } = await import('./handlers/queue-consumer');
  //   return queueConsumer.queue(batch, env, ctx);
  // }
};
