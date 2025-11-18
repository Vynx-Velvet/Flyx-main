/**
 * Subtitles API - Fetches subtitles from OpenSubtitles
 * Returns best subtitle per language
 */

import { NextResponse } from 'next/server';

const languageMap = {
  'eng': { name: 'English', iso639: 'en' },
  'spa': { name: 'Spanish', iso639: 'es' },
  'fre': { name: 'French', iso639: 'fr' },
  'ger': { name: 'German', iso639: 'de' },
  'ita': { name: 'Italian', iso639: 'it' },
  'por': { name: 'Portuguese', iso639: 'pt' },
  'rus': { name: 'Russian', iso639: 'ru' },
  'ara': { name: 'Arabic', iso639: 'ar' },
  'chi': { name: 'Chinese', iso639: 'zh' },
  'jpn': { name: 'Japanese', iso639: 'ja' }
};

async function fetchSubtitlesForLanguage(imdbId, languageId, season, episode) {
  const numericImdbId = imdbId.replace(/^tt/, '');
  
  try {
    // Build URL with parameters in alphabetical order
    const params = [];
    
    if (season && episode) {
      params.push(`episode-${episode}`);
      params.push(`imdbid-${numericImdbId}`);
      params.push(`season-${season}`);
      params.push(`sublanguageid-${languageId}`);
    } else {
      params.push(`imdbid-${numericImdbId}`);
      params.push(`sublanguageid-${languageId}`);
    }
    
    params.sort();
    const apiUrl = `https://rest.opensubtitles.org/search/${params.join('/')}`.toLowerCase();
    
    console.log(`[SUBTITLES] Fetching ${languageId}:`, apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'TemporaryUserAgent',
        'X-User-Agent': 'TemporaryUserAgent',
        'Accept': 'application/json',
      },
      redirect: 'follow',
    });
    
    if (!response.ok) {
      console.log(`[SUBTITLES] No results for ${languageId} (${response.status})`);
      return [];
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      console.log(`[SUBTITLES] Invalid response for ${languageId}`);
      return [];
    }
    
    // Filter for valid formats
    const validSubtitles = data.filter(sub => 
      sub.SubFormat === 'srt' || sub.SubFormat === 'vtt'
    );
    
    const languageInfo = languageMap[languageId] || { name: 'Unknown', iso639: 'en' };
    
    // Calculate quality score
    const calculateQualityScore = (subtitle) => {
      let score = 50;
      const downloads = parseInt(subtitle.SubDownloadsCnt) || 0;
      if (downloads > 1000) score += 20;
      else if (downloads > 100) score += 10;
      else if (downloads > 10) score += 5;
      const rating = parseFloat(subtitle.SubRating) || 0;
      score += Math.round(rating * 5);
      if (subtitle.SubFormat === 'vtt') score += 15;
      return Math.min(100, Math.max(0, score));
    };
    
    const formatted = validSubtitles.map(sub => ({
      id: sub.IDSubtitleFile,
      url: sub.SubDownloadLink,
      language: languageInfo.name,
      iso639: languageInfo.iso639,
      langCode: languageId,
      format: sub.SubFormat,
      fileName: sub.SubFileName,
      qualityScore: calculateQualityScore(sub),
      downloads: sub.SubDownloadsCnt || 0,
      rating: sub.SubRating || 0,
    }));
    
    console.log(`[SUBTITLES] Found ${formatted.length} subtitles for ${languageId}`);
    return formatted;
    
  } catch (error) {
    console.error(`[SUBTITLES] Error fetching ${languageId}:`, error.message);
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get('imdbId');
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!imdbId) {
    return NextResponse.json(
      { success: false, error: 'IMDB ID is required' },
      { status: 400 }
    );
  }

  try {
    console.log('[SUBTITLES] Request:', { imdbId, season, episode });

    // Fetch subtitles for all languages in parallel
    const languageIds = ['eng', 'spa', 'fre', 'ger', 'ita', 'por', 'rus', 'ara', 'chi', 'jpn'];
    const results = await Promise.all(
      languageIds.map(langId => fetchSubtitlesForLanguage(imdbId, langId, season, episode))
    );

    // Flatten all subtitles
    const allSubtitles = results.flat();

    // Deduplicate by language - keep only the best rated subtitle per language
    const bestByLanguage = {};
    for (const subtitle of allSubtitles) {
      const langCode = subtitle.langCode;
      if (!bestByLanguage[langCode] || subtitle.qualityScore > bestByLanguage[langCode].qualityScore) {
        bestByLanguage[langCode] = subtitle;
      }
    }

    const deduplicatedSubtitles = Object.values(bestByLanguage).sort((a, b) => b.qualityScore - a.qualityScore);

    console.log(`[SUBTITLES] Total found: ${allSubtitles.length}, deduplicated: ${deduplicatedSubtitles.length}`);

    return NextResponse.json({
      success: true,
      subtitles: deduplicatedSubtitles,
      totalCount: deduplicatedSubtitles.length,
      source: 'opensubtitles-proxy'
    });

  } catch (error) {
    console.error('[SUBTITLES] Error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch subtitles',
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
