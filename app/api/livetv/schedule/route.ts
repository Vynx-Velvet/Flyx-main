/**
 * Live TV Schedule API
 * 
 * Fetches and returns sports events schedule from DLHD.
 * Uses regex-based parsing (no external dependencies).
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SportEvent {
  id: string;
  time: string;
  dataTime: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  isLive: boolean;
  channels: { name: string; channelId: string; href: string }[];
}

interface ScheduleCategory {
  name: string;
  icon: string;
  events: SportEvent[];
}

const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'am. football': '🏈', 'nfl': '🏈', 'tv shows': '📺',
};

function getIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📺';
}

function parseEvents(html: string): SportEvent[] {
  const events: SportEvent[] = [];
  const eventRegex = /<div[^>]*class="[^"]*schedule__event[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let match;
  let index = 0;

  while ((match = eventRegex.exec(html)) !== null) {
    const eventHtml = match[0];
    
    // Extract time
    const timeMatch = eventHtml.match(/class="[^"]*schedule__time[^"]*"[^>]*data-time="([^"]*)"[^>]*>([^<]*)</i);
    const time = timeMatch ? timeMatch[2].trim() : '';
    const dataTime = timeMatch ? timeMatch[1] : '';
    
    // Extract title
    const titleMatch = eventHtml.match(/class="[^"]*schedule__eventTitle[^"]*"[^>]*>([^<]*)</i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Check if live
    const isLive = /is-live|>live</i.test(eventHtml);
    
    // Extract channels
    const channels: { name: string; channelId: string; href: string }[] = [];
    const channelRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let chMatch;
    while ((chMatch = channelRegex.exec(eventHtml)) !== null) {
      const href = chMatch[1];
      const name = chMatch[2].trim();
      const idMatch = href.match(/id=([^&|]+)/);
      if (name) {
        channels.push({ name, channelId: idMatch ? idMatch[1] : '', href });
      }
    }
    
    // Parse teams from title
    let teams: { home: string; away: string } | undefined;
    let league: string | undefined;
    const vsMatch = title.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s*-\s*(.+))?$/i);
    if (vsMatch) {
      teams = { home: vsMatch[1].trim(), away: vsMatch[2].trim() };
      if (vsMatch[3]) league = vsMatch[3].trim();
    }
    
    if (title || time) {
      events.push({
        id: `event-${Date.now()}-${index++}`,
        time, dataTime, title, isLive, channels, teams, league
      });
    }
  }
  
  return events;
}


function parseCategories(html: string): ScheduleCategory[] {
  const categories: ScheduleCategory[] = [];
  const catRegex = /<div[^>]*class="[^"]*schedule__category[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*schedule__category|$)/gi;
  let match;

  while ((match = catRegex.exec(html)) !== null) {
    const catHtml = match[0];
    
    // Extract category name
    const headerMatch = catHtml.match(/class="[^"]*schedule__catHeader[^"]*"[^>]*>([^<]*)</i);
    const name = headerMatch ? headerMatch[1].trim() : '';
    
    if (!name) continue;
    
    const events = parseEvents(catHtml);
    events.forEach(e => { e.sport = name; });
    
    if (events.length > 0) {
      categories.push({ name, icon: getIcon(name), events });
    }
  }
  
  return categories;
}

async function fetchScheduleHTML(source?: string): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json, text/html',
    'Referer': 'https://dlhd.dad/'
  };
  
  try {
    if (source) {
      const response = await fetch(`https://dlhd.dad/schedule-api.php?source=${source}`, { 
        headers, 
        next: { revalidate: 60 } 
      });
      const json = await response.json();
      return json.success && json.html ? json.html : '';
    } else {
      const response = await fetch('https://dlhd.dad/', { 
        headers,
        next: { revalidate: 60 }
      });
      return await response.text();
    }
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const sport = searchParams.get('sport');
    const search = searchParams.get('search');
    const liveOnly = searchParams.get('live') === 'true';
    
    const html = await fetchScheduleHTML(source || undefined);
    
    let categories = parseCategories(html);
    
    // Fallback: parse events directly if no categories found
    if (categories.length === 0) {
      const events = parseEvents(html);
      if (events.length > 0) {
        categories = [{ name: 'All Events', icon: '📺', events }];
      }
    }
    
    // Apply filters
    if (sport && sport !== 'all') {
      categories = categories.filter(cat => cat.name.toLowerCase().includes(sport.toLowerCase()));
    }
    
    if (search) {
      const s = search.toLowerCase();
      categories = categories.map(cat => ({
        ...cat,
        events: cat.events.filter(e => 
          e.title.toLowerCase().includes(s) || 
          e.channels.some(ch => ch.name.toLowerCase().includes(s))
        )
      })).filter(cat => cat.events.length > 0);
    }
    
    if (liveOnly) {
      categories = categories.map(cat => ({
        ...cat,
        events: cat.events.filter(e => e.isLive)
      })).filter(cat => cat.events.length > 0);
    }
    
    const totalEvents = categories.reduce((sum, cat) => sum + cat.events.length, 0);
    const liveEvents = categories.reduce((sum, cat) => sum + cat.events.filter(e => e.isLive).length, 0);
    
    return NextResponse.json({
      success: true,
      schedule: { 
        date: new Date().toISOString().split('T')[0], 
        timezone: 'UK GMT', 
        categories 
      },
      stats: { totalCategories: categories.length, totalEvents, liveEvents },
      filters: { 
        sports: categories.map(cat => ({ name: cat.name, icon: cat.icon, count: cat.events.length })) 
      }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
    
  } catch (error) {
    console.error('[Schedule API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
