// Email Sequence Management Handler
// Manages automated follow-up email sequences

import { Env } from '../../../shared/types';
import { 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId
} from '../../../shared/utils';
import { EmailSequenceDB } from '../services/email-sequence-db';
import { EmailSequenceProcessor } from '../services/email-sequence-processor';

/**
 * Process pending emails in the sequence
 */
export async function handleProcessSequence(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    log('info', 'Processing email sequence', {}, requestId);

    const processor = new EmailSequenceProcessor(env);
    const results = await processor.processPendingEmails(requestId);

    log('info', 'Email sequence processing completed', results, requestId);

    return createSuccessResponse({
      message: 'Email sequence processed successfully',
      ...results
    });

  } catch (error) {
    log('error', 'Email sequence processing failed', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to process email sequence', 500);
  }
}

/**
 * Get sequence statistics
 */
export async function handleSequenceStats(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const sequenceDB = new EmailSequenceDB(env);
    const stats = await sequenceDB.getSequenceStats();

    log('info', 'Sequence statistics retrieved', stats, requestId);

    return createSuccessResponse({
      stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    log('error', 'Failed to get sequence statistics', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to get sequence statistics', 500);
  }
}

/**
 * Add user to email sequence manually
 */
export async function handleAddToSequence(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const { email, firstName, lastName } = await request.json();

    if (!email) {
      return createErrorResponse('Email is required', 400);
    }

    const processor = new EmailSequenceProcessor(env);
    await processor.addUserToSequence(email, firstName, lastName, requestId);

    log('info', 'User added to sequence manually', {
      email,
      firstName
    }, requestId);

    return createSuccessResponse({
      message: 'User added to email sequence successfully',
      email,
      firstName
    });

  } catch (error) {
    log('error', 'Failed to add user to sequence', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to add user to sequence', 500);
  }
}

/**
 * Unsubscribe user from sequence
 */
export async function handleUnsubscribe(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return createErrorResponse('Email parameter is required', 400);
    }

    const sequenceDB = new EmailSequenceDB(env);
    await sequenceDB.unsubscribeUser(email);

    log('info', 'User unsubscribed from sequence', { email }, requestId);

    // Return a simple HTML page for user-friendly unsubscribe
    const unsubscribeHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed - Creator's Handbook</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 50px; }
          .container { max-width: 500px; margin: 0 auto; }
          .success { color: #22d172; font-size: 48px; margin-bottom: 20px; }
          h1 { color: #333; margin-bottom: 20px; }
          p { color: #666; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from the Creator's Handbook email sequence.</p>
          <p>You can still access your handbook content anytime at:</p>
          <p><a href="https://creators-handbook-frontend.tdadelaja.workers.dev">creators-handbook-frontend.tdadelaja.workers.dev</a></p>
          <p>Thanks for being part of our creator community!</p>
        </div>
      </body>
      </html>
    `;

    return new Response(unsubscribeHtml, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    log('error', 'Failed to unsubscribe user', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to unsubscribe user', 500);
  }
}

/**
 * Initialize sequence tables
 */
export async function handleInitSequence(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const sequenceDB = new EmailSequenceDB(env);
    await sequenceDB.initializeTables();

    log('info', 'Email sequence tables initialized', {}, requestId);

    return createSuccessResponse({
      message: 'Email sequence tables initialized successfully'
    });

  } catch (error) {
    log('error', 'Failed to initialize sequence tables', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to initialize sequence tables', 500);
  }
}

/**
 * Get emails ready to be sent (for debugging)
 */
export async function handlePendingEmails(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const sequenceDB = new EmailSequenceDB(env);
    const pendingEmails = await sequenceDB.getEmailsToSend(20);

    log('info', 'Retrieved pending emails', {
      count: pendingEmails.length
    }, requestId);

    return createSuccessResponse({
      pendingEmails,
      count: pendingEmails.length,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    log('error', 'Failed to get pending emails', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to get pending emails', 500);
  }
}
