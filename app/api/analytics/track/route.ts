/**
 * Analytics Tracking API
 * POST /api/analytics/track - Track user events
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeDB, getDB } from '@/lib/db/connection';
import { getClientIP } from '@/lib/utils/api-rate-limiter';

// GET endpoint for testing
export async function GET(_request: NextRequest) {
  const requestId = `analytics_test_${Date.now()}`;
  
  console.log(`[${requestId}] Analytics track GET endpoint called for testing`);
  
  try {
    // Test database connection
    await initializeDB();
    const db = getDB();
    
    // Test basic query
    const testQuery = db.prepare('SELECT 1 as test').get();
    
    console.log(`[${requestId}] Database test successful`, testQuery);
    
    return NextResponse.json({
      success: true,
      message: 'Analytics track endpoint is working',
      database: 'connected',
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

interface TrackingEvent {
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
    let events: TrackingEvent[];
    
    try {
      events = await request.json();
      console.log(`[${requestId}] Request body parsed successfully`, {
        isArray: Array.isArray(events),
        length: Array.isArray(events) ? events.length : 'N/A',
        firstEventType: Array.isArray(events) && events.length > 0 ? events[0].event_type : 'N/A'
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
      return NextResponse.json(
        { error: 'Database connection failed', requestId },
        { status: 503 }
      );
    }

    // Step 4: Prepare database statements
    console.log(`[${requestId}] Step 4: Preparing database statements`);
    let insertStmt;
    
    try {
      insertStmt = db.prepare(`
        INSERT INTO analytics_events (id, session_id, timestamp, event_type, metadata)
        VALUES (?, ?, ?, ?, ?)
      `);
      console.log(`[${requestId}] Database statements prepared successfully`);
    } catch (stmtError) {
      console.error(`[${requestId}] Failed to prepare database statements`, stmtError);
      return NextResponse.json(
        { error: 'Database statement preparation failed', requestId },
        { status: 500 }
      );
    }

    // Step 5: Insert events in transaction
    console.log(`[${requestId}] Step 5: Inserting ${events.length} events`);
    
    try {
      const insertTransaction = db.transaction(() => {
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          console.log(`[${requestId}] Processing event ${i + 1}/${events.length}`, {
            event_type: event.event_type,
            content_id: event.content_id,
            content_type: event.content_type
          });
          
          const metadata = {
            ...event,
            country: location.country,
            region: location.region,
            user_agent: userAgent,
            referrer: referrer,
            ip_hash: hashIP(clientIP),
          };

          const eventId = generateId();
          const timestamp = Date.now();
          
          try {
            insertStmt.run(
              eventId,
              sessionId,
              timestamp,
              event.event_type,
              JSON.stringify(metadata)
            );
            console.log(`[${requestId}] Event ${i + 1} inserted successfully`, { eventId });
          } catch (insertError) {
            console.error(`[${requestId}] Failed to insert event ${i + 1}`, insertError, { event });
            throw insertError;
          }
        }
      });

      insertTransaction();
      console.log(`[${requestId}] All events inserted successfully`);
    } catch (transactionError) {
      console.error(`[${requestId}] Transaction failed`, transactionError);
      return NextResponse.json(
        { error: 'Failed to insert events into database', requestId },
        { status: 500 }
      );
    }

    // Step 6: Update content statistics
    console.log(`[${requestId}] Step 6: Updating content statistics`);
    
    try {
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (event.event_type === 'watch_progress' && event.content_id) {
          console.log(`[${requestId}] Updating content stats for event ${i + 1}`, {
            content_id: event.content_id,
            content_type: event.content_type
          });
          await updateContentStats(event, requestId);
        }
      }
      console.log(`[${requestId}] Content statistics updated successfully`);
    } catch (statsError) {
      console.error(`[${requestId}] Failed to update content statistics`, statsError);
      // Don't fail the request for stats errors, just log them
    }

    // Step 7: Prepare response
    console.log(`[${requestId}] Step 7: Preparing response`);
    
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
async function updateContentStats(event: TrackingEvent, requestId: string) {
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
    
    const upsertStmt = db.prepare(`
      INSERT INTO content_stats (content_id, content_type, view_count, total_watch_time, last_viewed, updated_at)
      VALUES (?, ?, 1, ?, ?, ?)
      ON CONFLICT(content_id) DO UPDATE SET
        view_count = view_count + 1,
        total_watch_time = total_watch_time + ?,
        last_viewed = ?,
        updated_at = ?
    `);

    const watchTime = event.watch_time || 0;
    const now = Date.now();

    upsertStmt.run(
      event.content_id,
      event.content_type || 'unknown',
      watchTime,
      now,
      now,
      watchTime,
      now,
      now
    );
    
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
