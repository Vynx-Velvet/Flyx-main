/**
 * Admin Analytics API
 * GET /api/admin/analytics - Get analytics data for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { verifyAdminAuth } from '@/lib/utils/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Calculate date range
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      // Set end date to end of day if it's just a date string
      if (endDate.length === 10) {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      end = new Date();
      switch (period) {
        case 'day':
          start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    const startTimestamp = start.getTime();
    const endTimestamp = end.getTime();

    // Initialize database and get analytics data
    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    const isNeon = db.isUsingNeon();

    // 1. Overview Statistics
    const overviewRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            COUNT(*) as "totalViews",
            COALESCE(SUM(total_watch_time), 0) / 60 as "totalWatchTime",
            COUNT(DISTINCT session_id) as "uniqueSessions"
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
        `
        : `
          SELECT 
            COUNT(*) as totalViews,
            COALESCE(SUM(total_watch_time), 0) / 60 as totalWatchTime,
            COUNT(DISTINCT session_id) as uniqueSessions
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
        `,
      [startTimestamp, endTimestamp]
    );

    // 2. Daily Metrics (for charts)
    const dailyMetricsRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            TO_CHAR(TO_TIMESTAMP(started_at / 1000), 'YYYY-MM-DD') as date,
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as "watchTime",
            COUNT(DISTINCT session_id) as sessions
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY TO_CHAR(TO_TIMESTAMP(started_at / 1000), 'YYYY-MM-DD')
          ORDER BY date ASC
        `
        : `
          SELECT 
            DATE(started_at / 1000, 'unixepoch') as date,
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as watchTime,
            COUNT(DISTINCT session_id) as sessions
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
          GROUP BY DATE(started_at / 1000, 'unixepoch')
          ORDER BY date ASC
        `,
      [startTimestamp, endTimestamp]
    );

    // 3. Content Performance (Enhanced)
    const contentPerformanceRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            content_id as "contentId",
            MAX(content_title) as "contentTitle",
            MAX(content_type) as "contentType",
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as "totalWatchTime",
            AVG(CASE WHEN duration > 0 THEN (total_watch_time::float / duration) * 100 ELSE 0 END) as "avgCompletion",
            COUNT(DISTINCT user_id) as "uniqueViewers"
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY content_id
          ORDER BY views DESC
          LIMIT 20
        `
        : `
          SELECT 
            content_id as contentId,
            MAX(content_title) as contentTitle,
            MAX(content_type) as contentType,
            COUNT(*) as views,
            COALESCE(SUM(total_watch_time), 0) / 60 as totalWatchTime,
            AVG(CASE WHEN duration > 0 THEN (CAST(total_watch_time AS FLOAT) / duration) * 100 ELSE 0 END) as avgCompletion,
            COUNT(DISTINCT user_id) as uniqueViewers
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
          GROUP BY content_id
          ORDER BY views DESC
          LIMIT 20
        `,
      [startTimestamp, endTimestamp]
    );

    // 4. User Stats (New)
    const usersStatsRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            ws.user_id as "userId",
            MAX(u.username) as username,
            MAX(u.email) as email,
            MAX(u.image) as image,
            COUNT(DISTINCT ws.session_id) as "totalSessions",
            COALESCE(SUM(ws.total_watch_time), 0) / 60 as "totalWatchTime",
            MAX(ws.started_at) as "lastActive",
            MAX(ua.country) as country
          FROM watch_sessions ws
          LEFT JOIN users u ON ws.user_id = u.id
          LEFT JOIN user_activity ua ON ws.session_id = ua.session_id
          WHERE ws.started_at BETWEEN $1 AND $2
          GROUP BY ws.user_id
          ORDER BY "lastActive" DESC
          LIMIT 50
        `
        : `
          SELECT 
            ws.user_id as userId,
            MAX(u.username) as username,
            MAX(u.email) as email,
            MAX(u.image) as image,
            COUNT(DISTINCT ws.session_id) as totalSessions,
            COALESCE(SUM(ws.total_watch_time), 0) / 60 as totalWatchTime,
            MAX(ws.started_at) as lastActive,
            MAX(ua.country) as country
          FROM watch_sessions ws
          LEFT JOIN users u ON ws.user_id = u.id
          LEFT JOIN user_activity ua ON ws.session_id = ua.session_id
          WHERE ws.started_at BETWEEN ? AND ?
          GROUP BY ws.user_id
          ORDER BY lastActive DESC
          LIMIT 50
        `,
      [startTimestamp, endTimestamp]
    );

    // 5. Geographic Heatmap (Enhanced - combines data from multiple sources)
    // Try multiple sources: user_activity, live_activity, and analytics_events metadata
    let geographicRaw: any[] = [];
    
    try {
      // First try to get from user_activity (most reliable)
      const userActivityGeo = await adapter.query(
        isNeon
          ? `
            SELECT 
              COALESCE(country, 'Unknown') as country,
              COUNT(DISTINCT session_id) as count,
              COUNT(DISTINCT user_id) as unique_users
            FROM user_activity
            WHERE last_seen BETWEEN $1 AND $2
            AND country IS NOT NULL
            AND country != ''
            AND country != 'Unknown'
            GROUP BY country
          `
          : `
            SELECT 
              COALESCE(country, 'Unknown') as country,
              COUNT(DISTINCT session_id) as count,
              COUNT(DISTINCT user_id) as unique_users
            FROM user_activity
            WHERE last_seen BETWEEN ? AND ?
            AND country IS NOT NULL
            AND country != ''
            AND country != 'Unknown'
            GROUP BY country
          `,
        [startTimestamp, endTimestamp]
      );
      
      // Also get from analytics_events metadata
      const analyticsGeo = await adapter.query(
        isNeon
          ? `
            SELECT 
              COALESCE(metadata->>'country', 'Unknown') as country,
              COUNT(DISTINCT session_id) as count,
              COUNT(DISTINCT COALESCE(metadata->>'userId', 'unknown')) as unique_users
            FROM analytics_events
            WHERE timestamp BETWEEN $1 AND $2
            AND metadata->>'country' IS NOT NULL
            AND metadata->>'country' != ''
            AND metadata->>'country' != 'Unknown'
            GROUP BY metadata->>'country'
          `
          : `
            SELECT 
              COALESCE(json_extract(metadata, '$.country'), 'Unknown') as country,
              COUNT(DISTINCT session_id) as count,
              COUNT(DISTINCT COALESCE(json_extract(metadata, '$.userId'), 'unknown')) as unique_users
            FROM analytics_events
            WHERE timestamp BETWEEN ? AND ?
            AND json_extract(metadata, '$.country') IS NOT NULL
            AND json_extract(metadata, '$.country') != ''
            AND json_extract(metadata, '$.country') != 'Unknown'
            GROUP BY json_extract(metadata, '$.country')
          `,
        [startTimestamp, endTimestamp]
      );
      
      // Merge the results - combine counts for same countries
      const geoMap = new Map<string, { count: number; uniqueUsers: number }>();
      
      for (const row of userActivityGeo) {
        const country = row.country || 'Unknown';
        const existing = geoMap.get(country) || { count: 0, uniqueUsers: 0 };
        geoMap.set(country, {
          count: existing.count + (parseInt(row.count) || 0),
          uniqueUsers: existing.uniqueUsers + (parseInt(row.unique_users) || 0)
        });
      }
      
      for (const row of analyticsGeo) {
        const country = row.country || 'Unknown';
        const existing = geoMap.get(country) || { count: 0, uniqueUsers: 0 };
        // Only add if not already counted from user_activity
        if (!userActivityGeo.find((u: any) => u.country === country)) {
          geoMap.set(country, {
            count: existing.count + (parseInt(row.count) || 0),
            uniqueUsers: existing.uniqueUsers + (parseInt(row.unique_users) || 0)
          });
        }
      }
      
      geographicRaw = Array.from(geoMap.entries())
        .map(([country, data]) => ({ country, count: data.count, unique_users: data.uniqueUsers }))
        .sort((a, b) => b.count - a.count);
        
    } catch (geoError) {
      console.error('Geographic query error:', geoError);
      // Fallback to simple analytics_events query
      geographicRaw = await adapter.query(
        isNeon
          ? `
            SELECT 
              COALESCE(metadata->>'country', 'Unknown') as country,
              COUNT(DISTINCT session_id) as count,
              0 as unique_users
            FROM analytics_events
            WHERE timestamp BETWEEN $1 AND $2
            AND metadata->>'country' IS NOT NULL
            GROUP BY metadata->>'country'
            ORDER BY count DESC
          `
          : `
            SELECT 
              COALESCE(json_extract(metadata, '$.country'), 'Unknown') as country,
              COUNT(DISTINCT session_id) as count,
              0 as unique_users
            FROM analytics_events
            WHERE timestamp BETWEEN ? AND ?
            AND json_extract(metadata, '$.country') IS NOT NULL
            GROUP BY json_extract(metadata, '$.country')
            ORDER BY count DESC
          `,
        [startTimestamp, endTimestamp]
      );
    }

    // 6. Device Breakdown
    const deviceBreakdownRaw = await adapter.query(
      `
        SELECT 
          device_type as "deviceType",
          COUNT(*) as count
        FROM watch_sessions
        WHERE started_at BETWEEN ${isNeon ? '$1' : '?'} AND ${isNeon ? '$2' : '?'}
        GROUP BY device_type
        ORDER BY count DESC
      `,
      [startTimestamp, endTimestamp]
    );

    // 7. Peak Hours
    const peakHoursRaw = await adapter.query(
      isNeon
        ? `
          SELECT 
            EXTRACT(HOUR FROM TO_TIMESTAMP(started_at / 1000)) as hour,
            COUNT(*) as count
          FROM watch_sessions
          WHERE started_at BETWEEN $1 AND $2
          GROUP BY hour
          ORDER BY hour ASC
        `
        : `
          SELECT 
            strftime('%H', datetime(started_at / 1000, 'unixepoch')) as hour,
            COUNT(*) as count
          FROM watch_sessions
          WHERE started_at BETWEEN ? AND ?
          GROUP BY hour
          ORDER BY hour ASC
        `,
      [startTimestamp, endTimestamp]
    );

    // 8. Advanced Metrics
    const advancedMetricsRaw = await adapter.query(
      isNeon
        ? `
          WITH session_stats AS (
            SELECT session_id, COUNT(*) as view_count, SUM(total_watch_time) as session_duration
            FROM watch_sessions
            WHERE started_at BETWEEN $1 AND $2
            GROUP BY session_id
          )
          SELECT
            COUNT(*) as "uniqueViewers",
            AVG(session_duration) / 60 as "avgSessionDuration",
            (COUNT(*) FILTER (WHERE view_count = 1)::float / NULLIF(COUNT(*), 0)) * 100 as "bounceRate"
          FROM session_stats
        `
        : `
          SELECT
            COUNT(*) as uniqueViewers,
            AVG(session_duration) / 60 as avgSessionDuration,
            (CAST(SUM(CASE WHEN view_count = 1 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(*), 0)) * 100 as bounceRate
          FROM (
            SELECT session_id, COUNT(*) as view_count, SUM(total_watch_time) as session_duration
            FROM watch_sessions
            WHERE started_at BETWEEN ? AND ?
            GROUP BY session_id
          )
        `,
      [startTimestamp, endTimestamp]
    );

    // Process and format data
    const overview = {
      totalViews: parseInt(overviewRaw[0]?.totalViews) || 0,
      totalWatchTime: Math.round(parseFloat(overviewRaw[0]?.totalWatchTime) || 0),
      uniqueSessions: parseInt(overviewRaw[0]?.uniqueSessions) || 0,
      avgSessionDuration: Math.round(parseFloat(advancedMetricsRaw[0]?.avgSessionDuration) || 0)
    };

    const dailyMetrics = dailyMetricsRaw.map((row: any) => ({
      date: row.date,
      views: parseInt(row.views) || 0,
      watchTime: Math.round(parseFloat(row.watchTime || row.watchtime) || 0),
      sessions: parseInt(row.sessions) || 0
    }));

    const contentPerformance = contentPerformanceRaw.map((row: any) => ({
      contentId: row.contentId,
      contentTitle: row.contentTitle || 'Unknown Title',
      contentType: row.contentType,
      views: parseInt(row.views) || 0,
      totalWatchTime: Math.round(parseFloat(row.totalWatchTime) || 0),
      avgCompletion: Math.round(parseFloat(row.avgCompletion) || 0),
      uniqueViewers: parseInt(row.uniqueViewers) || 0
    }));

    const usersStats = usersStatsRaw.map((row: any) => ({
      userId: row.userId,
      username: row.username || 'Anonymous',
      email: row.email,
      image: row.image,
      totalSessions: parseInt(row.totalSessions) || 0,
      totalWatchTime: Math.round(parseFloat(row.totalWatchTime) || 0),
      lastActive: parseInt(row.lastActive) || 0,
      country: row.country || 'Unknown'
    }));

    const geographic = geographicRaw.map((row: any) => ({
      country: row.country || 'Unknown',
      count: parseInt(row.count) || 0,
      uniqueUsers: parseInt(row.unique_users) || 0
    }));

    const deviceBreakdown = deviceBreakdownRaw.map((row: any) => ({
      deviceType: row.deviceType || 'Unknown',
      count: parseInt(row.count) || 0
    }));

    const peakHours = peakHoursRaw.map((row: any) => ({
      hour: parseInt(row.hour) || 0,
      count: parseInt(row.count) || 0
    }));

    const advancedMetrics = {
      uniqueViewers: parseInt(advancedMetricsRaw[0]?.uniqueViewers) || 0,
      avgSessionDuration: Math.round(parseFloat(advancedMetricsRaw[0]?.avgSessionDuration) || 0),
      bounceRate: Math.round(parseFloat(advancedMetricsRaw[0]?.bounceRate) || 0)
    };

    return NextResponse.json({
      success: true,
      data: {
        overview,
        dailyMetrics,
        contentPerformance, // Replaces topContent
        usersStats,        // New
        geographic,
        deviceBreakdown,
        peakHours,
        advancedMetrics,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Analytics API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
