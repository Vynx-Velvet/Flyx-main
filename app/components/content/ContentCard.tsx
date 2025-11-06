'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card3D } from '@/components/ui/Card3D';
import type { MediaItem } from '@/types/media';
import { useIntersection } from '@/lib/hooks/useIntersection';

export interface ContentCardProps {
  item: MediaItem;
  onSelect?: (id: string) => void;
  priority?: boolean;
  className?: string;
}

/**
 * ContentCard - Display component for movies and TV shows
 * Features:
 * - 3D tilt effects on hover
 * - Lazy-loaded images with blur-up
 * - Rating display with visual indicator
 * - Smooth animations
 * - Intersection Observer for analytics
 */
export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onSelect,
  priority = false,
  className = '',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Intersection observer for lazy loading and analytics
  const { ref, isIntersecting } = useIntersection<HTMLDivElement>({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  const handleClick = () => {
    onSelect?.(String(item.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  // Format rating to 1 decimal place
  const rating = item.rating || item.vote_average || 0;
  const formattedRating = rating.toFixed(1);
  const ratingPercentage = (rating / 10) * 100;

  // Get rating color based on score
  const getRatingColor = (rating: number) => {
    if (rating >= 7) return 'text-green-400';
    if (rating >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div ref={ref} className={`content-card-wrapper ${className}`}>
      <Card3D
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className="h-full"
        intensity={12}
        glowColor="rgba(139, 92, 246, 0.4)"
        ariaLabel={`${item.title} - ${item.mediaType === 'movie' ? 'Movie' : 'TV Show'}`}
      >
        <div className="relative h-full overflow-hidden">
          {/* Poster Image */}
          <div className="relative aspect-[2/3] w-full bg-gray-900">
            {(isIntersecting || priority) && item.posterPath && !imageError ? (
              <>
                {/* Blur placeholder */}
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20 animate-pulse" />
                )}
                
                <Image
                  src={item.posterPath || item.poster_path || ''}
                  alt={item.title || item.name || 'Content'}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className={`object-cover transition-opacity duration-500 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  priority={priority}
                />
              </>
            ) : (
              /* Fallback for missing/error images */
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30">
                <div className="text-center p-4">
                  <div className="text-4xl mb-2">
                    {item.mediaType === 'movie' ? '🎬' : '📺'}
                  </div>
                  <p className="text-sm text-gray-400 font-medium line-clamp-2">
                    {item.title || item.name || 'Untitled'}
                  </p>
                </div>
              </div>
            )}

            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Rating badge */}
            <div className="absolute top-2 right-2 z-10">
              <motion.div
                className="relative"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                {/* Circular progress background */}
                <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${ratingPercentage} 100`}
                    className={getRatingColor(rating)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs font-bold ${getRatingColor(rating)}`}>
                    {formattedRating}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* Media type badge */}
            <div className="absolute top-2 left-2 z-10">
              <div className="px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
                <span className="text-xs font-semibold text-white uppercase">
                  {item.mediaType === 'movie' ? 'Movie' : 'TV'}
                </span>
              </div>
            </div>
          </div>

          {/* Content info */}
          <div className="p-4 space-y-2">
            <h3 className="text-base font-bold text-white line-clamp-2 leading-tight">
              {item.title || item.name || 'Untitled'}
            </h3>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              {(item.releaseDate || item.release_date || item.first_air_date) && (
                <span>{new Date(item.releaseDate || item.release_date || item.first_air_date || '').getFullYear()}</span>
              )}
              {item.genres && item.genres.length > 0 && (
                <>
                  <span>•</span>
                  <span className="line-clamp-1">
                    {item.genres.slice(0, 2).map(g => g.name).join(', ')}
                  </span>
                </>
              )}
            </div>

            {/* Overview preview */}
            {item.overview && (
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {item.overview}
              </p>
            )}
          </div>

          {/* Hover overlay with play button */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-purple-900/90 via-purple-900/50 to-transparent flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"
            initial={false}
          >
            <motion.div
              className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/40 flex items-center justify-center"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-8 h-8 text-white ml-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>
          </motion.div>
        </div>
      </Card3D>
    </div>
  );
};

export default ContentCard;
