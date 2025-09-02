// Progress analytics handler

import { Env } from '../../../shared/types';
import { ReadingProgressDB, ContentAccessLogDB } from '../../../shared/db-helpers';
import { 
  isValidEmail, 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId
} from '../../../shared/utils';

export async function handleProgressAnalytics(request: Request, env: Env): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');
    
    if (!email || !isValidEmail(email)) {
      log('warn', 'Invalid email in analytics request', { email }, requestId);
      return createErrorResponse('Valid email is required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Get completion stats
    const progressDB = new ReadingProgressDB(env);
    const completionStats = await progressDB.getCompletionStats(normalizedEmail);
    
    // Get access stats
    const accessLogDB = new ContentAccessLogDB(env);
    const accessStats = await accessLogDB.getAccessStats(normalizedEmail);
    
    // Calculate additional metrics
    const completionRate = completionStats.totalChapters > 0 
      ? (completionStats.completedChapters / completionStats.totalChapters) * 100 
      : 0;
    
    const averageTimePerChapter = completionStats.completedChapters > 0
      ? completionStats.totalTimeSpent / completionStats.completedChapters
      : 0;

    // Get detailed progress for streak calculation
    const allProgress = await progressDB.findByEmail(normalizedEmail);
    const currentStreak = calculateReadingStreak(allProgress);
    
    const analytics = {
      completion: {
        totalChapters: completionStats.totalChapters,
        completedChapters: completionStats.completedChapters,
        completionRate: Math.round(completionRate * 100) / 100,
        totalTimeSpent: completionStats.totalTimeSpent,
        averageTimePerChapter: Math.round(averageTimePerChapter)
      },
      engagement: {
        totalViews: accessStats.totalViews,
        totalDownloads: accessStats.totalDownloads,
        totalShares: accessStats.totalShares,
        lastAccess: accessStats.lastAccess,
        currentStreak: currentStreak
      },
      progress: allProgress.map(p => ({
        chapterNumber: p.chapter_number,
        completed: p.completed,
        timeSpent: p.time_spent,
        videosWatched: JSON.parse(p.videos_watched || '[]').length,
        quizzesPassed: JSON.parse(p.quizzes_passed || '[]').length,
        lastUpdated: p.updated_at
      }))
    };

    log('info', 'Analytics retrieved successfully', { 
      email: normalizedEmail,
      completionRate,
      totalChapters: completionStats.totalChapters
    }, requestId);
    
    return createSuccessResponse(analytics);

  } catch (error) {
    log('error', 'Analytics error', { 
      error: error.message,
      stack: error.stack 
    }, requestId);
    
    return createErrorResponse('Failed to retrieve analytics. Please try again.', 500);
  }
}

function calculateReadingStreak(progress: any[]): number {
  if (progress.length === 0) return 0;
  
  // Sort by chapter number
  const sortedProgress = progress
    .filter(p => p.completed)
    .sort((a, b) => a.chapter_number - b.chapter_number);
  
  if (sortedProgress.length === 0) return 0;
  
  // Find the longest consecutive streak
  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedProgress.length; i++) {
    if (sortedProgress[i].chapter_number === sortedProgress[i - 1].chapter_number + 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return maxStreak;
}
