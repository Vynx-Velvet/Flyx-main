/**
 * Analytics Tracking API
 * POST /api/analytics/track - Track user events
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/neon-connection';
import { getClientIP } from '@/lib/utils/api-rate-limiter';

// GET endpoint for testing
export async function GET(_request: NextRequest) {
  const requestId = `analytics_test_${Date.now()}`;
  
  console.log(`[${requestId}] Analytics track GET endpoint called for testing`);
  
  try {
    // Test database connection
    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    
    // Test basic query
    const testQuery = await adapter.query('SELECT 1 as test');
    
    console.log(`[${requestId}] Database test successful`, testQuery[0]);
    
    return NextResponse.json({
      success: true,
      message: 'Analytics track endpoint is working',
      database: 'connected',
      dbType: db.isUsingNeon() ? 'neon' : 'sqlite',
      timestamp: new Date().toISOString(),
      requestId
    });
    
  } catch (error) {
    console.error(`[${requestId}] Analytics track GET test failed:`, error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
// Generate a simple ID function
function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

interface AnalyticsEvent {
  id: string;
  type: string;
  userId: string;
  sessionId: string;
  deviceId: string;
  timestamp: number;
  data?: Record<string, any>;
  metadata: Record<string, any>;
}

interface LegacyTrackingEvent {
  event_type: string;
  content_id?: string;
  content_type?: 'movie' | 'tv';
  watch_time?: number;
  duration?: number;
  quality?: string;
  country?: string;
  region?: string;
  user_agent?: string;
  referrer?: string;
  [key: string]: any;
}

// Get session ID from cookie or create new one
function getSessionId(request: NextRequest): string {
  try {
    const sessionCookie = request.cookies.get('session_id');
    if (sessionCookie?.value) {
      console.log('Using existing session ID from cookie');
      return sessionCookie.value;
    }
    const newSessionId = generateId();
    console.log('Generated new session ID');
    return newSessionId;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return generateId(); // Fallback
  }
}

// Get geolocation from IP (simplified - in production use a proper service)
function getLocationFromIP(_ip: string): { country?: string; region?: string } {
  // This is a placeholder - integrate with a real IP geolocation service
  // like MaxMind GeoIP2, ipapi.co, or similar
  return {
    country: 'Unknown',
    region: 'Unknown',
  };
}

export async function POST(request: NextRequest) {
  const requestId = `analytics_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] === ANALYTICS TRACKING REQUEST STARTED ===`, {
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    headers: {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent')?.substring(0, 100),
      'referer': request.headers.get('referer')
    }
  });

  try {
    // Step 1: Parse request body
    console.log(`[${requestId}] Step 1: Parsing request body`);
    let events: AnalyticsEvent[];
    
    try {
      const body = await request.json();
      
      // Handle both new format (with events array) and legacy format (direct array)
      if (body.events && Array.isArray(body.events)) {
        events = body.events;
      } else if (Array.isArray(body)) {
        // Legacy format - convert to new format
        events = body.map((legacyEvent: LegacyTrackingEvent) => ({
          id: generateId(),
          type: legacyEvent.event_type,
          userId: 'legacy_user',
          sessionId: getSessionId(request),
          deviceId: 'legacy_device',
          timestamp: Date.now(),
          data: legacyEvent,
          metadata: {
            userAgent: request.headers.get('user-agent') || '',
            referrer: request.headers.get('referer') || '',
          }
        }));
      } else {
        throw new Error('Invalid request format');
      }
      
      console.log(`[${requestId}] Request body parsed successfully`, {
        isArray: Array.isArray(events),
        length: events.length,
        firstEventType: events.length > 0 ? events[0].type : 'N/A',
        format: body.events ? 'new' : 'legacy'
      });
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse request body`, parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', requestId },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(events) || events.length === 0) {
      console.warn(`[${requestId}] Invalid events data`, { events });
      return NextResponse.json(
        { error: 'Invalid events data - must be non-empty array', requestId },
        { status: 400 }
      );
    }

    // Step 2: Extract request metadata
    console.log(`[${requestId}] Step 2: Extracting request metadata`);
    let sessionId, clientIP, location, userAgent, referrer;
    
    try {
      sessionId = getSessionId(request);
      clientIP = getClientIP(request);
      location = getLocationFromIP(clientIP);
      userAgent = request.headers.get('user-agent') || '';
      referrer = request.headers.get('referer') || '';
      
      console.log(`[${requestId}] Request metadata extracted`, {
        sessionId: sessionId.substring(0, 8) + '...',
        clientIP: clientIP.substring(0, 8) + '...',
        hasUserAgent: !!userAgent,
        hasReferrer: !!referrer,
        location
      });
    } catch (metadataError) {
      console.error(`[${requestId}] Failed to extract request metadata`, metadataError);
      return NextResponse.json(
        { error: 'Failed to process request metadata', requestId },
        { status: 500 }
      );
    }

    // Step 3: Initialize database
    console.log(`[${requestId}] Step 3: Initializing database`);
    let db;
    
    try {
      await initializeDB();
      db = getDB();
      console.log(`[${requestId}] Database initialized successfully`);
    } catch (dbError) {
      console.error(`[${requestId}] Database initialization failed`, dbError);
      
      // In production, if database fails, log the events and return success
      // This prevents 500 errors while still tracking what we can
      if (process.env.NODE_ENV === 'production') {
        console.log(`[${requestId}] Production fallback: Logging events to console`);
        events.forEach((event, index) => {
          console.log(`[${requestId}] Event ${index + 1}:`, {
            ...event,
            session_id: sessionId,
            client_ip_hash: hashIP(clientIP),
            timestamp: Date.now()
          });
        });
        
        return NextResponse.json({ 
          success: true, 
          requestId,
          eventsProcessed: events.length,
          mode: 'fallback_logging',
          duration: Date.now() - startTime
        });
      }
      
      return NextResponse.json(
        { error: 'Database connection failed', requestId },
        { status: 503 }
      );
    }

    // Step 4: Insert events
    console.log(`[${requestId}] Step 4: Inserting ${events.length} events`);
    
    try {
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        console.log(`[${requestId}] Processing event ${i + 1}/${events.length}`, {
          type: event.type,
          userId: event.userId?.substring(0, 8) + '...',
          sessionId: event.sessionId?.substring(0, 8) + '...',
          deviceId: event.deviceId?.substring(0, 8) + '...'
        });
        
        // Enhance metadata with server-side information
        const enhancedMetadata = {
          ...event.metadata,
          ...event.data,
          country: location.country,
          region: location.region,
          user_agent: userAgent,
          referrer: referrer,
          ip_hash: hashIP(clientIP),
          server_timestamp: Date.now(),
        };

        try {
          await db.insertAnalyticsEvent({
            id: event.id,
            sessionId: event.sessionId,
            timestamp: event.timestamp,
            eventType: event.type,
            metadata: enhancedMetadata
          });
          console.log(`[${requestId}] Event ${i + 1} inserted successfully`, { 
            eventId: event.id,
            type: event.type 
          });
        } catch (insertError) {
          console.error(`[${requestId}] Failed to insert event ${i + 1}`, insertError, { 
            eventId: event.id,
            type: event.type 
          });
          throw insertError;
        }
      }

      console.log(`[${requestId}] All events inserted successfully`);
    } catch (transactionError) {
      console.error(`[${requestId}] Transaction failed`, transactionError);
      return NextResponse.json(
        { error: 'Failed to insert events into database', requestId },
        { status: 500 }
      );
    }

    // Step 6: Track user activity
    console.log(`[${requestId}] Step 6: Tracking user activity`);
    
    try {
      // Extract unique user IDs from events
      const uniqueUsers = new Set(events.map(e => e.userId));
      const uniqueUserArray = Array.from(uniqueUsers);
      
      for (const userId of uniqueUserArray) {
        await db.upsertUserActivity({
          userId,
          sessionId,
          deviceType: userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          userAgent: userAgent.substring(0, 200),
          country: location.country,
        });
      }
      console.log(`[${requestId}] User activity tracked for ${uniqueUserArray.length} users`);
    } catch (activityError) {
      console.error(`[${requestId}] Failed to track user activity`, activityError);
      // Don't fail the request for activity tracking errors
    }

    // Step 7: Update content statistics
    console.log(`[${requestId}] Step 7: Updating content statistics`);
    
    try {
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        // Check for watch events that should update content stats
        if ((event.type === 'watch_event' || event.type === 'watch_progress') && 
            (event.data?.contentId || event.metadata?.content_id)) {
          
          const contentId = event.data?.contentId || event.metadata?.content_id;
          const contentType = event.data?.contentType || event.metadata?.content_type;
          const watchTime = event.data?.currentTime || event.data?.watch_time || 0;
          
          console.log(`[${requestId}] Updating content stats for event ${i + 1}`, {
            content_id: contentId,
            content_type: contentType,
            watch_time: watchTime
          });
          
          await updateContentStats({
            content_id: contentId,
            content_type: contentType,
            watch_time: watchTime
          }, requestId);
        }
      }
      console.log(`[${requestId}] Content statistics updated successfully`);
    } catch (statsError) {
      console.error(`[${requestId}] Failed to update content statistics`, statsError);
      // Don't fail the request for stats errors, just log them
    }

    // Step 8: Prepare response
    console.log(`[${requestId}] Step 8: Preparing response`);
    
    const response = NextResponse.json({ 
      success: true, 
      requestId,
      eventsProcessed: events.length,
      duration: Date.now() - startTime
    });
    
    // Set session cookie if new
    if (!request.cookies.get('session_id')) {
      console.log(`[${requestId}] Setting new session cookie`);
      response.cookies.set('session_id', sessionId, {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[${requestId}] === ANALYTICS TRACKING COMPLETED ===`, {
      success: true,
      duration: totalDuration,
      eventsProcessed: events.length
    });

    return response;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Safely handle the unknown error type
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    } : {
      name: 'UnknownError',
      message: String(error),
      stack: undefined,
      cause: undefined
    };
    
    console.error(`[${requestId}] === ANALYTICS TRACKING FAILED ===`, {
      error: errorInfo,
      duration,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to track events',
        requestId,
        duration,
        debug: {
          errorName: errorInfo.name,
          errorMessage: errorInfo.message,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}

// Hash IP address for privacy
function hashIP(ip: string): string {
  try {
    const crypto = require('crypto');
    const salt = process.env.IP_SALT || 'default_salt';
    const hash = crypto.createHash('sha256').update(ip + salt).digest('hex').substring(0, 16);
    console.log('IP hashed successfully');
    return hash;
  } catch (error) {
    console.error('Error hashing IP:', error);
    return 'hash_error'; // Fallback
  }
}

// Update content statistics with debugging
async function updateContentStats(event: { content_id?: string; content_type?: string; watch_time?: number }, requestId: string) {
  try {
    if (!event.content_id) {
      console.log(`[${requestId}] Skipping content stats update - no content_id`);
      return;
    }

    console.log(`[${requestId}] Updating content stats`, {
      content_id: event.content_id,
      content_type: event.content_type,
      watch_time: event.watch_time
    });

    await initializeDB();
    const db = getDB();
    const adapter = db.getAdapter();
    
    const watchTime = event.watch_time || 0;
    const now = Date.now();

    // Use different SQL syntax based on database type
    if (db.isUsingNeon()) {
      // PostgreSQL syntax for Neon
      await adapter.execute(`
        INSERT INTO content_stats (content_id, content_type, view_count, total_watch_time, last_viewed, updated_at)
        VALUES ($1, $2, 1, $3, $4, $5)
        ON CONFLICT(content_id) DO UPDATE SET
          view_count = content_stats.view_count + 1,
          total_watch_time = content_stats.total_watch_time + $6,
          last_viewed = $7,
          updated_at = $8
      `, [
        event.content_id,
        event.content_type || 'unknown',
        watchTime,
        now,
        now,
        watchTime,
        now,
        now
      ]);
    } else {
      // SQLite syntax
      await adapter.execute(`
        INSERT INTO content_stats (content_id, content_type, view_count, total_watch_time, last_viewed, updated_at)
        VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT(content_id) DO UPDATE SET
          view_count = view_count + 1,
          total_watch_time = total_watch_time + ?,
          last_viewed = ?,
          updated_at = ?
      `, [
        event.content_id,
        event.content_type || 'unknown',
        watchTime,
        now,
        now,
        watchTime,
        now,
        now
      ]);
    }
    
    console.log(`[${requestId}] Content stats updated successfully`, {
      content_id: event.content_id,
      watch_time: watchTime
    });
    
  } catch (error) {
    // Safely handle the unknown error type
    const errorInfo = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : {
      name: 'UnknownError',
      message: String(error),
      stack: undefined
    };
    
    console.error(`[${requestId}] Failed to update content stats:`, {
      error: errorInfo,
      event: {
        content_id: event.content_id,
        content_type: event.content_type,
        watch_time: event.watch_time
      }
    });
  }
}
