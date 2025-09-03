// Resend Webhook Handler for Email Analytics
// Processes email delivery events from Resend

import { Env } from '../../../shared/types';
import { 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId
} from '../../../shared/utils';
import { EmailAnalyticsDB } from '../services/email-analytics-db';

// Resend webhook event types
export interface ResendWebhookEvent {
  type: 'email.sent' | 'email.delivered' | 'email.delivery_delayed' | 'email.complained' | 'email.bounced' | 'email.opened' | 'email.clicked';
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    tags?: Array<{
      name: string;
      value: string;
    }>;
    // Event-specific data
    click?: {
      link: string;
      timestamp: string;
    };
    bounce?: {
      type: 'hard' | 'soft';
      reason: string;
    };
    complaint?: {
      type: string;
      timestamp: string;
    };
  };
}

export async function handleWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    log('info', 'Webhook request received', {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    }, requestId);

    // Verify webhook signature (optional but recommended)
    const signature = request.headers.get('resend-signature');
    if (!signature) {
      log('warn', 'Webhook received without signature', {}, requestId);
    }

    // Parse webhook payload
    const events: ResendWebhookEvent[] = await request.json();
    
    if (!Array.isArray(events)) {
      log('error', 'Invalid webhook payload format', { events }, requestId);
      return createErrorResponse('Invalid payload format', 400);
    }

    log('info', `Processing ${events.length} webhook events`, {
      eventCount: events.length
    }, requestId);

    // Process each event
    const analyticsDB = new EmailAnalyticsDB(env);
    const results = [];

    for (const event of events) {
      try {
        const result = await processWebhookEvent(event, analyticsDB, requestId);
        results.push(result);
      } catch (error) {
        log('error', 'Failed to process webhook event', {
          event: event.type,
          emailId: event.data.email_id,
          error: error.message
        }, requestId);
        
        results.push({
          emailId: event.data.email_id,
          type: event.type,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    log('info', 'Webhook processing completed', {
      totalEvents: events.length,
      successful: successCount,
      errors: errorCount
    }, requestId);

    return createSuccessResponse({
      message: 'Webhook processed successfully',
      processed: events.length,
      successful: successCount,
      errors: errorCount,
      results
    });

  } catch (error) {
    log('error', 'Webhook processing failed', {
      error: error.message
    }, requestId);

    return createErrorResponse('Webhook processing failed', 500);
  }
}

async function processWebhookEvent(
  event: ResendWebhookEvent,
  analyticsDB: EmailAnalyticsDB,
  requestId: string
): Promise<{ emailId: string; type: string; success: boolean; error?: string }> {
  
  const { type, data, created_at } = event;
  const emailId = data.email_id;
  const recipient = data.to[0]; // Primary recipient
  
  // Extract tags for context
  const tags = data.tags || [];
  const emailType = tags.find(t => t.name === 'type')?.value || 'unknown';
  const source = tags.find(t => t.name === 'source')?.value || 'unknown';

  log('info', `Processing ${type} event`, {
    emailId,
    recipient,
    emailType,
    source
  }, requestId);

  switch (type) {
    case 'email.sent':
      await analyticsDB.recordEmailSent({
        emailId,
        recipient,
        subject: data.subject,
        emailType,
        source,
        sentAt: new Date(created_at)
      });
      break;

    case 'email.delivered':
      await analyticsDB.recordEmailDelivered({
        emailId,
        deliveredAt: new Date(created_at)
      });
      break;

    case 'email.opened':
      await analyticsDB.recordEmailOpened({
        emailId,
        openedAt: new Date(created_at)
      });
      break;

    case 'email.clicked':
      if (data.click) {
        await analyticsDB.recordEmailClicked({
          emailId,
          clickedAt: new Date(data.click.timestamp),
          link: data.click.link
        });
      }
      break;

    case 'email.bounced':
      if (data.bounce) {
        await analyticsDB.recordEmailBounced({
          emailId,
          bounceType: data.bounce.type,
          reason: data.bounce.reason,
          bouncedAt: new Date(created_at)
        });
      }
      break;

    case 'email.complained':
      await analyticsDB.recordEmailComplained({
        emailId,
        complainedAt: new Date(created_at)
      });
      break;

    case 'email.delivery_delayed':
      await analyticsDB.recordEmailDelayed({
        emailId,
        delayedAt: new Date(created_at)
      });
      break;

    default:
      log('warn', `Unknown webhook event type: ${type}`, { event }, requestId);
  }

  return {
    emailId,
    type,
    success: true
  };
}
