// Purchase completion handler for Stripe payments

import { Env } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
import { 
  parseJSON, 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId,
  trackEvent
} from '../../../shared/utils';

export interface PurchaseRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  discountCode?: string;
  stripeSessionId: string;
  amountPaid: number;
  currency: string;
}

export async function handlePurchaseCompletion(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const data = await parseJSON<PurchaseRequest>(request);
    
    if (!data) {
      return createErrorResponse('Invalid JSON data', 400);
    }

    const { email, firstName, lastName, discountCode, stripeSessionId, amountPaid, currency } = data;

    // Validate required fields
    if (!email || !isValidEmail(email)) {
      return createErrorResponse('Valid email is required', 400);
    }

    if (!stripeSessionId) {
      return createErrorResponse('Stripe session ID is required', 400);
    }

    log('info', 'Processing purchase completion', { 
      email, 
      stripeSessionId, 
      amountPaid,
      discountCode 
    }, requestId);

    const emailDB = new EmailSubscriberDB(env);

    // Find existing user
    let user = await emailDB.findByEmail(email);
    
    if (!user) {
      // Create new user if they don't exist
      user = await emailDB.create({
        email,
        firstName,
        lastName,
        discountCode
      });
      
      log('info', 'New user created during purchase', { email }, requestId);
    }

    // Update user with purchase information
    const updatedUser = await emailDB.update(email, {
      hasPurchased: true,
      firstName: firstName || user.first_name,
      lastName: lastName || user.last_name,
      discountCode: discountCode || user.discount_code,
      updatedAt: new Date().toISOString()
    });

    if (!updatedUser) {
      throw new Error('Failed to update user purchase status');
    }

    // Log purchase in content access logs
    await env.DB.prepare(`
      INSERT INTO content_access_logs (id, email, access_type, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      email,
      'purchase',
      new Date().toISOString()
    ).run();

    // Track purchase event
    await trackEvent('purchase_completed', {
      email,
      amountPaid,
      currency,
      discountCode,
      stripeSessionId,
      source: 'stripe_webhook'
    }, env, email);

    log('info', 'Purchase completion processed successfully', { 
      email, 
      stripeSessionId 
    }, requestId);

    return createSuccessResponse({
      message: 'Purchase completed successfully',
      user: {
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        hasAccess: updatedUser.has_access,
        hasPurchased: updatedUser.has_purchased,
        discountCode: updatedUser.discount_code
      }
    });

  } catch (error) {
    log('error', 'Purchase completion failed', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Failed to process purchase completion', 500);
  }
}

export async function handlePurchaseConfirmationEmail(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const data = await parseJSON<{
      email: string;
      firstName?: string;
      discountCode?: string;
      amountPaid: number;
      stripeSessionId: string;
    }>(request);
    
    if (!data) {
      return createErrorResponse('Invalid JSON data', 400);
    }

    const { email, firstName, discountCode, amountPaid, stripeSessionId } = data;

    // Queue purchase confirmation email
    await env.EMAIL_QUEUE.send({
      type: 'purchase_confirmation',
      email,
      firstName,
      discountCode,
      amountPaid: (amountPaid / 100).toFixed(2), // Convert cents to dollars
      stripeSessionId
    });

    log('info', 'Purchase confirmation email queued', { email }, requestId);

    return createSuccessResponse({
      message: 'Purchase confirmation email queued successfully'
    });

  } catch (error) {
    log('error', 'Failed to queue purchase confirmation email', { 
      error: error.message 
    }, requestId);
    
    return createErrorResponse('Failed to queue purchase confirmation email', 500);
  }
}
