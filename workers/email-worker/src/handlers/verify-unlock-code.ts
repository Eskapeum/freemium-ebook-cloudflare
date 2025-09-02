// Verify unlock code handler for freemium model

import { Env, VerifyCodeRequest, VerifyCodeResponse } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
import { 
  parseJSON, 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId,
  checkRateLimit,
  trackEvent
} from '../../../shared/utils';

export async function handleVerifyUnlockCode(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Rate limiting - 5 verification attempts per hour per IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `verify-code:${clientIP}`;
    
    const isAllowed = await checkRateLimit(rateLimitKey, 5, 3600, env);
    if (!isAllowed) {
      log('warn', 'Rate limit exceeded for code verification', { clientIP }, requestId);
      return createErrorResponse('Too many verification attempts. Please try again later.', 429);
    }

    // Parse and validate request
    const data = await parseJSON(request) as VerifyCodeRequest;
    
    if (!data.email || !isValidEmail(data.email)) {
      log('warn', 'Invalid email in code verification', { email: data.email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    if (!data.code || data.code.length !== 6) {
      log('warn', 'Invalid code format in verification', { email: data.email }, requestId);
      return createErrorResponse('Valid 6-digit code is required', 400);
    }

    const email = data.email.toLowerCase().trim();
    const code = data.code.trim();
    
    // Find user with matching email
    const emailDB = new EmailSubscriberDB(env);
    const user = await emailDB.findByEmail(email);

    if (!user) {
      log('warn', 'User not found for code verification', { email }, requestId);
      return createErrorResponse('Email not found. Please request a new code.', 404);
    }

    if (!user.unlock_code) {
      log('warn', 'No unlock code found for user', { email }, requestId);
      return createErrorResponse('No unlock code found. Please request a new code.', 400);
    }

    if (user.unlock_code !== code) {
      log('warn', 'Invalid unlock code provided', { email }, requestId);
      
      // Track failed verification attempt
      await trackEvent('unlock_code_failed', {
        email,
        reason: 'invalid_code',
        source: 'web'
      }, env, email);
      
      return createErrorResponse('Invalid code. Please check your email and try again.', 400);
    }

    // Check if code has expired
    if (user.unlock_code_expires_at && new Date() > new Date(user.unlock_code_expires_at)) {
      log('warn', 'Expired unlock code used', { email }, requestId);
      
      // Track expired code attempt
      await trackEvent('unlock_code_failed', {
        email,
        reason: 'expired_code',
        source: 'web'
      }, env, email);
      
      return createErrorResponse('Code has expired. Please request a new code.', 400);
    }

    // Code is valid - grant access and clear the code
    await emailDB.grantAccess(email);
    
    log('info', 'Access granted via unlock code verification', { email }, requestId);

    // Track successful verification
    await trackEvent('unlock_code_verified', {
      email,
      source: 'web'
    }, env, email);

    // Queue success email
    try {
      await env.EMAIL_QUEUE.send({
        type: 'access_granted',
        email,
        firstName: user.first_name
      });
      
      log('info', 'Access granted email queued', { email }, requestId);
    } catch (queueError) {
      log('error', 'Failed to queue access granted email', { 
        email, 
        error: queueError.message 
      }, requestId);
      // Don't fail the verification if email queueing fails
    }

    const response: VerifyCodeResponse = {
      success: true,
      message: "Code verified! You now have access to all premium chapters.",
      user: {
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        has_access: true
      }
    };

    log('info', 'Unlock code verification successful', { email }, requestId);
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Verify unlock code error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Failed to verify code. Please try again.', 500);
  }
}
