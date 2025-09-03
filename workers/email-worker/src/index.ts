// Email Worker - Main entry point

import { Env } from '../../shared/types';
import { handleOptions, addCorsHeaders, log, getRequestId } from '../../shared/utils';
import { handleEmailSignup } from './handlers/signup';
import { handlePurchaseCompletion, handlePurchaseConfirmationEmail } from './handlers/purchase';
import { handleSendUnlockCode } from './handlers/send-unlock-code';
import { handleVerifyUnlockCode } from './handlers/verify-unlock-code';
import { handleWebhook } from './handlers/webhook-handler';
import { handleAnalytics, handleAnalyticsDashboard } from './handlers/analytics-handler';
import {
  handleProcessSequence,
  handleSequenceStats,
  handleAddToSequence,
  handleUnsubscribe,
  handleInitSequence,
  handlePendingEmails
} from './handlers/sequence-handler';

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

        case path === '/webhooks/resend' && method === 'POST':
          response = await handleWebhook(request, env);
          break;

        case path === '/analytics' && method === 'GET':
          response = await handleAnalytics(request, env);
          break;

        case path === '/analytics/dashboard' && method === 'GET':
          response = await handleAnalyticsDashboard(request, env);
          break;

        case path === '/admin/init-analytics' && method === 'POST':
          try {
            const { EmailAnalyticsDB } = await import('./services/email-analytics-db');
            const analyticsDB = new EmailAnalyticsDB(env);
            await analyticsDB.initializeTables();
            response = new Response(JSON.stringify({
              success: true,
              message: 'Analytics tables initialized successfully'
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (error) {
            response = new Response(JSON.stringify({
              success: false,
              error: error.message
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          break;

        case path === '/sequence/process' && method === 'POST':
          response = await handleProcessSequence(request, env);
          break;

        case path === '/sequence/stats' && method === 'GET':
          response = await handleSequenceStats(request, env);
          break;

        case path === '/sequence/add' && method === 'POST':
          response = await handleAddToSequence(request, env);
          break;

        case path === '/sequence/unsubscribe' && method === 'GET':
          response = await handleUnsubscribe(request, env);
          break;

        case path === '/sequence/pending' && method === 'GET':
          response = await handlePendingEmails(request, env);
          break;

        case path === '/admin/init-sequence' && method === 'POST':
          response = await handleInitSequence(request, env);
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
  },

  // Cron trigger for automated email sequence processing
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      log('info', 'Cron trigger started', {
        cron: event.cron,
        scheduledTime: new Date(event.scheduledTime).toISOString()
      });

      const { EmailSequenceProcessor } = await import('./services/email-sequence-processor');
      const processor = new EmailSequenceProcessor(env);

      const results = await processor.processPendingEmails();

      log('info', 'Cron trigger completed', {
        processed: results.processed,
        sent: results.sent,
        failed: results.failed
      });

    } catch (error) {
      log('error', 'Cron trigger failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  // Queue consumer disabled for free plan
  // async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
  //   const { default: queueConsumer } = await import('./handlers/queue-consumer');
  //   return queueConsumer.queue(batch, env, ctx);
  // }
};
