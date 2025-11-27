/**
 * Live TV Schedule API
 * 
 * Fetches and returns sports events schedule from DLHD.
 * Uses cheerio for HTML parsing (serverless-compatible).
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

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
  'cricket': '🏏', 'hockey': '🏒', 'ice hockey': '🏒', 'baseball': '⚾',
  'golf': '⛳', 'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️',
  'boxing': '🥊', 'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼',
  'volleyball': '🏐', 'handball': '🤾', 'am. football': '🏈', 'nfl': '🏈',
  'horse racing': '🏇', 'tv shows': '📺',
};


function parseEventsFromHTML(html: string): SportEvent[] {
  const $ = cheerio.load(html);
  const events: SportEvent[] = [];
  
  $('.schedule__event').each((index, el) => {
    const $el = $(el);
    const event: SportEvent = {
      id: `event-${Date.now()}-${index}`,
      time: '',
      dataTime: '',
      title: '',
      isLive: false,
      channels: []
    };
    
    const $header = $el.find('.schedule__eventHeader');
    const $time = $header.find('.schedule__time');
    const $title = $header.find('.schedule__eventTitle');
    
    event.time = $time.text().trim();
    event.dataTime = $time.attr('data-time') || '';
    event.title = $title.text().trim();
    
    // Parse teams from title
    const vsMatch = event.title.match(/(.+?)\s+vs\.?\s+(.+?)(?:\s*-\s*(.+))?$/i);
    if (vsMatch) {
      event.teams = { home: vsMatch[1].trim(), away: vsMatch[2].trim() };
      if (vsMatch[3]) event.league = vsMatch[3].trim();
    }
    
    // Check live status
    if ($header.hasClass('is-live') || $el.hasClass('is-live') || 
        $header.text().toLowerCase().includes('live')) {
      event.isLive = true;
    }
    
    // Get channels
    $el.find('.schedule__channels a').each((_, link) => {
      const $link = $(link);
      const href = $link.attr('href') || '';
      const idMatch = href.match(/id=([^&|]+)/);
      event.channels.push({
        name: $link.text().trim(),
        channelId: idMatch ? idMatch[1] : '',
        href
      });
    });
    
    if (event.title || event.time) events.push(event);
  });
  
  return events;
}

function parseCategoriesFromHTML(html: string): ScheduleCategory[] {
  const $ = cheerio.load(html);
  const categories: ScheduleCategory[] = [];
  
  $('.schedule__category').each((_, catEl) => {
    const $cat = $(catEl);
    const name = $cat.find('.schedule__catHeader').text().trim();
    
    let icon = '📺';
    const nameLower = name.toLowerCase();
    for (const [key, ico] of Object.entries(SPORT_ICONS)) {
      if (nameLower.includes(key)) { icon = ico; break; }
    }
    
    const events: SportEvent[] = [];
    $cat.find('.schedule__event').each((_, eventEl) => {
      const parsed = parseEventsFromHTML($(eventEl).prop('outerHTML') || '');
      parsed.forEach(e => { e.sport = name; });
      events.push(...parsed);
    });
    
    if (name && events.length > 0) {
      categories.push({ name, icon, events });
    }
  });
  
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
      const response = await fetch(`https://dlhd.dad/schedule-api.php?source=${source}`, { headers });
      const json = await response.json();
      return json.success && json.html ? json.html : '';
    } else {
      const response = await fetch('https://dlhd.dad/', { headers });
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
    
    let html: string;
    if (source === 'extra') html = await fetchScheduleHTML('extra');
    else if (source === 'extra_ppv') html = await fetchScheduleHTML('extra_ppv');
    else if (source === 'extra_topembed') html = await fetchScheduleHTML('extra_topembed');
    else html = await fetchScheduleHTML();
    
    let categories = parseCategoriesFromHTML(html);
    
    if (categories.length === 0) {
      const events = parseEventsFromHTML(html);
      if (events.length > 0) {
        categories = [{ name: 'All Events', icon: '📺', events }];
      }
    }
    
    // Filters
    if (sport && sport !== 'all') {
      categories = categories.filter(cat => cat.name.toLowerCase().includes(sport.toLowerCase()));
    }
    
    if (search) {
      const s = search.toLowerCase();
      categories = categories.map(cat => ({
        ...cat,
        events: cat.events.filter(e => 
          e.title.toLowerCase().includes(s) || e.channels.some(ch => ch.name.toLowerCase().includes(s))
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
      schedule: { date: new Date().toISOString().split('T')[0], timezone: 'UK GMT', categories },
      stats: { totalCategories: categories.length, totalEvents, liveEvents },
      filters: { sports: categories.map(cat => ({ name: cat.name, icon: cat.icon, count: cat.events.length })) }
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
    
  } catch (error) {
    console.error('[Schedule API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch schedule' }, { status: 500 });
  }
}
