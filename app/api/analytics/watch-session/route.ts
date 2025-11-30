/**
 * Watch Session Tracking API
 * POST /api/analytics/watch-session - Track detailed watch sessions
 * GET /api/analytics/watch-session - Get watch session analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';

interface WatchSessionData {
  id: string;
  sessionId: string;
  userId: string;
  contentId: string;
  contentType: string;
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  startedAt: number;
  endedAt?: number;
  totalWatchTime: number;
  lastPosition: number;
  duration: number;
  completionPercentage: number;
  quality?: string;
  deviceType?: string;
  isCompleted: boolean;
  pauseCount: number;
  seekCount: number;
}

export async function POST(request: NextRequest) {
  try {
    const data: WatchSessionData = await request.json();

    // Validate required fields
    if (!data.id || !data.contentId || !data.userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Initialize database
    await initializeDB();
    const db = getDB();

    // Extract device type from user agent
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = data.deviceType || getDeviceType(userAgent);

    // Get country from request headers (Vercel/Cloudflare)
    const country = request.headers.get('x-vercel-ip-country') || 
                    request.headers.get('cf-ipcountry') || 
                    (process.env.NODE_ENV === 'development' ? 'Local' : 'Unknown');

    // Upsert watch session
    await db.upsertWatchSession({
      id: data.id,
      sessionId: data.sessionId || 'unknown',
      userId: data.userId,
      contentId: data.contentId,
      contentType: data.contentType,
      contentTitle: data.contentTitle,
      seasonNumber: data.seasonNumber,
      episodeNumber: data.episodeNumber,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      totalWatchTime: data.totalWatchTime,
      lastPosition: data.lastPosition,
      duration: data.duration,
      completionPercentage: data.completionPercentage,
      quality: data.quality,
      deviceType,
      isCompleted: data.isCompleted,
      pauseCount: data.pauseCount,
      seekCount: data.seekCount,
    });

    // Also update user_activity with country for geographic tracking
    try {
      await db.upsertUserActivity({
        userId: data.userId,
        sessionId: data.sessionId || 'unknown',
        deviceType,
        userAgent,
        country: country !== 'XX' ? country : 'Unknown',
        watchTime: data.totalWatchTime,
      });
    } catch (activityError) {
      console.error('Failed to update user activity:', activityError);
      // Don't fail the request for activity tracking errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to track watch session:', error);
    return NextResponse.json(
      { error: 'Failed to track watch session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const contentId = searchParams.get('contentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');

    // Initialize database
    await initializeDB();
    const db = getDB();

    // Build filters
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (contentId) filters.contentId = contentId;
    if (startDate) filters.startDate = parseInt(startDate);
    if (endDate) filters.endDate = parseInt(endDate);
    if (limit) filters.limit = parseInt(limit);

    // Get watch sessions
    const sessions = await db.getWatchSessions(filters);

    // Calculate analytics
    const analytics = calculateWatchAnalytics(sessions);

    return NextResponse.json({
      success: true,
      sessions,
      analytics,
    });
  } catch (error) {
    console.error('Failed to get watch sessions:', error);
    return NextResponse.json(
      { error: 'Failed to get watch sessions' },
      { status: 500 }
    );
  }
}

function getDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  } else if (ua.includes('smart-tv') || ua.includes('smarttv')) {
    return 'tv';
  } else {
    return 'desktop';
  }
}

function calculateWatchAnalytics(sessions: any[]) {
  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalWatchTime: 0,
      averageWatchTime: 0,
      averageCompletionRate: 0,
      totalPauses: 0,
      totalSeeks: 0,
      completedSessions: 0,
      deviceBreakdown: {},
      qualityBreakdown: {},
    };
  }

  const totalWatchTime = sessions.reduce((sum, s) => sum + (s.total_watch_time || 0), 0);
  const totalPauses = sessions.reduce((sum, s) => sum + (s.pause_count || 0), 0);
  const totalSeeks = sessions.reduce((sum, s) => sum + (s.seek_count || 0), 0);
  const completedSessions = sessions.filter(s => s.is_completed || s.completion_percentage >= 90).length;
  const avgCompletion = sessions.reduce((sum, s) => sum + (s.completion_percentage || 0), 0) / sessions.length;

  // Device breakdown
  const deviceBreakdown: Record<string, number> = {};
  sessions.forEach(s => {
    const device = s.device_type || 'unknown';
    deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
  });

  // Quality breakdown
  const qualityBreakdown: Record<string, number> = {};
  sessions.forEach(s => {
    const quality = s.quality || 'unknown';
    qualityBreakdown[quality] = (qualityBreakdown[quality] || 0) + 1;
  });

  return {
    totalSessions: sessions.length,
    totalWatchTime: Math.round(totalWatchTime),
    averageWatchTime: Math.round(totalWatchTime / sessions.length),
    averageCompletionRate: Math.round(avgCompletion * 10) / 10,
    totalPauses,
    totalSeeks,
    completedSessions,
    completionRate: Math.round((completedSessions / sessions.length) * 100),
    deviceBreakdown,
    qualityBreakdown,
  };
}
