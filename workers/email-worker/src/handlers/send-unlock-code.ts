// Send unlock code handler for freemium model

import { Env, UnlockCodeRequest, UnlockCodeResponse } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
import { ResendEmailService } from '../services/resend-email-service';
import {
  parseJSON,
  isValidEmail,
  createErrorResponse,
  createSuccessResponse,
  log,
  getRequestId,
  generateUnlockCode,
  checkRateLimit,
  trackEvent
} from '../../../shared/utils';

export async function handleSendUnlockCode(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Rate limiting temporarily disabled for testing
    // TODO: Re-enable with reasonable limits for production
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    log('info', 'Rate limiting disabled for testing', { clientIP }, requestId);

    // Parse and validate request
    const data = await parseJSON(request) as UnlockCodeRequest;
    
    if (!data.email || !isValidEmail(data.email)) {
      log('warn', 'Invalid email in unlock code request', { email: data.email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    const email = data.email.toLowerCase().trim();
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    
    // Generate 6-digit unlock code
    const unlockCode = generateUnlockCode();
    
    // Set expiry time (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Check if user already exists
    const emailDB = new EmailSubscriberDB(env);
    const existingUser = await emailDB.findByEmail(email);

    if (existingUser) {
      // Update existing user with new unlock code
      await emailDB.updateUnlockCode(email, unlockCode, expiresAt, firstName, lastName);
      
      log('info', 'Unlock code updated for existing user', { email }, requestId);
    } else {
      // Create new subscriber with unlock code
      await emailDB.createWithUnlockCode({
        email,
        firstName,
        lastName,
        unlockCode,
        expiresAt
      });
      
      log('info', 'New user created with unlock code', { email }, requestId);
    }

    // Send unlock code via Resend email service
    const emailService = new ResendEmailService(env);
    const emailResult = await emailService.sendUnlockCodeEmail(email, unlockCode, firstName, requestId);

    if (!emailResult.success) {
      log('error', 'Failed to send unlock code email', {
        email,
        error: emailResult.error
      }, requestId);

      // Still log the code for backup/testing
      log('info', `BACKUP - UNLOCK CODE for ${email}: ${unlockCode} (expires: ${expiresAt.toISOString()})`, { email }, requestId);

      return createErrorResponse('Failed to send email. Please try again.', 500);
    }

    log('info', 'Unlock code email sent successfully', {
      email,
      messageId: emailResult.messageId
    }, requestId);

    // Track unlock code request event
    await trackEvent('unlock_code_requested', {
      email,
      firstName,
      source: 'web'
    }, env, email);

    const response: UnlockCodeResponse = {
      success: true,
      message: "Unlock code sent! Check your email for the 6-digit code.",
      codeExpiry: expiresAt.toISOString()
    };

    log('info', 'Unlock code request successful', { email }, requestId);
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Send unlock code error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Failed to send unlock code. Please try again.', 500);
  }
}
