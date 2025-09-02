// Token refresh handler

import { Env, AuthResponse } from '../../../shared/types';
import { EmailSubscriberDB, UserSessionDB } from '../../../shared/db-helpers';
import { 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId
} from '../../../shared/utils';
import { verifyJWT, generateJWT, createJWTPayload } from '../jwt';

export async function handleRefreshToken(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log('warn', 'Missing or invalid authorization header', {}, requestId);
      return createErrorResponse('Authorization header required', 401);
    }

    const token = authHeader.substring(7);

    // Verify the current token (even if expired, we'll check manually)
    let payload;
    try {
      payload = await verifyJWT(token, env.JWT_SECRET);
    } catch (jwtError) {
      // If token is expired, we can still refresh if it's within grace period
      if (jwtError.message === 'Token expired') {
        try {
          // Parse token without verification to check expiration
          const [, payloadPart] = token.split('.');
          payload = JSON.parse(atob(payloadPart));
          
          // Check if token expired within last 24 hours (grace period)
          const now = Math.floor(Date.now() / 1000);
          const gracePeriod = 24 * 60 * 60; // 24 hours
          
          if (payload.exp < now - gracePeriod) {
            log('warn', 'Token expired beyond grace period', { email: payload.email }, requestId);
            return createErrorResponse('Token expired. Please login again.', 401);
          }
        } catch (parseError) {
          log('warn', 'Invalid token format during refresh', { error: parseError.message }, requestId);
          return createErrorResponse('Invalid token', 401);
        }
      } else {
        log('warn', 'Invalid token during refresh', { error: jwtError.message }, requestId);
        return createErrorResponse('Invalid token', 401);
      }
    }

    // Check if it's a session token
    if (payload.type !== 'session') {
      log('warn', 'Invalid token type for refresh', { type: payload.type }, requestId);
      return createErrorResponse('Invalid token type', 401);
    }

    // Verify user still exists and get current details
    const emailDB = new EmailSubscriberDB(env);
    const user = await emailDB.findByEmail(payload.email);

    if (!user) {
      log('warn', 'User not found during token refresh', { email: payload.email }, requestId);
      return createErrorResponse('User not found', 404);
    }

    // Create a new session token with updated user data
    const newSessionPayload = createJWTPayload(
      user.email,
      'session',
      60 * 24 * 7, // 7 days
      {
        userId: user.id,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased
      }
    );
    
    const newSessionToken = await generateJWT(newSessionPayload, env.JWT_SECRET);

    // Update session in database
    const sessionDB = new UserSessionDB(env);
    const expiresAt = new Date(newSessionPayload.exp * 1000);
    
    try {
      // Delete old session
      await sessionDB.deleteByToken(token);
      
      // Create new session
      await sessionDB.create(user.email, newSessionToken, expiresAt);
      
      log('info', 'Session refreshed successfully', { email: user.email }, requestId);
    } catch (sessionError) {
      log('error', 'Failed to update session during refresh', { 
        email: user.email, 
        error: sessionError.message 
      }, requestId);
      // Continue anyway, new token is still valid
    }

    // Update cached session in KV
    try {
      // Remove old cached session
      await env.SESSIONS_KV.delete(`session:${token}`);
      
      // Cache new session
      const sessionData = {
        userId: user.id,
        email: user.email,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased,
        createdAt: Date.now()
      };

      await env.SESSIONS_KV.put(
        `session:${newSessionToken}`,
        JSON.stringify(sessionData),
        { expirationTtl: 7 * 24 * 60 * 60 } // 7 days
      );
    } catch (kvError) {
      log('warn', 'Failed to update cached session in KV', { 
        email: user.email, 
        error: kvError.message 
      }, requestId);
      // Continue anyway, session is still valid
    }

    const response: AuthResponse = {
      success: true,
      token: newSessionToken,
      user: {
        email: user.email,
        firstName: user.first_name,
        hasAccess: user.has_access,
        hasPurchased: user.has_purchased
      }
    };

    log('info', 'Token refreshed successfully', { email: user.email }, requestId);
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Token refresh error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Token refresh failed. Please login again.', 500);
  }
}
