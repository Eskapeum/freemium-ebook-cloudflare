// Send unlock code handler for freemium model

import { Env, UnlockCodeRequest, UnlockCodeResponse } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
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
    // Rate limiting - 3 unlock code requests per hour per IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `unlock-code:${clientIP}`;
    
    const isAllowed = await checkRateLimit(rateLimitKey, 3, 3600, env);
    if (!isAllowed) {
      log('warn', 'Rate limit exceeded for unlock code request', { clientIP }, requestId);
      return createErrorResponse('Too many unlock code requests. Please try again later.', 429);
    }

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

    // Log unlock code for testing (in production, integrate with email service)
    log('info', `UNLOCK CODE for ${email}: ${unlockCode} (expires: ${expiresAt.toISOString()})`, { email }, requestId);

    // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
    // For now, we'll log the code for testing purposes

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
