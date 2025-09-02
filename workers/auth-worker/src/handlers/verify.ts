// Token verification handler

import { Env, VerifyTokenRequest, AuthResponse } from '../../../shared/types';
import { EmailSubscriberDB, UserSessionDB } from '../../../shared/db-helpers';
import { 
  parseJSON, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId,
  generateUUID
} from '../../../shared/utils';
import { verifyJWT, generateJWT, createJWTPayload } from '../jwt';

export async function handleVerifyToken(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Parse and validate request
    const data = await parseJSON(request) as VerifyTokenRequest;
    
    if (!data.token) {
      log('warn', 'Missing token in verify request', {}, requestId);
      return createErrorResponse('Token is required', 400);
    }

    // Verify the magic link token
    let payload;
    try {
      payload = await verifyJWT(data.token, env.JWT_SECRET);
    } catch (jwtError) {
      log('warn', 'Invalid or expired token', { error: jwtError.message }, requestId);
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Check if it's a magic link token
    if (payload.type !== 'magic_link') {
      log('warn', 'Invalid token type for verification', { type: payload.type }, requestId);
      return createErrorResponse('Invalid token type', 401);
    }

    // Get user details
    const emailDB = new EmailSubscriberDB(env);
    const user = await emailDB.findByEmail(payload.email);

    if (!user) {
      log('warn', 'User not found during token verification', { email: payload.email }, requestId);
      return createErrorResponse('User not found', 404);
    }

    // Create a new session token
    const sessionPayload = createJWTPayload(
      user.email,
      'session',
      60 * 24 * 7, // 7 days
      {
        userId: user.id,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased
      }
    );
    
    const sessionToken = await generateJWT(sessionPayload, env.JWT_SECRET);

    // Store session in database
    const sessionDB = new UserSessionDB(env);
    const expiresAt = new Date(sessionPayload.exp * 1000);
    
    try {
      await sessionDB.create(user.email, sessionToken, expiresAt);
      log('info', 'Session created successfully', { email: user.email }, requestId);
    } catch (sessionError) {
      log('error', 'Failed to create session', { 
        email: user.email, 
        error: sessionError.message 
      }, requestId);
      // Continue anyway, session token is still valid
    }

    // Cache user session in KV for faster access
    try {
      const sessionData = {
        userId: user.id,
        email: user.email,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased,
        createdAt: Date.now()
      };

      await env.SESSIONS_KV.put(
        `session:${sessionToken}`,
        JSON.stringify(sessionData),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
      );
    } catch (kvError) {
      log('warn', 'Failed to cache session in KV', { 
        email: user.email, 
        error: kvError.message 
      }, requestId);
      // Continue anyway, session is still valid
    }

    const response: AuthResponse = {
      success: true,
      token: sessionToken,
      user: {
        email: user.email,
        firstName: user.first_name,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased
      }
    };

    log('info', 'Token verified and session created', { email: user.email }, requestId);
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Token verification error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Verification failed. Please try again.', 500);
  }
}
