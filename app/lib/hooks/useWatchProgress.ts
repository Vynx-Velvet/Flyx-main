/**
 * Watch Progress Hook
 * Enhanced watch progress tracking with anonymized user data
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

interface WatchProgressOptions {
  contentId?: string;
  contentType?: 'movie' | 'episode';
  contentTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  onProgress?: (time: number, duration: number) => void;
  onComplete?: () => void;
}

const SAVE_INTERVAL = 5000; // Save every 5 seconds
const MIN_WATCH_THRESHOLD = 10; // Minimum 10 seconds watched to save
const ANALYTICS_INTERVAL = 30000; // Track analytics every 30 seconds
const COMPLETION_THRESHOLD = 0.9; // Consider 90% as completed

export function useWatchProgress(options: WatchProgressOptions) {
  const {
    contentId,
    contentType,
    contentTitle,
    seasonNumber,
    episodeNumber,
    onProgress,
    onComplete
  } = options;

  const {
    trackWatchEvent,
    getWatchProgress,
    trackContentEngagement,
    updateActivity,
    updateWatchTime,
  } = useAnalytics();

  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyticsTimeRef = useRef<number>(0);
  const hasStartedRef = useRef<boolean>(false);
  const wasCompletedRef = useRef<boolean>(false);

  // Load saved progress from user tracking
  const loadProgress = useCallback((): number => {
    if (!contentId) return 0;

    try {
      const progress = getWatchProgress(contentId, seasonNumber, episodeNumber);

      if (progress) {
        // Only restore if watched within last 7 days and not completed
        const daysSince = (Date.now() - progress.lastWatched) / (1000 * 60 * 60 * 24);
        if (daysSince < 7 && !progress.completed) {
          return progress.currentTime;
        }
      }
    } catch (error) {
      console.error('Failed to load watch progress:', error);
    }

    return 0;
  }, [contentId, seasonNumber, episodeNumber, getWatchProgress]);

  // Track watch start
  const handleWatchStart = useCallback((currentTime: number, duration: number) => {
    if (!contentId || hasStartedRef.current) return;

    hasStartedRef.current = true;

    const mappedContentType = contentType === 'episode' ? 'tv' : 'movie';

    trackWatchEvent({
      contentId,
      contentType: mappedContentType,
      contentTitle,
      action: 'start',
      currentTime,
      duration,
      seasonNumber,
      episodeNumber,
    });

    trackContentEngagement(contentId, mappedContentType, 'watch_start', {
      contentTitle,
      seasonNumber,
      episodeNumber,
    });

    // Update live activity
    updateActivity({
      type: 'watching',
      contentId,
      contentTitle,
      contentType: mappedContentType,
      seasonNumber,
      episodeNumber,
      currentPosition: Math.round(currentTime),
      duration: Math.round(duration),
    });
  }, [contentId, contentType, contentTitle, seasonNumber, episodeNumber, trackWatchEvent, trackContentEngagement, updateActivity]);

  // Track watch pause
  const handleWatchPause = useCallback((currentTime: number, duration: number) => {
    if (!contentId) return;

    const mappedContentType = contentType === 'episode' ? 'tv' : 'movie';

    trackWatchEvent({
      contentId,
      contentType: mappedContentType,
      contentTitle,
      action: 'pause',
      currentTime,
      duration,
      seasonNumber,
      episodeNumber,
    });
  }, [contentId, contentType, contentTitle, seasonNumber, episodeNumber, trackWatchEvent]);

  // Track watch resume
  const handleWatchResume = useCallback((currentTime: number, duration: number) => {
    if (!contentId) return;

    const mappedContentType = contentType === 'episode' ? 'tv' : 'movie';

    trackWatchEvent({
      contentId,
      contentType: mappedContentType,
      contentTitle,
      action: 'resume',
      currentTime,
      duration,
      seasonNumber,
      episodeNumber,
    });
  }, [contentId, contentType, contentTitle, seasonNumber, episodeNumber, trackWatchEvent]);

  // Handle progress updates
  const handleProgress = useCallback((currentTime: number, duration: number) => {
    if (!contentId || duration <= 0) return;

    onProgress?.(currentTime, duration);

    // Track start if not already tracked
    if (!hasStartedRef.current) {
      handleWatchStart(currentTime, duration);
    }

    const mappedContentType = contentType === 'episode' ? 'tv' : 'movie';
    const completionPercentage = currentTime / duration;

    // Check for completion (90% threshold)
    if (completionPercentage >= COMPLETION_THRESHOLD && !wasCompletedRef.current) {
      wasCompletedRef.current = true;

      trackWatchEvent({
        contentId,
        contentType: mappedContentType,
        contentTitle,
        action: 'complete',
        currentTime,
        duration,
        seasonNumber,
        episodeNumber,
      });

      trackContentEngagement(contentId, mappedContentType, 'watch_complete', {
        seasonNumber,
        episodeNumber,
        completionPercentage: Math.round(completionPercentage * 100),
        totalWatchTime: Math.round(currentTime),
      });

      onComplete?.();
    }

    // Save progress periodically
    const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
    if (timeSinceLastSave >= SAVE_INTERVAL && currentTime >= MIN_WATCH_THRESHOLD) {
      trackWatchEvent({
        contentId,
        contentType: mappedContentType,
        contentTitle,
        action: 'progress',
        currentTime,
        duration,
        seasonNumber,
        episodeNumber,
      });

      // Update live activity with current position
      updateActivity({
        type: 'watching',
        contentId,
        contentTitle,
        contentType: mappedContentType,
        seasonNumber,
        episodeNumber,
        currentPosition: Math.round(currentTime),
        duration: Math.round(duration),
      });

      // Update enhanced watch time tracking - this is the key for accurate tracking
      updateWatchTime({
        contentId,
        contentType: mappedContentType,
        contentTitle,
        seasonNumber,
        episodeNumber,
        currentPosition: currentTime,
        duration,
        isPlaying: true,
      });

      lastSaveTimeRef.current = Date.now();
    }

    // Track analytics periodically (every 30 seconds)
    const timeSinceLastAnalytics = Date.now() - lastAnalyticsTimeRef.current;
    if (timeSinceLastAnalytics >= ANALYTICS_INTERVAL) {
      trackContentEngagement(contentId, mappedContentType, 'watch_progress', {
        currentTime: Math.round(currentTime),
        duration: Math.round(duration),
        completionPercentage: Math.round(completionPercentage * 100),
        seasonNumber,
        episodeNumber,
      });

      lastAnalyticsTimeRef.current = Date.now();
    }
  }, [
    contentId,
    contentType,
    contentTitle,
    seasonNumber,
    episodeNumber,
    onProgress,
    onComplete,
    handleWatchStart,
    trackWatchEvent,
    trackContentEngagement,
    updateActivity,
    updateWatchTime,
  ]);

  // Get current progress
  const getCurrentProgress = useCallback(() => {
    if (!contentId) return null;
    return getWatchProgress(contentId);
  }, [contentId, getWatchProgress]);

  // Mark as completed manually
  const markAsCompleted = useCallback((currentTime: number, duration: number) => {
    if (!contentId || wasCompletedRef.current) return;

    wasCompletedRef.current = true;
    const mappedContentType = contentType === 'episode' ? 'tv' : 'movie';

    trackWatchEvent({
      contentId,
      contentType: mappedContentType,
      contentTitle,
      action: 'complete',
      currentTime,
      duration,
      seasonNumber,
      episodeNumber,
    });

    trackContentEngagement(contentId, mappedContentType, 'watch_complete', {
      seasonNumber,
      episodeNumber,
      completionPercentage: Math.round((currentTime / duration) * 100),
    });

    onComplete?.();
  }, [contentId, contentType, seasonNumber, episodeNumber, trackWatchEvent, trackContentEngagement, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadProgress,
    handleProgress,
    handleWatchStart,
    handleWatchPause,
    handleWatchResume,
    getCurrentProgress,
    markAsCompleted,
  };
}
