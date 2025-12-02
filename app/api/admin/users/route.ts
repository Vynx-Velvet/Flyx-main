/**
 * Admin Users API - Single Source of Truth for User Data
 * GET /api/admin/users - Get all users with their activity data
 * GET /api/admin/users?userId=xxx - Get detailed profile for a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';
import { getCountryName } from '@/app/lib/utils/geolocation';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // If userId is provided, return detailed user profile
    if (userId) {
      return await getUserProfile(adapter, isNeon, userId, now);
    }

    // Otherwise return list of all users
    return await getAllUsers(adapter, isNeon, limit, offset, fiveMinutesAgo, oneDayAgo, oneWeekAgo);

  } catch (error) {
    console.error('Admin users API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

async function getAllUsers(
  adapter: any, 
  isNeon: boolean, 
  limit: number, 
  offset: number,
  fiveMinutesAgo: number,
  oneDayAgo: number,
  oneWeekAgo: number
) {
  // Get all users with their activity summary
  const usersQuery = isNeon
    ? `SELECT 
         ua.user_id,
         ua.session_id,
         ua.first_seen,
         ua.last_seen,
         ua.total_sessions,
         ua.total_watch_time,
         ua.country,
         ua.city,
         ua.region,
         ua.device_type,
         ua.user_agent,
         CASE WHEN la.is_active = TRUE AND la.last_heartbeat >= $1 THEN TRUE ELSE FALSE END as is_online,
         la.activity_type as current_activity,
         la.content_title as current_content
       FROM user_activity ua
       LEFT JOIN live_activity la ON ua.user_id = la.user_id AND la.is_active = TRUE
       ORDER BY ua.last_seen DESC
       LIMIT $2 OFFSET $3`
    : `SELECT 
         ua.user_id,
         ua.session_id,
         ua.first_seen,
         ua.last_seen,
         ua.total_sessions,
         ua.total_watch_time,
         ua.country,
         ua.city,
         ua.region,
         ua.device_type,
         ua.user_agent,
         CASE WHEN la.is_active = 1 AND la.last_heartbeat >= ? THEN 1 ELSE 0 END as is_online,
         la.activity_type as current_activity,
         la.content_title as current_content
       FROM user_activity ua
       LEFT JOIN live_activity la ON ua.user_id = la.user_id AND la.is_active = 1
       ORDER BY ua.last_seen DESC
       LIMIT ? OFFSET ?`;

  const users = await adapter.query(usersQuery, [fiveMinutesAgo, limit, offset]);

  // Get total count
  const countQuery = 'SELECT COUNT(DISTINCT user_id) as count FROM user_activity';
  const countResult = await adapter.query(countQuery);
  const totalUsers = parseInt(countResult[0]?.count) || 0;

  // Get summary stats
  const activeToday = users.filter((u: any) => u.last_seen >= oneDayAgo).length;
  const activeThisWeek = users.filter((u: any) => u.last_seen >= oneWeekAgo).length;
  const onlineNow = users.filter((u: any) => u.is_online).length;

  return NextResponse.json({
    success: true,
    users: users.map((u: any) => ({
      userId: u.user_id,
      sessionId: u.session_id,
      firstSeen: parseInt(u.first_seen) || 0,
      lastSeen: parseInt(u.last_seen) || 0,
      totalSessions: parseInt(u.total_sessions) || 0,
      totalWatchTime: Math.round((parseInt(u.total_watch_time) || 0) / 60), // Convert to minutes
      country: u.country,
      countryName: getCountryName(u.country) || u.country,
      city: u.city,
      region: u.region,
      deviceType: u.device_type || 'unknown',
      userAgent: u.user_agent,
      isOnline: !!u.is_online,
      currentActivity: u.current_activity,
      currentContent: u.current_content,
    })),
    pagination: {
      total: totalUsers,
      limit,
      offset,
      hasMore: offset + limit < totalUsers,
    },
    summary: {
      totalUsers,
      activeToday,
      activeThisWeek,
      onlineNow,
    },
  });
}

async function getUserProfile(adapter: any, isNeon: boolean, userId: string, now: number) {
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // 1. Get basic user info
  const userQuery = isNeon
    ? `SELECT * FROM user_activity WHERE user_id = $1`
    : `SELECT * FROM user_activity WHERE user_id = ?`;
  const userResult = await adapter.query(userQuery, [userId]);
  
  if (!userResult || userResult.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const user = userResult[0];

  // 2. Get current live activity
  const liveQuery = isNeon
    ? `SELECT * FROM live_activity WHERE user_id = $1 AND is_active = TRUE AND last_heartbeat >= $2`
    : `SELECT * FROM live_activity WHERE user_id = ? AND is_active = 1 AND last_heartbeat >= ?`;
  const liveResult = await adapter.query(liveQuery, [userId, fiveMinutesAgo]);
  const liveActivity = liveResult[0] || null;

  // 3. Get watch history (last 50 sessions)
  const watchQuery = isNeon
    ? `SELECT 
         content_id, content_type, content_title, 
         season_number, episode_number,
         started_at, ended_at, total_watch_time, 
         last_position, duration, completion_percentage,
         quality, device_type, is_completed, pause_count, seek_count
       FROM watch_sessions 
       WHERE user_id = $1 
       ORDER BY started_at DESC 
       LIMIT 50`
    : `SELECT 
         content_id, content_type, content_title, 
         season_number, episode_number,
         started_at, ended_at, total_watch_time, 
         last_position, duration, completion_percentage,
         quality, device_type, is_completed, pause_count, seek_count
       FROM watch_sessions 
       WHERE user_id = ? 
       ORDER BY started_at DESC 
       LIMIT 50`;
  const watchHistory = await adapter.query(watchQuery, [userId]);

  // 4. Get page view history (last 100 events)
  const eventsQuery = isNeon
    ? `SELECT event_type, timestamp, metadata 
       FROM analytics_events 
       WHERE user_id = $1 OR session_id = $1
       ORDER BY timestamp DESC 
       LIMIT 100`
    : `SELECT event_type, timestamp, metadata 
       FROM analytics_events 
       WHERE user_id = ? OR session_id = ?
       ORDER BY timestamp DESC 
       LIMIT 100`;
  const events = await adapter.query(eventsQuery, isNeon ? [userId] : [userId, userId]);

  // 5. Calculate engagement metrics
  const totalWatchTime = watchHistory.reduce((sum: number, w: any) => sum + (parseInt(w.total_watch_time) || 0), 0);
  const avgCompletion = watchHistory.length > 0 
    ? watchHistory.reduce((sum: number, w: any) => sum + (parseFloat(w.completion_percentage) || 0), 0) / watchHistory.length 
    : 0;
  const completedCount = watchHistory.filter((w: any) => w.is_completed).length;
  const totalPauses = watchHistory.reduce((sum: number, w: any) => sum + (parseInt(w.pause_count) || 0), 0);
  const totalSeeks = watchHistory.reduce((sum: number, w: any) => sum + (parseInt(w.seek_count) || 0), 0);

  // 6. Get content preferences (most watched genres/types)
  const movieCount = watchHistory.filter((w: any) => w.content_type === 'movie').length;
  const tvCount = watchHistory.filter((w: any) => w.content_type === 'tv').length;

  // 7. Get visit patterns (by hour and day)
  const visitsByHour: Record<number, number> = {};
  const visitsByDay: Record<number, number> = {};
  
  events.forEach((e: any) => {
    const ts = parseInt(e.timestamp);
    if (ts) {
      const date = new Date(ts);
      const hour = date.getHours();
      const day = date.getDay();
      visitsByHour[hour] = (visitsByHour[hour] || 0) + 1;
      visitsByDay[day] = (visitsByDay[day] || 0) + 1;
    }
  });

  // 8. Get recent activity timeline
  const recentActivity = events.slice(0, 20).map((e: any) => {
    let metadata = {};
    try {
      metadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata || {};
    } catch {}
    return {
      type: e.event_type,
      timestamp: parseInt(e.timestamp),
      page: (metadata as any).page || (metadata as any).path,
      contentId: (metadata as any).contentId,
      contentTitle: (metadata as any).contentTitle,
    };
  });

  // 9. Calculate activity streaks
  const watchDates = new Set(
    watchHistory.map((w: any) => {
      const ts = parseInt(w.started_at);
      return ts ? new Date(ts).toDateString() : null;
    }).filter(Boolean)
  );
  
  const eventDates = new Set(
    events.map((e: any) => {
      const ts = parseInt(e.timestamp);
      return ts ? new Date(ts).toDateString() : null;
    }).filter(Boolean)
  );

  const allDates = new Set(Array.from(watchDates).concat(Array.from(eventDates)));
  const daysActive = allDates.size;

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = new Date();
  while (allDates.has(checkDate.toDateString())) {
    currentStreak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return NextResponse.json({
    success: true,
    profile: {
      userId: user.user_id,
      sessionId: user.session_id,
      firstSeen: parseInt(user.first_seen) || 0,
      lastSeen: parseInt(user.last_seen) || 0,
      totalSessions: parseInt(user.total_sessions) || 0,
      country: user.country,
      countryName: getCountryName(user.country) || user.country,
      city: user.city,
      region: user.region,
      deviceType: user.device_type || 'unknown',
      userAgent: user.user_agent,
    },
    liveStatus: liveActivity ? {
      isOnline: true,
      activityType: liveActivity.activity_type,
      contentId: liveActivity.content_id,
      contentTitle: liveActivity.content_title,
      currentPosition: parseInt(liveActivity.current_position) || 0,
      lastHeartbeat: parseInt(liveActivity.last_heartbeat) || 0,
    } : {
      isOnline: false,
    },
    engagement: {
      totalWatchTime: Math.round(totalWatchTime / 60), // minutes
      avgCompletion: Math.round(avgCompletion),
      completedCount,
      totalPauses,
      totalSeeks,
      daysActive,
      currentStreak,
    },
    preferences: {
      movieCount,
      tvCount,
      preferredType: movieCount > tvCount ? 'movies' : tvCount > movieCount ? 'tv' : 'mixed',
      topQuality: getMostCommon(watchHistory.map((w: any) => w.quality).filter(Boolean)),
      topDevice: getMostCommon(watchHistory.map((w: any) => w.device_type).filter(Boolean)),
    },
    patterns: {
      visitsByHour: Object.entries(visitsByHour).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour),
      visitsByDay: Object.entries(visitsByDay).map(([day, count]) => ({ day: parseInt(day), count })).sort((a, b) => a.day - b.day),
      peakHour: Object.entries(visitsByHour).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      peakDay: Object.entries(visitsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    },
    watchHistory: watchHistory.map((w: any) => ({
      contentId: w.content_id,
      contentType: w.content_type,
      contentTitle: w.content_title,
      seasonNumber: w.season_number,
      episodeNumber: w.episode_number,
      startedAt: parseInt(w.started_at) || 0,
      endedAt: parseInt(w.ended_at) || 0,
      watchTime: Math.round((parseInt(w.total_watch_time) || 0) / 60),
      lastPosition: parseInt(w.last_position) || 0,
      duration: parseInt(w.duration) || 0,
      completion: Math.round(parseFloat(w.completion_percentage) || 0),
      quality: w.quality,
      deviceType: w.device_type,
      isCompleted: !!w.is_completed,
      pauseCount: parseInt(w.pause_count) || 0,
      seekCount: parseInt(w.seek_count) || 0,
    })),
    recentActivity,
  });
}

function getMostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
