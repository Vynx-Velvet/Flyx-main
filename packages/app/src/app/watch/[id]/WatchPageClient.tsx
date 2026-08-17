'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getProviderSettings, saveProviderSettings, SYNC_DATA_CHANGED_EVENT } from '@/lib/sync';
import { ExtensionGate } from '@/components/ExtensionGate';
import styles from './WatchPage.module.css';

// Proxy source URLs for mobile player — mirrors applyStreamProxy in VideoPlayer.tsx
/**
 * Route a source through /api/stream/proxy when it needs Referer/Origin
 * headers (browsers cannot set Referer on cross-origin fetches) or when
 * the provider marks it requiresSegmentProxy. Other URLs play directly.
 */
function proxySourceUrl(source: { url: string; referer?: string; origin?: string; requiresSegmentProxy?: boolean }): string {
  if (!source.url) return source.url;
  // Already proxied — don't double-wrap
  if (source.url.includes('/api/stream/proxy') || source.url.includes('/api/stream-proxy')) {
    return source.url;
  }

  const needsProxy =
    source.requiresSegmentProxy === true ||
    !!source.referer ||
    !!source.origin;
  if (!needsProxy) return source.url;

  const params = new URLSearchParams({ url: source.url });
  if (source.referer) params.set('referer', source.referer);
  if (source.origin) params.set('origin', source.origin);
  return `/api/stream/proxy?${params.toString()}`;
}

// Type alias for anime audio preference
type AnimeAudioPreference = 'sub' | 'dub';

// Desktop video player
const DesktopVideoPlayer = dynamic(
  () => import('@/components/player/VideoPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading player...</p>
      </div>
    )
  }
);

// Mobile-optimized video player
const MobileVideoPlayer = dynamic(
  () => import('@/components/player/MobileVideoPlayer'),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading player...</p>
      </div>
    )
  }
);

interface NextEpisodeInfo {
  season: number;
  episode: number;
  title?: string;
  isNextSeason?: boolean;
  isLastEpisode?: boolean;
}

interface SeasonInfo {
  seasonNumber: number;
  episodeCount: number;
  episodes: Array<{
    episodeNumber: number;
    title: string;
    airDate: string;
  }>;
}

interface ShowInfo {
  seasons: Array<{
    seasonNumber: number;
    episodeCount: number;
  }>;
}

function WatchContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mobileInfo = useIsMobile();

  const contentId = params.id as string;
  const mediaType = searchParams.get('type') as 'movie' | 'tv';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  const titleParam = searchParams.get('title') || searchParams.get('name');
  const shouldAutoplay = searchParams.get('autoplay') === 'true';

  // MAL-specific parameters for anime
  const malId = searchParams.get('malId');
  const malTitleParam = searchParams.get('malTitle');

  // Decode title if it exists
  const title = titleParam ? decodeURIComponent(titleParam) : 'Loading...';
  const malTitle = malTitleParam ? decodeURIComponent(malTitleParam) : undefined;

  const seasonId = season ? parseInt(season) : undefined;
  const episodeId = episode ? parseInt(episode) : undefined;

  // Mobile vs desktop player — decide immediately (never stick on null forever)
  const [useMobilePlayer, setUseMobilePlayer] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const hasSetMobilePlayerRef = useRef(false);

  useEffect(() => {
    if (hasSetMobilePlayerRef.current) return;
    const width =
      mobileInfo.screenWidth ||
      (typeof window !== 'undefined' ? window.innerWidth : 0);
    if (width <= 0) return;
    const shouldUseMobile = mobileInfo.isMobile || width < 768;
    console.log('[WatchPage] Locking useMobilePlayer to:', shouldUseMobile, {
      width,
      isMobile: mobileInfo.isMobile,
    });
    setUseMobilePlayer(shouldUseMobile);
    hasSetMobilePlayerRef.current = true;
  }, [mobileInfo.isMobile, mobileInfo.screenWidth]);

  // Debug log for mobile detection
  useEffect(() => {
    console.log('[WatchPage] Mobile detection:', {
      isMobile: mobileInfo.isMobile,
      isIOS: mobileInfo.isIOS,
      isAndroid: mobileInfo.isAndroid,
      screenWidth: mobileInfo.screenWidth,
      useMobilePlayer,
    });
  }, [mobileInfo, useMobilePlayer]);

  const [nextEpisode, setNextEpisode] = useState<NextEpisodeInfo | null>(null);
  const [, setIsLoadingNextEpisode] = useState(false);

  // Mobile player state
  const [mobileStreamUrl, setMobileStreamUrl] = useState<string | null>(null);
  const [mobileSources, setMobileSources] = useState<Array<{ title: string; url: string; quality?: string; provider?: string; skipIntro?: [number, number]; skipOutro?: [number, number] }>>([]);
  const [mobileSourceIndex, setMobileSourceIndex] = useState(0);
  const [mobileLoading, setMobileLoading] = useState(true);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [mobileResumeTime, setMobileResumeTime] = useState(0); // Saved playback time for source/audio changes

  // Provider state for mobile player
  const [currentProvider, setCurrentProvider] = useState<'videasy' | 'vidsrc' | 'multiembed' | 'animex' | undefined>(undefined);
  const [availableProviders, setAvailableProviders] = useState<Array<'videasy' | 'vidsrc' | 'multiembed' | 'animex'>>([]);
  const [loadingProvider, setLoadingProvider] = useState(false);

  // Anime state for mobile player
  const [isAnimeContent, setIsAnimeContent] = useState(false);
  const [audioPref, setAudioPref] = useState<AnimeAudioPreference>(() => getProviderSettings().animeAudioPreference);
  const isAnimeDetectedRef = useRef(false); // Track if we've ever detected anime content

  // Listen for sync data changes and refresh preferences
  useEffect(() => {
    const handleSyncDataChanged = () => {
      console.log('[WatchPage] Sync data changed, refreshing audio preference');
      setAudioPref(getProviderSettings().animeAudioPreference);
    };

    window.addEventListener(SYNC_DATA_CHANGED_EVENT, handleSyncDataChanged);
    return () => window.removeEventListener(SYNC_DATA_CHANGED_EVENT, handleSyncDataChanged);
  }, []);

  // Debug: Log anime state changes
  useEffect(() => {
    console.log('[WatchPage] isAnimeContent changed:', isAnimeContent);
    if (isAnimeContent) {
      isAnimeDetectedRef.current = true;
    }
  }, [isAnimeContent]);

  // Fetch season data to determine next episode
  const fetchNextEpisodeInfo = useCallback(async () => {
    if (mediaType !== 'tv' || !seasonId || !episodeId) {
      setNextEpisode(null);
      return;
    }

    setIsLoadingNextEpisode(true);

    try {
      // Fetch current season data
      const seasonResponse = await fetch(
        `/api/content/season?tvId=${contentId}&seasonNumber=${seasonId}`
      );

      if (!seasonResponse.ok) {
        console.error('[WatchPage] Failed to fetch season data');
        setNextEpisode(null);
        return;
      }

      const seasonData: SeasonInfo = await seasonResponse.json();
      console.log('[WatchPage] Season data received:', {
        seasonNumber: seasonData.seasonNumber,
        episodeCount: seasonData.episodeCount,
        episodes: seasonData.episodes?.map(e => ({ num: e.episodeNumber, title: e.title }))
      });

      const currentEpisodeIndex = seasonData.episodes.findIndex(
        ep => ep.episodeNumber === episodeId
      );
      const isLastEpisodeInSeason = currentEpisodeIndex === seasonData.episodes.length - 1;
      console.log('[WatchPage] Current episode:', {
        index: currentEpisodeIndex,
        total: seasonData.episodes.length,
        episodeId,
        isLastEpisodeInSeason
      });

      // Check if there's a next episode in the current season
      if (currentEpisodeIndex !== -1 && currentEpisodeIndex < seasonData.episodes.length - 1) {
        const nextEp = seasonData.episodes[currentEpisodeIndex + 1];

        // Check if the next episode has aired (air date is in the past or today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const airDate = nextEp.airDate ? new Date(nextEp.airDate) : null;

        if (!airDate || airDate <= today) {
          setNextEpisode({
            season: seasonId,
            episode: nextEp.episodeNumber,
            title: nextEp.title || `Episode ${nextEp.episodeNumber}`,
            isNextSeason: false,
            isLastEpisode: false,
          });
          return;
        }
      }

      // Current episode is the last in the season, check for next season
      console.log('[WatchPage] Checking for next season (current is last in season or next ep not aired)');

      const detailsResponse = await fetch(
        `/api/content/details?id=${contentId}&mediaType=tv`
      );

      if (!detailsResponse.ok) {
        console.error('[WatchPage] Failed to fetch show details:', detailsResponse.status);
        setNextEpisode({
          season: seasonId,
          episode: episodeId,
          isLastEpisode: true,
        });
        return;
      }

      const detailsData = await detailsResponse.json();
      const showDetails: ShowInfo = detailsData.data || detailsData;
      console.log('[WatchPage] Show details received:', {
        totalSeasons: showDetails.seasons?.length,
        seasons: showDetails.seasons?.map(s => ({ num: s.seasonNumber, eps: s.episodeCount }))
      });

      const regularSeasons = showDetails.seasons
        .filter(s => s.seasonNumber > 0)
        .sort((a, b) => a.seasonNumber - b.seasonNumber);

      const currentSeasonIndex = regularSeasons.findIndex(
        s => s.seasonNumber === seasonId
      );

      console.log('[WatchPage] Checking for next season. Current season index:', currentSeasonIndex, 'Total seasons:', regularSeasons.length);

      if (currentSeasonIndex !== -1 && currentSeasonIndex < regularSeasons.length - 1) {
        const nextSeasonNum = regularSeasons[currentSeasonIndex + 1].seasonNumber;
        console.log('[WatchPage] Found next season:', nextSeasonNum);

        const nextSeasonResponse = await fetch(
          `/api/content/season?tvId=${contentId}&seasonNumber=${nextSeasonNum}`
        );

        if (nextSeasonResponse.ok) {
          const nextSeasonData: SeasonInfo = await nextSeasonResponse.json();
          console.log('[WatchPage] Next season data:', {
            seasonNumber: nextSeasonData.seasonNumber,
            episodeCount: nextSeasonData.episodeCount,
            episodes: nextSeasonData.episodes?.map(e => ({ num: e.episodeNumber, title: e.title, airDate: e.airDate }))
          });

          if (nextSeasonData.episodes && nextSeasonData.episodes.length > 0) {
            const firstEp = nextSeasonData.episodes[0];

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const airDate = firstEp.airDate ? new Date(firstEp.airDate) : null;

            console.log('[WatchPage] Next season first episode:', {
              episode: firstEp.episodeNumber,
              title: firstEp.title,
              airDate: firstEp.airDate,
              parsedAirDate: airDate?.toISOString(),
              today: today.toISOString(),
              hasAired: !airDate || airDate <= today
            });

            if (!airDate || airDate <= today) {
              setNextEpisode({
                season: nextSeasonNum,
                episode: firstEp.episodeNumber,
                title: firstEp.title || `S${nextSeasonNum} E${firstEp.episodeNumber}`,
                isNextSeason: true,
                isLastEpisode: false,
              });
              return;
            } else {
              console.log('[WatchPage] Next season episode not yet aired - air date:', firstEp.airDate);
            }
          } else {
            console.log('[WatchPage] Next season has no episodes data');
          }
        } else {
          console.log('[WatchPage] Failed to fetch next season data:', nextSeasonResponse.status);
        }
      } else {
        console.log('[WatchPage] No more seasons available');
      }

      setNextEpisode({
        season: seasonId,
        episode: episodeId,
        isLastEpisode: true,
      });
    } catch (error) {
      console.error('[WatchPage] Error fetching next episode info:', error);
      setNextEpisode({
        season: seasonId,
        episode: episodeId,
        isLastEpisode: true,
      });
    } finally {
      setIsLoadingNextEpisode(false);
    }
  }, [contentId, mediaType, seasonId, episodeId]);

  // Fetch next episode info when component mounts or episode changes
  useEffect(() => {
    setNextEpisode(null);
    console.log('[WatchPage] Fetching next episode info for:', { contentId, mediaType, seasonId, episodeId });
    fetchNextEpisodeInfo();
  }, [fetchNextEpisodeInfo]);

  // Helper to check if source matches audio preference
  const sourceMatchesAudioPref = useCallback((sourceTitle: string, pref: AnimeAudioPreference): boolean => {
    const title = sourceTitle.toLowerCase();
    if (pref === 'dub') {
      return title.includes('(dub)') || title.includes('dub)') || title.includes('dubbed');
    }
    return title.includes('(sub)') || title.includes('sub)') || title.includes('subbed') ||
           (!title.includes('dub') && !title.includes('dubbed'));
  }, []);

  // Fetch stream URL for mobile player with proper provider fallback
  const fetchMobileStream = useCallback(async (_audioPreference?: AnimeAudioPreference) => {
    if (!contentId || !mediaType) {
      console.log('[WatchPage] fetchMobileStream skipped - missing contentId or mediaType');
      setMobileLoading(false);
      return;
    }

    console.log('[WatchPage] fetchMobileStream called, current isAnimeContent:', isAnimeDetectedRef.current);

    setMobileLoading(true);
    setMobileError(null);

    const timeoutId = setTimeout(() => {
      console.error('[WatchPage] Mobile stream fetch timed out after 30s');
      setMobileError('Request timed out. Please try again.');
      setMobileLoading(false);
    }, 30000);

    try {
      // Check if this is anime content (has malId) or was previously detected as anime
      if (malId || isAnimeDetectedRef.current) {
        setIsAnimeContent(true);
        isAnimeDetectedRef.current = true;
      }

      // Check provider availability first
      let providerAvailability = { videasy: true, vidsrc: true, multiembed: true, animex: true };
      try {
        const providerRes = await fetch('/api/providers');
        const providerData = await providerRes.json();
        providerAvailability = {
          videasy: providerData.providers?.videasy?.enabled ?? true,
          vidsrc: providerData.providers?.vidsrc?.enabled ?? true,
          multiembed: providerData.providers?.multiembed?.enabled ?? true,
          animex: providerData.providers?.animex?.enabled ?? true,
        };
      } catch (e) {
        console.warn('[WatchPage] Failed to fetch provider availability, using defaults');
      }

      // Build provider order respecting user's preferred order from settings
      const userSettings = getProviderSettings();
      const userOrder = userSettings.providerOrder || [];
      const disabledProviders = new Set(userSettings.disabledProviders || []);
      type WatchProvider = 'videasy' | 'vidsrc' | 'multiembed' | 'animex';
      const providerOrder: WatchProvider[] = [];

      const allKnownProviders: WatchProvider[] = ['videasy', 'vidsrc', 'multiembed', 'animex'];

      // Add providers from user's preferred order
      for (const p of userOrder) {
        const provider = p as WatchProvider;
        if (providerOrder.includes(provider)) continue;
        if (disabledProviders.has(provider)) continue;
        if (!providerAvailability[provider as keyof typeof providerAvailability]) continue;
        providerOrder.push(provider);
      }

      // Add any remaining available providers not in user's order as fallback
      for (const provider of allKnownProviders) {
        if (providerOrder.includes(provider)) continue;
        if (disabledProviders.has(provider)) continue;
        if (!providerAvailability[provider as keyof typeof providerAvailability]) continue;
        providerOrder.push(provider);
      }

      setAvailableProviders(providerOrder);

      console.log(`[WatchPage] Mobile provider order: ${providerOrder.join(' → ')}`);

      for (const provider of providerOrder) {
        try {
          console.log(`[WatchPage] Trying ${provider}...`);

          let validSources: any[] = [];

          if (provider === 'videasy' || provider === 'vidsrc' || provider === 'multiembed') {
            // VOD: use unified stream extraction API
            const params = new URLSearchParams({ tmdbId: contentId, mediaType: mediaType as string });
            if (title) params.set('title', title);
            if (seasonId) params.set('season', String(seasonId));
            if (episodeId) params.set('episode', String(episodeId));
            params.set('provider', provider);
            try {
              const res = await fetch(`/api/stream/extract?${params}`);
              const data = await res.json();
              if (data.success && data.sources?.length) {
                validSources = data.sources;
              } else {
                console.warn(`[Watch] ${provider}:`, data.error || 'No sources');
              }
            } catch (err) {
              console.warn(`[Watch] ${provider}:`, (err as Error).message);
            }
          } else if (provider === 'animex') {
            if (malId && title) {
              const { extractAnimeClient } = await import('@/app/lib/services/anime-client-extractor');
              const result = await extractAnimeClient(Number(malId), title, episodeId ? Number(episodeId) : undefined);
              validSources = result.sources.filter((s: any) => s.url && s.url.length > 0);
              if (!validSources.length && result.error) {
                console.warn('[Watch] AnimeX:', result.error);
              }
            }
          } else {
            // All other providers: use the API route
            const params = new URLSearchParams({
              tmdbId: contentId,
              type: mediaType,
              provider,
            });
            if (title) params.append('title', title);
            if (mediaType === 'tv' && seasonId && episodeId) {
              params.append('season', seasonId.toString());
              params.append('episode', episodeId.toString());
            }
            if (malId) params.append('malId', malId);
            if (malTitle) params.append('malTitle', malTitle);

            const response = await fetch(`/api/stream/extract?${params}`, { cache: 'no-store' });
            const data = await response.json();
            if (data.success && data.sources && data.sources.length > 0) {
              validSources = data.sources.filter((s: any) => s.url && s.url.length > 0);
            }
          }

          if (validSources.length > 0) {
            const sources = validSources.map((s: any) => ({
              title: s.title || s.quality || `${provider} Source`,
              url: proxySourceUrl(s),
              quality: s.quality,
              provider: provider,
              skipIntro: s.skipIntro,
              skipOutro: s.skipOutro,
            }));

            setMobileSources(sources);
            setCurrentProvider(provider);

            // Auto-select source matching audio preference for anime content
            const isAnime = !!(malId || isAnimeDetectedRef.current);
            let selectedIndex = 0;
            if (isAnime) {
              const currentPref = _audioPreference || audioPref;
              const matchingIndex = sources.findIndex((s: any) =>
                s.title && sourceMatchesAudioPref(s.title, currentPref)
              );
              if (matchingIndex >= 0) selectedIndex = matchingIndex;
            }

            setMobileStreamUrl(sources[selectedIndex].url);
            setMobileSourceIndex(selectedIndex);
            clearTimeout(timeoutId);
            setMobileLoading(false);
            console.log(`[WatchPage] ✓ Mobile stream loaded from ${provider}:`,
              sources[selectedIndex].url?.substring(0, 50),
              '');
            if (sources[selectedIndex].skipIntro || sources[selectedIndex].skipOutro) {
              console.log('[WatchPage] Skip data available:', {
                skipIntro: sources[selectedIndex].skipIntro,
                skipOutro: sources[selectedIndex].skipOutro,
              });
            }
            return;
          }
          console.log(`[WatchPage] ${provider} returned no valid sources, trying next...`);
        } catch (e) {
          console.warn(`[WatchPage] ${provider} failed:`, e);
        }
      }

      clearTimeout(timeoutId);
      setMobileError('No streams available from any provider');
      setMobileLoading(false);
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('[WatchPage] Error fetching mobile stream:', e);
      setMobileError('Failed to load video');
      setMobileLoading(false);
    }
  // Note: useMobilePlayer is intentionally NOT in dependencies to prevent refetch on orientation change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId, mediaType, seasonId, episodeId, malId, malTitle, audioPref, sourceMatchesAudioPref]);

  // Handle audio preference change for anime
  const handleAudioPrefChange = useCallback((newPref: AnimeAudioPreference, currentTime: number = 0) => {
    setMobileResumeTime(currentTime);
    console.log('[WatchPage] Audio pref change, saving time:', currentTime);

    setAudioPref(newPref);
    saveProviderSettings({ animeAudioPreference: newPref });
    fetchMobileStream(newPref);
  }, [fetchMobileStream]);

  // Handle provider change for mobile player
  const handleProviderChange = useCallback(async (provider: 'videasy' | 'vidsrc' | 'multiembed' | 'animex', currentTime: number = 0) => {
    setMobileResumeTime(currentTime);
    setLoadingProvider(true);
    console.log('[WatchPage] Provider change to:', provider, 'saving time:', currentTime);

    try {
      let validSources: any[] = [];

      if (provider === 'videasy' || provider === 'vidsrc' || provider === 'multiembed') {
        const params = new URLSearchParams({ tmdbId: contentId, mediaType: mediaType as string, provider });
        if (title) params.set('title', title);
        if (seasonId) params.set('season', String(seasonId));
        if (episodeId) params.set('episode', String(episodeId));
        try {
          const res = await fetch(`/api/stream/extract?${params}`);
          const data = await res.json();
          if (data.success && data.sources?.length) {
            validSources = data.sources;
          }
        } catch (err) { console.warn(`[Watch] ${provider}:`, (err as Error).message); }
      } else if (provider === 'animex') {
        if (malId && title) {
          const { extractAnimeClient } = await import('@/app/lib/services/anime-client-extractor');
          const result = await extractAnimeClient(Number(malId), title, episodeId ? Number(episodeId) : undefined);
          validSources = result.sources.filter((s: any) => s.url && s.url.length > 0);
          if (!validSources.length && result.error) {
            console.warn('[Watch] AnimeX:', result.error);
          }
        }
      } else {
        const params = new URLSearchParams({
          tmdbId: contentId,
          type: mediaType,
          provider,
        });
        if (mediaType === 'tv' && seasonId && episodeId) {
          params.append('season', seasonId.toString());
          params.append('episode', episodeId.toString());
        }
        if (malId) params.append('malId', malId);
        if (malTitle) params.append('malTitle', malTitle);

        const response = await fetch(`/api/stream/extract?${params}`, { cache: 'no-store' });
        const data = await response.json();
        if (data.success && data.sources && data.sources.length > 0) {
          validSources = data.sources.filter((s: any) => s.url && s.url.length > 0);
        }
      }

      if (validSources.length > 0) {
        const sources = validSources.map((s: any) => ({
          title: s.title || s.quality || `${provider} Source`,
          url: proxySourceUrl(s),
          quality: s.quality,
          provider: provider,
          skipIntro: s.skipIntro,
          skipOutro: s.skipOutro,
        }));

        setMobileSources(sources);
        setCurrentProvider(provider);

        // Auto-select source matching audio preference for anime content
        const isAnime = !!(malId || isAnimeDetectedRef.current);
        let selectedIndex = 0;
        if (isAnime) {
          const matchingIndex = sources.findIndex((s: any) =>
            s.title && sourceMatchesAudioPref(s.title, audioPref)
          );
          if (matchingIndex >= 0) selectedIndex = matchingIndex;
        }

        setMobileStreamUrl(sources[selectedIndex].url);
        setMobileSourceIndex(selectedIndex);

        console.log(`[WatchPage] ✓ Provider changed to ${provider}:`, sources[selectedIndex].url?.substring(0, 50));
      } else {
        setMobileSources([]);
        setCurrentProvider(provider);
        console.log(`[WatchPage] ${provider} returned no valid sources`);
      }
    } catch (e) {
      console.error(`[WatchPage] Provider change to ${provider} failed:`, e);
      setMobileSources([]);
      setCurrentProvider(provider);
    } finally {
      setLoadingProvider(false);
    }
  }, [contentId, mediaType, seasonId, episodeId, malId, malTitle]);

  // Fetch mobile stream when needed - only on initial mount or content change
  const hasFetchedStreamRef = useRef(false);
  const lastFetchedContentRef = useRef<string | null>(null);

  useEffect(() => {
    const contentKey = `${contentId}-${seasonId}-${episodeId}`;

    if (useMobilePlayer && lastFetchedContentRef.current !== contentKey) {
      console.log('[WatchPage] Initial mobile stream fetch for:', contentKey);
      lastFetchedContentRef.current = contentKey;
      hasFetchedStreamRef.current = false;

      setMobileStreamUrl(null);
      setMobileSources([]);
      setMobileError(null);
      setMobileLoading(true);

      fetchMobileStream();
    }
  }, [useMobilePlayer, contentId, seasonId, episodeId, fetchMobileStream]);

  // Handle mobile source change
  const handleMobileSourceChange = useCallback((index: number, currentTime: number = 0) => {
    if (index >= 0 && index < mobileSources.length) {
      setMobileResumeTime(currentTime);
      console.log('[WatchPage] Source change, saving time:', currentTime);
      setMobileSourceIndex(index);
      setMobileStreamUrl(mobileSources[index].url);
    }
  }, [mobileSources]);

  // Memoize error handler to prevent MobileVideoPlayer re-initialization on rotation
  const handleMobileError = useCallback((err: string) => {
    setMobileError(err);
  }, []);

  useEffect(() => {
    console.log('[WatchPage] nextEpisode state updated:', nextEpisode);
  }, [nextEpisode]);

  const handleBack = () => {
    if (mediaType === 'tv' && seasonId) {
      router.push(`/details/${contentId}?type=tv&season=${seasonId}`);
    } else {
      router.push(`/details/${contentId}?type=${mediaType}`);
    }
  };

  const handleNextEpisode = useCallback(() => {
    console.log('[WatchPage] handleNextEpisode called!', { nextEpisode, contentId, title, malId, malTitle });

    if (!nextEpisode || nextEpisode.isLastEpisode) {
      console.log('[WatchPage] Cannot navigate - no next episode or is last episode');
      return;
    }

    const navigateToNextEpisode = () => {
      let url = `/watch/${contentId}?type=tv&season=${nextEpisode.season}&episode=${nextEpisode.episode}&title=${encodeURIComponent(title)}&autoplay=true`;

      if (malId) {
        url += `&malId=${malId}`;
      }
      if (malTitle) {
        url += `&malTitle=${encodeURIComponent(malTitle)}`;
      }

      console.log('[WatchPage] NAVIGATING NOW to:', url);
      router.push(url);
    };

    if (document.fullscreenElement) {
      console.log('[WatchPage] Exiting fullscreen before navigation...');
      document.exitFullscreen().then(() => {
        navigateToNextEpisode();
      }).catch((err) => {
        console.log('[WatchPage] exitFullscreen failed:', err);
        navigateToNextEpisode();
      });
    } else {
      navigateToNextEpisode();
    }
  }, [contentId, nextEpisode, title, router, malId, malTitle]);

  if (!contentId || !mediaType) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Invalid Content</h2>
          <p>Missing content ID or media type.</p>
          <button onClick={handleBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (mediaType === 'tv' && (!seasonId || !episodeId)) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Invalid Episode</h2>
          <p>Missing season or episode information.</p>
          <button onClick={handleBack} className={styles.backButton}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Prepare next episode prop for VideoPlayer
  const nextEpisodeProp = nextEpisode && !nextEpisode.isLastEpisode ? {
    season: nextEpisode.season,
    episode: nextEpisode.episode,
    title: nextEpisode.title,
    isNextSeason: nextEpisode.isNextSeason,
  } : null;

  // Mobile player rendering
  if (useMobilePlayer) {
    if (mobileLoading) {
      return (
        <div className={styles.container} data-tv-skip-navigation="true">
          <div className={styles.playerWrapper}>
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Finding best source...</p>
            </div>
          </div>
        </div>
      );
    }

    if (mobileError || !mobileStreamUrl) {
      return (
        <div className={styles.container} data-tv-skip-navigation="true">
          <div className={styles.playerWrapper}>
            <div className={styles.error}>
              <h2>Playback Error</h2>
              <p>{mobileError || 'Failed to load video'}</p>
              <button onClick={() => fetchMobileStream()} className={styles.backButton}>
                Retry
              </button>
              <button onClick={handleBack} className={styles.backButton}>
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.container} data-tv-skip-navigation="true">
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2147483647,
            background: 'linear-gradient(90deg,#f062a0,#8b7cf0)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            textAlign: 'center',
            padding: '8px 12px',
            pointerEvents: 'none',
          }}
        >
          FLYX 3.0 · Watch page live · Mobile player · If you never see this banner, you are not on localhost:3000 / this repo
        </div>
        <div className={styles.playerWrapper} style={{ paddingTop: 36 }}>
          <MobileVideoPlayer
            key={`mobile-${contentId}-${seasonId}-${episodeId}-${audioPref}`}
            tmdbId={contentId}
            mediaType={mediaType}
            season={seasonId}
            episode={episodeId}
            title={title}
            streamUrl={mobileStreamUrl}
            onBack={handleBack}
            onError={handleMobileError}
            onSourceChange={handleMobileSourceChange}
            availableSources={mobileSources}
            currentSourceIndex={mobileSourceIndex}
            nextEpisode={nextEpisodeProp}
            onNextEpisode={handleNextEpisode}
            isAnime={isAnimeContent || isAnimeDetectedRef.current}
            audioPref={audioPref}
            onAudioPrefChange={handleAudioPrefChange}
            initialTime={mobileResumeTime}
            currentProvider={currentProvider}
            availableProviders={availableProviders}
            onProviderChange={handleProviderChange}
            loadingProvider={loadingProvider}
            skipIntro={mobileSources[mobileSourceIndex]?.skipIntro}
            skipOutro={mobileSources[mobileSourceIndex]?.skipOutro}
          />
        </div>
      </div>
    );
  }

  // Desktop player rendering
  return (
    <div className={styles.container} data-tv-skip-navigation="true">
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2147483647,
          background: 'linear-gradient(90deg,#00e5bf,#8b7cf0)',
          color: '#030307',
          fontWeight: 800,
          fontSize: 13,
          textAlign: 'center',
          padding: '8px 12px',
          letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
        FLYX 3.0 · Watch page live · Desktop player · If you never see this banner, you are not on localhost:3000 / this repo
      </div>
      <div className={styles.playerWrapper} style={{ paddingTop: 36 }}>
        <DesktopVideoPlayer
          key={`${contentId}-${seasonId}-${episodeId}`}
          tmdbId={contentId}
          mediaType={mediaType}
          season={seasonId}
          episode={episodeId}
          title={title}
          nextEpisode={nextEpisodeProp}
          onNextEpisode={handleNextEpisode}
          onBack={handleBack}
          autoplay={shouldAutoplay}
          malId={malId ? parseInt(malId) : undefined}
          malTitle={malTitle}
        />
      </div>
    </div>
  );
}

export default function WatchPageClient() {
  const [isAnime, setIsAnime] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIsAnime(params.has('malId'));
    }
  }, []);

  const content = (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    }>
      <WatchContent />
    </Suspense>
  );

  if (isAnime) {
    return <ExtensionGate type="anime">{content}</ExtensionGate>;
  }
  return content;
}
