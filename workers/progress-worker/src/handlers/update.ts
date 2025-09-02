// Progress update handler

import { Env, ProgressUpdateRequest, ProgressResponse } from '../../../shared/types';
import { ReadingProgressDB, ContentAccessLogDB } from '../../../shared/db-helpers';
import { 
  parseJSON, 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId,
  getClientIP,
  getUserAgent,
  trackEvent
} from '../../../shared/utils';

export async function handleProgressUpdate(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Parse and validate request
    const data = await parseJSON(request) as ProgressUpdateRequest;
    
    if (!data.email || !isValidEmail(data.email)) {
      log('warn', 'Invalid email in progress update', { email: data.email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    if (!data.chapterNumber || data.chapterNumber < 1) {
      log('warn', 'Invalid chapter number', { chapterNumber: data.chapterNumber }, requestId);
      return createErrorResponse('Valid chapter number is required', 400);
    }

    const email = data.email.toLowerCase().trim();
    
    // Update reading progress
    const progressDB = new ReadingProgressDB(env);
    const updatedProgress = await progressDB.upsert({
      email,
      chapterNumber: data.chapterNumber,
      completed: data.completed,
      timeSpent: data.timeSpent,
      videosWatched: data.videosWatched,
      quizzesPassed: data.quizzesPassed
    });

    // Log content access
    const accessLogDB = new ContentAccessLogDB(env);
    await accessLogDB.log({
      email,
      chapterNumber: data.chapterNumber,
      accessType: 'view',
      ipAddress: getClientIP(request),
      userAgent: getUserAgent(request)
    });

    // Track analytics events
    if (data.completed) {
      await trackEvent('chapter_completed', {
        email,
        chapterNumber: data.chapterNumber,
        timeSpent: data.timeSpent
      }, env, email);
    }

    if (data.videosWatched && data.videosWatched.length > 0) {
      await trackEvent('videos_watched', {
        email,
        chapterNumber: data.chapterNumber,
        videoCount: data.videosWatched.length,
        videos: data.videosWatched
      }, env, email);
    }

    if (data.quizzesPassed && data.quizzesPassed.length > 0) {
      await trackEvent('quizzes_completed', {
        email,
        chapterNumber: data.chapterNumber,
        quizCount: data.quizzesPassed.length,
        quizzes: data.quizzesPassed
      }, env, email);
    }

    // Cache updated progress
    try {
      const cacheKey = `progress:${email}`;
      const allProgress = await progressDB.findByEmail(email);
      
      await env.CACHE_KV.put(
        cacheKey, 
        JSON.stringify(allProgress),
        { expirationTtl: 300 } // 5 minutes
      );
    } catch (cacheError) {
      log('warn', 'Failed to cache progress', { 
        email, 
        error: cacheError.message 
      }, requestId);
    }

    const response: ProgressResponse = {
      success: true,
      progress: [updatedProgress]
    };

    log('info', 'Progress updated successfully', { 
      email, 
      chapterNumber: data.chapterNumber,
      completed: data.completed
    }, requestId);
    
    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Progress update error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Failed to update progress. Please try again.', 500);
  }
}
