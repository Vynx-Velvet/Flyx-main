'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import type { MediaItem, Season } from '@/types/media';
import { ParallaxContainer } from '@/components/ui/ParallaxContainer';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { FluidButton } from '@/components/ui/FluidButton';
import { ContentGrid } from '@/components/content/ContentGrid';
import { SeasonSelector } from './SeasonSelector';
import { EpisodeList } from './EpisodeList';
import styles from './DetailsPage.module.css';

// Note: Removed prefetch to avoid duplicate requests
// SimpleVideoPlayer will handle stream extraction when user clicks "Watch Now"

interface DetailsPageClientProps {
  content: MediaItem | null;
  relatedContent: MediaItem[];
  error: string | null;
}

/**
 * DetailsPageClient - Client-side details page component
 * Features:
 * - Parallax hero section with backdrop
 * - Metadata display (title, description, ratings, cast, genres)
 * - Season and episode selection for TV shows
 * - Related content recommendations
 * - Watch Now button with smooth transition
 */
export default function DetailsPageClient({
  content,
  relatedContent,
  error,
}: DetailsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get season from URL params (for returning from watch page)
  const seasonFromUrl = searchParams.get('season');
  const initialSeason = seasonFromUrl ? parseInt(seasonFromUrl) : 1;
  
  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);
  const [seasonData, setSeasonData] = useState<Season | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<Record<number, number>>({});

  // Load episodes when season changes for TV shows
  useEffect(() => {
    if (content?.mediaType === 'tv' && content.seasons && content.seasons.length > 0) {
      loadSeasonEpisodes(selectedSeason);
      loadEpisodeProgress(selectedSeason);
    }
  }, [selectedSeason, content]);

  // Load episode watch progress from localStorage and API
  const loadEpisodeProgress = async (seasonNumber: number) => {
    if (!content) return;
    
    const progressMap: Record<number, number> = {};
    
    try {
      // First, try to load from localStorage (multiple possible keys)
      const localStorageKeys = ['flyx_watch_progress', 'flyx_preferences'];
      
      for (const storageKey of localStorageKeys) {
        const stored = localStorage.getItem(storageKey);
        if (!stored) {
          console.log(`[DetailsPage] No data in ${storageKey}`);
          continue;
        }
        
        const data = JSON.parse(stored);
        // Handle both direct watchProgress and nested in preferences
        const watchProgress = storageKey === 'flyx_preferences' 
          ? (data.watchProgress || {}) 
          : data;
        
        console.log(`[DetailsPage] Found ${Object.keys(watchProgress).length} entries in ${storageKey}`);
        
        // Look for progress entries for this show and season
        // Key format: contentId_s{season}_e{episode}
        Object.entries(watchProgress).forEach(([key, value]: [string, any]) => {
          const pattern = `${content.id}_s${seasonNumber}_e`;
          if (key.startsWith(pattern)) {
            const episodeNum = parseInt(key.replace(pattern, ''));
            if (!isNaN(episodeNum)) {
              // Handle different data formats
              let progress = 0;
              if (value.completionPercentage !== undefined) {
                progress = value.completionPercentage;
              } else if (value.currentTime && value.duration && value.duration > 0) {
                progress = (value.currentTime / value.duration) * 100;
              }
              console.log(`[DetailsPage] localStorage progress for S${seasonNumber}E${episodeNum}: ${progress}%`);
              if (progress > 0) {
                progressMap[episodeNum] = Math.max(progressMap[episodeNum] || 0, progress);
              }
            }
          }
        });
      }
      
      // Also check flyx_viewing_history for completed episodes
      const historyStored = localStorage.getItem('flyx_viewing_history');
      if (historyStored) {
        const history = JSON.parse(historyStored);
        history.forEach((item: any) => {
          if (item.contentId === content.id && item.completed) {
            // Mark completed episodes as 100%
            // Note: viewing history doesn't store episode numbers directly
          }
        });
      }
      
      // Try to fetch from API for more accurate server-side data
      try {
        const userId = localStorage.getItem('flyx_user_id');
        console.log('[DetailsPage] Fetching watch sessions for userId:', userId?.substring(0, 8), 'contentId:', content.id);
        if (userId) {
          const response = await fetch(
            `/api/analytics/watch-session?userId=${userId}&contentId=${content.id}&limit=100`
          );
          if (response.ok) {
            const data = await response.json();
            console.log('[DetailsPage] Watch sessions response:', data);
            if (data.sessions && Array.isArray(data.sessions)) {
              data.sessions.forEach((session: any) => {
                // Check if this session is for the current season
                if (session.season_number === seasonNumber && session.episode_number) {
                  const episodeNum = session.episode_number;
                  const progress = session.completion_percentage || 0;
                  console.log(`[DetailsPage] Found progress for S${seasonNumber}E${episodeNum}: ${progress}%`);
                  // Use the higher progress value (local or server)
                  progressMap[episodeNum] = Math.max(progressMap[episodeNum] || 0, progress);
                }
              });
            }
          }
        }
      } catch (apiErr) {
        // API fetch failed, use localStorage data only
        console.log('Using localStorage progress only:', apiErr);
      }
      
      console.log('[DetailsPage] Final progress map:', progressMap);
      setEpisodeProgress(progressMap);
    } catch (err) {
      console.error('Error loading episode progress:', err);
    }
  };

  const loadSeasonEpisodes = async (seasonNumber: number) => {
    if (!content) return;
    
    setLoadingEpisodes(true);
    try {
      const response = await fetch(
        `/api/content/season?tvId=${content.id}&seasonNumber=${seasonNumber}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSeasonData(data);
      }
    } catch (err) {
      console.error('Error loading episodes:', err);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleWatchNow = () => {
    if (!content) return;
    
    const title = encodeURIComponent(content.title || content.name || 'Unknown');
    
    if (content.mediaType === 'movie') {
      router.push(`/watch/${content.id}?type=movie&title=${title}`);
    } else {
      // For TV shows, watch first episode of selected season
      const episode = seasonData?.episodes[0];
      if (episode) {
        router.push(
          `/watch/${content.id}?type=tv&season=${selectedSeason}&episode=${episode.episodeNumber}&title=${title}`
        );
      }
    }
  };

  const handleEpisodeSelect = (episodeNumber: number) => {
    if (!content) return;
    const title = encodeURIComponent(content.title || content.name || 'Unknown');
    router.push(
      `/watch/${content.id}?type=tv&season=${selectedSeason}&episode=${episodeNumber}&title=${title}`
    );
  };

  const handleRelatedSelect = (id: string) => {
    // Navigate to the related content's details page
    const relatedItem = relatedContent.find(item => item.id === id);
    if (relatedItem) {
      router.push(`/details/${id}?type=${relatedItem.mediaType}`);
    }
  };

  if (error && !content) {
    return (
      <div className={styles.errorContainer}>
        <GlassPanel className={styles.errorPanel}>
          <h2 className={styles.errorTitle}>Oops! Something went wrong</h2>
          <p className={styles.errorMessage}>{error}</p>
          <FluidButton onClick={() => router.push('/')} variant="primary">
            Go Home
          </FluidButton>
        </GlassPanel>
      </div>
    );
  }

  if (!content) {
    return null;
  }

  const formattedRating = (content.rating || content.vote_average || 0).toFixed(1);
  const releaseYear = content.releaseDate
    ? new Date(content.releaseDate).getFullYear()
    : 'N/A';

  const handleGoBack = () => {
    // Check if user came from search or has search in history
    if (typeof window !== 'undefined' && window.history.length > 1) {
      const referrer = document.referrer;
      if (referrer.includes('/search')) {
        router.push('/search');
      } else {
        router.back();
      }
    } else {
      router.push('/');
    }
  };

  return (
    <div className={styles.container}>
      {/* Back Navigation */}
      <div className={styles.backNavigation}>
        <motion.button
          onClick={handleGoBack}
          className={styles.backButton}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className={styles.backIcon}>
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
          <span>Back</span>
        </motion.button>
      </div>

      {/* Hero Section with Parallax Backdrop */}
      <ParallaxContainer className={styles.heroSection}>
        {/* Backdrop Image */}
        {content.backdropPath && (
          <div className={styles.backdrop}>
            <img
              src={content.backdropPath}
              alt={content.title}
              className={styles.backdropImage}
            />
            {/* Gradient overlays */}
            <div className={styles.backdropGradientTop} />
            <div className={styles.backdropGradientBottom} />
          </div>
        )}

        {/* Hero Content */}
        <div className={styles.heroContent}>
          <motion.div
            className={styles.heroInner}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Poster */}
            <div className={styles.posterContainer}>
              {content.posterPath ? (
                <img
                  src={content.posterPath}
                  alt={content.title}
                  className={styles.poster}
                />
              ) : (
                <div className={styles.posterPlaceholder}>
                  <span className={styles.posterIcon}>
                    {content.mediaType === 'movie' ? '🎬' : '📺'}
                  </span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className={styles.metadata}>
              <h1 className={styles.title}>{content.title}</h1>

              {/* Info Row */}
              <div className={styles.infoRow}>
                <span className={styles.rating}>⭐ {formattedRating}</span>
                <span className={styles.separator}>•</span>
                <span className={styles.year}>{releaseYear}</span>
                {content.runtime && (
                  <>
                    <span className={styles.separator}>•</span>
                    <span className={styles.runtime}>{content.runtime} min</span>
                  </>
                )}
                <span className={styles.separator}>•</span>
                <span className={styles.mediaType}>
                  {content.mediaType === 'movie' ? 'Movie' : 'TV Show'}
                </span>
              </div>

              {/* Genres */}
              {content.genres && content.genres.length > 0 && (
                <div className={styles.genres}>
                  {content.genres.map((genre) => (
                    <span key={genre.id} className={styles.genreTag}>
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              <p className={styles.overview}>{content.overview}</p>

              {/* Watch Now Button */}
              <div className={styles.actions}>
                <FluidButton
                  onClick={handleWatchNow}
                  variant="primary"
                  size="lg"
                  className={styles.watchButton}
                >
                  <svg
                    className={styles.playIcon}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch Now
                </FluidButton>
              </div>
            </div>
          </motion.div>
        </div>
      </ParallaxContainer>

      {/* TV Show Season/Episode Selection */}
      {content.mediaType === 'tv' && content.seasons && content.seasons.length > 0 && (
        <section className={styles.seasonsSection}>
          <GlassPanel className={styles.seasonsPanel}>
            <h2 className={styles.sectionTitle}>Episodes</h2>
            
            <SeasonSelector
              seasons={content.seasons}
              selectedSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
            />

            {loadingEpisodes ? (
              <div className={styles.loadingEpisodes}>
                <div className={styles.spinner} />
                <p>Loading episodes...</p>
              </div>
            ) : seasonData ? (
              <EpisodeList
                episodes={seasonData.episodes}
                onEpisodeSelect={handleEpisodeSelect}
                episodeProgress={episodeProgress}
              />
            ) : null}
          </GlassPanel>
        </section>
      )}

      {/* Related Content */}
      {relatedContent.length > 0 && (
        <section className={styles.relatedSection}>
          <h2 className={styles.sectionTitle}>You May Also Like</h2>
          <ContentGrid
            items={relatedContent}
            onItemSelect={handleRelatedSelect}
            layout="grid"
          />
        </section>
      )}
    </div>
  );
}
