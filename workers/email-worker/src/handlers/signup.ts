// Email signup handler

import { Env, EmailSignupRequest, EmailSignupResponse } from '../../../shared/types';
import { EmailSubscriberDB } from '../../../shared/db-helpers';
import { 
  parseJSON, 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId,
  generateDiscountCode,
  checkRateLimit,
  trackEvent
} from '../../../shared/utils';

export async function handleEmailSignup(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Rate limiting - 3 signups per minute per IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `signup:${clientIP}`;
    
    const isAllowed = await checkRateLimit(rateLimitKey, 3, 60, env);
    if (!isAllowed) {
      log('warn', 'Rate limit exceeded for signup', { clientIP }, requestId);
      return createErrorResponse('Too many signup attempts. Please try again later.', 429);
    }

    // Parse and validate request
    const data = await parseJSON(request) as EmailSignupRequest;
    
    if (!data.email || !isValidEmail(data.email)) {
      log('warn', 'Invalid email in signup request', { email: data.email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    const email = data.email.toLowerCase().trim();
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    
    // Check if user already exists
    const emailDB = new EmailSubscriberDB(env);
    const existingUser = await emailDB.findByEmail(email);

    if (existingUser) {
      log('info', 'User already exists, returning existing data', { email }, requestId);
      
      const response: EmailSignupResponse = {
        success: true,
        message: "Welcome back! You already have access.",
        user: {
          email: existingUser.email,
          first_name: existingUser.first_name,
          has_access: existingUser.has_access,
          has_purchased: existingUser.has_purchased
        },
        hasAccess: existingUser.has_access,
        discountCode: existingUser.discount_code
      };

      return createSuccessResponse(response);
    }

    // Generate discount code
    const discountCode = generateDiscountCode();

    // Create new subscriber
    const newUser = await emailDB.create({
      email,
      firstName,
      lastName,
      discountCode
    });

    // Queue welcome email
    try {
      await env.EMAIL_QUEUE.send({
        type: 'welcome',
        email,
        firstName,
        discountCode
      });
      
      log('info', 'Welcome email queued', { email }, requestId);
    } catch (queueError) {
      log('error', 'Failed to queue welcome email', { 
        email, 
        error: queueError.message 
      }, requestId);
      // Don't fail the signup if email queueing fails
    }

    // Track signup event
    await trackEvent('user_signup', {
      email,
      firstName,
      hasDiscount: !!discountCode,
      source: 'web'
    }, env, email);

    const response: EmailSignupResponse = {
      success: true,
      message: "Welcome! You now have access to the first 7 chapters.",
      user: {
        email: newUser.email,
        first_name: newUser.first_name,
        has_access: newUser.has_access,
        has_purchased: newUser.has_purchased
      },
      hasAccess: true,
      discountCode
    };

    log('info', 'User signup successful', { email }, requestId);
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Email signup error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Signup failed. Please try again.', 500);
  }
}
