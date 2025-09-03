// Email Analytics Handler
// Provides email performance metrics and insights

import { Env } from '../../../shared/types';
import { 
  createErrorResponse, 
  createSuccessResponse,
  log,
  getRequestId
} from '../../../shared/utils';
import { EmailAnalyticsDB } from '../services/email-analytics-db';

export async function handleAnalytics(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    const url = new URL(request.url);
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    const emailType = url.searchParams.get('emailType');

    // Parse date parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (startDateParam) {
      startDate = new Date(startDateParam);
      if (isNaN(startDate.getTime())) {
        return createErrorResponse('Invalid startDate format. Use ISO 8601 format.', 400);
      }
    }

    if (endDateParam) {
      endDate = new Date(endDateParam);
      if (isNaN(endDate.getTime())) {
        return createErrorResponse('Invalid endDate format. Use ISO 8601 format.', 400);
      }
    }

    // Default to last 30 days if no dates provided
    if (!startDate && !endDate) {
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
    }

    log('info', 'Analytics request', {
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString(),
      emailType
    }, requestId);

    const analyticsDB = new EmailAnalyticsDB(env);
    const analytics = await analyticsDB.getEmailAnalytics(startDate, endDate, emailType);

    // Get additional insights
    const insights = generateInsights(analytics);

    const response = {
      analytics,
      insights,
      filters: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        emailType
      },
      generatedAt: new Date().toISOString()
    };

    log('info', 'Analytics generated successfully', {
      totalSent: analytics.totalSent,
      deliveryRate: analytics.deliveryRate,
      openRate: analytics.openRate
    }, requestId);

    return createSuccessResponse(response);

  } catch (error) {
    log('error', 'Analytics generation failed', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to generate analytics', 500);
  }
}

function generateInsights(analytics: any): any {
  const insights = {
    performance: 'good',
    recommendations: [],
    highlights: []
  };

  // Performance assessment
  if (analytics.deliveryRate < 95) {
    insights.performance = 'poor';
    insights.recommendations.push('Delivery rate is below 95%. Check for bounced emails and clean your list.');
  } else if (analytics.deliveryRate < 98) {
    insights.performance = 'fair';
    insights.recommendations.push('Delivery rate could be improved. Monitor bounce rates.');
  }

  if (analytics.openRate < 15) {
    insights.recommendations.push('Open rate is low. Consider improving subject lines and send times.');
  } else if (analytics.openRate > 25) {
    insights.highlights.push(`Excellent open rate of ${analytics.openRate.toFixed(1)}%!`);
  }

  if (analytics.clickRate > 10) {
    insights.highlights.push(`Great click rate of ${analytics.clickRate.toFixed(1)}%!`);
  } else if (analytics.clickRate < 2) {
    insights.recommendations.push('Click rate is low. Improve email content and call-to-action buttons.');
  }

  if (analytics.bounceRate > 5) {
    insights.recommendations.push('High bounce rate detected. Clean your email list and verify addresses.');
  }

  if (analytics.complaintRate > 0.1) {
    insights.recommendations.push('Spam complaints detected. Review email content and frequency.');
  }

  // Highlights
  if (analytics.totalSent > 1000) {
    insights.highlights.push(`Sent ${analytics.totalSent.toLocaleString()} emails successfully!`);
  }

  if (analytics.deliveryRate > 99) {
    insights.highlights.push('Excellent delivery rate - your sender reputation is strong!');
  }

  return insights;
}

export async function handleAnalyticsDashboard(
  request: Request,
  env: Env
): Promise<Response> {
  const requestId = getRequestId(request);
  
  try {
    // Get analytics for different time periods
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const analyticsDB = new EmailAnalyticsDB(env);

    const [
      last7DaysAnalytics,
      last30DaysAnalytics,
      unlockCodeAnalytics,
      welcomeAnalytics
    ] = await Promise.all([
      analyticsDB.getEmailAnalytics(last7Days, now),
      analyticsDB.getEmailAnalytics(last30Days, now),
      analyticsDB.getEmailAnalytics(last30Days, now, 'unlock_code'),
      analyticsDB.getEmailAnalytics(last30Days, now, 'welcome')
    ]);

    const dashboard = {
      overview: {
        last7Days: last7DaysAnalytics,
        last30Days: last30DaysAnalytics
      },
      byEmailType: {
        unlockCode: unlockCodeAnalytics,
        welcome: welcomeAnalytics
      },
      insights: {
        last7Days: generateInsights(last7DaysAnalytics),
        last30Days: generateInsights(last30DaysAnalytics)
      },
      generatedAt: new Date().toISOString()
    };

    log('info', 'Analytics dashboard generated', {
      last7DaysSent: last7DaysAnalytics.totalSent,
      last30DaysSent: last30DaysAnalytics.totalSent
    }, requestId);

    return createSuccessResponse(dashboard);

  } catch (error) {
    log('error', 'Dashboard generation failed', {
      error: error.message
    }, requestId);

    return createErrorResponse('Failed to generate dashboard', 500);
  }
}
