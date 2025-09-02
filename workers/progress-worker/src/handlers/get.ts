// Progress retrieval handler

import { Env, ProgressResponse } from '../../../shared/types';
import { ReadingProgressDB } from '../../../shared/db-helpers';
import { 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId
} from '../../../shared/utils';

export async function handleGetProgress(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email || !isValidEmail(email)) {
      log('warn', 'Invalid email in progress get request', { email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Try to get from cache first
    let progress;
    try {
      const cacheKey = `progress:${normalizedEmail}`;
      const cached = await env.CACHE_KV.get(cacheKey, 'json');
      
      if (cached) {
        log('info', 'Progress retrieved from cache', { email: normalizedEmail }, requestId);
        
        const response: ProgressResponse = {
          success: true,
          progress: cached
        };
        
        return createSuccessResponse(response);
      }
    } catch (cacheError) {
      log('warn', 'Failed to get progress from cache', { 
        email: normalizedEmail, 
        error: cacheError.message 
      }, requestId);
    }

    // Get from database
    const progressDB = new ReadingProgressDB(env);
    progress = await progressDB.findByEmail(normalizedEmail);

    // Cache the result
    try {
      const cacheKey = `progress:${normalizedEmail}`;
      await env.CACHE_KV.put(
        cacheKey, 
        JSON.stringify(progress),
        { expirationTtl: 300 } // 5 minutes
      );
    } catch (cacheError) {
      log('warn', 'Failed to cache progress', { 
        email: normalizedEmail, 
        error: cacheError.message 
      }, requestId);
    }

    const response: ProgressResponse = {
      success: true,
      progress
    };

    log('info', 'Progress retrieved successfully', { 
      email: normalizedEmail,
      progressCount: progress.length
    }, requestId);
    
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Progress get error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Failed to retrieve progress. Please try again.', 500);
  }
}
