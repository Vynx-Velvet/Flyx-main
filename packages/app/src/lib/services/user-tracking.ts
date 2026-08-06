export interface WatchProgress {
  contentId: string;
  contentType: 'movie' | 'tv';
  currentTime: number;
  duration: number;
  completionPercentage: number;
  seasonNumber?: number;
  episodeNumber?: number;
  lastWatchedAt?: number;
  title?: string;
  posterPath?: string;
  backdropPath?: string;
}
