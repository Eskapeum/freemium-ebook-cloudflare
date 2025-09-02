// Magic link login handler

import { Env, MagicLinkRequest, MagicLinkResponse } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
import { 
  parseJSON, 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId,
  checkRateLimit
} from '../../../shared/utils';
import { generateJWT, createJWTPayload } from '../jwt';

export async function handleMagicLinkLogin(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Rate limiting - 5 requests per minute per IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `magic_link:${clientIP}`;
    
    const isAllowed = await checkRateLimit(rateLimitKey, 5, 60, env);
    if (!isAllowed) {
      log('warn', 'Rate limit exceeded for magic link', { clientIP }, requestId);
      return createErrorResponse('Too many requests. Please try again later.', 429);
    }

    // Parse and validate request
    const data = await parseJSON(request) as MagicLinkRequest;
    
    if (!data.email || !isValidEmail(data.email)) {
      log('warn', 'Invalid email in magic link request', { email: data.email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    const email = data.email.toLowerCase().trim();
    
    // Check if user exists
    const emailDB = new EmailSubscriberDB(env);
    const user = await emailDB.findByEmail(email);

    if (!user) {
      log('warn', 'Magic link requested for non-existent user', { email }, requestId);
      return createErrorResponse('User not found. Please sign up first.', 404);
    }

    // Generate magic link token (15 minutes expiry)
    const payload = createJWTPayload(email, 'magic_link', 15);
    const token = await generateJWT(payload, env.JWT_SECRET);

    // Queue magic link email
    try {
      await env.EMAIL_QUEUE.send({
        type: 'magic_link',
        email,
        firstName: user.first_name,
        token,
        loginUrl: `${env.FRONTEND_URL}/auth/verify?token=${token}`
      });
      
      log('info', 'Magic link email queued', { email }, requestId);
    } catch (queueError) {
      log('error', 'Failed to queue magic link email', { 
        email, 
        error: queueError.message 
      }, requestId);
      
      return createErrorResponse('Failed to send magic link. Please try again.', 500);
    }

    const response: MagicLinkResponse = {
      success: true,
      message: 'Magic link sent to your email'
    };

    log('info', 'Magic link sent successfully', { email }, requestId);
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Magic link login error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Login failed. Please try again.', 500);
  }
}
