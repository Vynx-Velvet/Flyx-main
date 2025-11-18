// Server-side proxy for OpenSubtitles API
// Fetches subtitles in multiple languages

import { NextResponse } from 'next/server';
import https from 'https';

// Language mapping
const languageMap = {
  'eng': { name: 'English', iso639: 'en' },
  'spa': { name: 'Spanish', iso639: 'es' },
  'fre': { name: 'French', iso639: 'fr' },
  'ger': { name: 'German', iso639: 'de' },
  'ita': { name: 'Italian', iso639: 'it' },
  'por': { name: 'Portuguese', iso639: 'pt' },
  'rus': { name: 'Russian', iso639: 'ru' },
  'ara': { name: 'Arabic', iso639: 'ar' },
  'chi': { name: 'Chinese (simplified)', iso639: 'zh' },
  'jpn': { name: 'Japanese', iso639: 'ja' }
};

async function fetchSubtitlesForLanguage(imdbId, languageId, season, episode) {
  const numericImdbId = imdbId.replace(/^tt/, '');
  
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
  
  let apiUrl = 'https://rest.opensubtitles.org/search/' + params.join('/');
  apiUrl = apiUrl.toLowerCase();

  console.log(`[SUBTITLES] Fetching ${languageId} from:`, apiUrl);

  return new Promise((resolve) => {
    const makeHttpsRequest = async (url, maxRedirects = 3) => {
      return new Promise((resolveReq, rejectReq) => {
        const urlObj = new URL(url);
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'TemporaryUserAgent',
            'X-User-Agent': 'TemporaryUserAgent',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 10000,
          agent: false
        };

        const req = https.request(options, (res) => {
          if (res.statusCode === 302 && maxRedirects > 0) {
            const redirectLocation = res.headers.location;
            console.log(`[SUBTITLES] 302 redirect to:`, redirectLocation);
            makeHttpsRequest(redirectLocation, maxRedirects - 1)
              .then(resolveReq)
              .catch(rejectReq);
            return;
          }

          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              resolveReq({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                json: async () => JSON.parse(data)
              });
            } catch (e) {
              rejectReq(e);
            }
          });
        });

        req.on('error', rejectReq);
        req.on('timeout', () => rejectReq(new Error('Request timeout')));
        req.end();
      });
    };

    makeHttpsRequest(apiUrl)
      .then(async (response) => {
        if (!response.ok) {
          console.log(`[SUBTITLES] No results for ${languageId}`);
          resolve([]);
          return;
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
          resolve([]);
          return;
        }

        const validSubtitles = data.filter(sub => 
          sub.SubFormat === "srt" || sub.SubFormat === "vtt"
        );

        const languageInfo = languageMap[languageId] || { name: 'Unknown', iso639: 'en' };

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
          downloadLink: sub.SubDownloadLink,
          language: languageInfo.name,
          languageName: languageInfo.name,
          iso639: languageInfo.iso639,
          langCode: languageId,
          format: sub.SubFormat,
          encoding: sub.SubEncoding || 'UTF-8',
          fileName: sub.SubFileName,
          releaseName: sub.MovieReleaseName,
          qualityScore: calculateQualityScore(sub),
          isVTT: sub.SubFormat === "vtt",
          downloads: sub.SubDownloadsCnt || 0,
          rating: sub.SubRating || 0,
          source: 'opensubtitles',
          trusted: true
        }));

        console.log(`[SUBTITLES] Found ${formatted.length} subtitles for ${languageId}`);
        resolve(formatted);
      })
      .catch((err) => {
        console.error(`[SUBTITLES] Error fetching ${languageId}:`, err.message);
        resolve([]);
      });
  });
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
