'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ParallaxContainer, ParallaxLayer } from '@/components/ui/ParallaxContainer';
import { FluidButton } from '@/components/ui/FluidButton';
import type { MediaItem } from '@/types/media';

export interface HeroSectionProps {
  item: MediaItem;
  onPlay?: (id: string) => void;
  onMoreInfo?: (id: string) => void;
  className?: string;
}

/**
 * HeroSection - Large featured content display with parallax effects
 * Features:
 * - Parallax backdrop image
 * - Gradient overlays for text readability
 * - Smooth animations
 * - Call-to-action buttons
 * - Responsive design
 */
export const HeroSection: React.FC<HeroSectionProps> = ({
  item,
  onPlay,
  onMoreInfo,
  className = '',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  const handlePlay = () => {
    onPlay?.(String(item.id));
  };

  const handleMoreInfo = () => {
    onMoreInfo?.(String(item.id));
  };

  // Format rating
  const rating = item.rating || item.vote_average || 0;
  const formattedRating = rating.toFixed(1);

  // Get rating color
  const getRatingColor = (rating: number) => {
    if (rating >= 7) return 'text-green-400';
    if (rating >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <ParallaxContainer
      className={`hero-section relative ${className}`}
      height="h-[70vh] md:h-[80vh]"
      enableMouseParallax={true}
      mouseStrength={15}
      ariaLabel={`Featured: ${item.title || item.name || 'Content'}`}
    >
      {/* Background layer with parallax */}
      <ParallaxLayer speed={0.5} className="absolute inset-0" zIndex={0}>
        <div className="relative w-full h-full min-h-[70vh] md:min-h-[80vh]">
          {/* Backdrop image */}
          {item.backdropPath && (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 to-blue-900/30 animate-pulse" />
              )}
              <Image
                src={item.backdropPath}
                alt={item.title || item.name || 'Hero content'}
                fill
                sizes="100vw"
                className={`object-cover transition-opacity duration-700 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setImageLoaded(true)}
                priority
              />
            </>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
        </div>
      </ParallaxLayer>

      {/* Content layer */}
      <ParallaxLayer speed={1} className="relative z-10" zIndex={10}>
        <div className="container mx-auto px-4 h-full flex items-end pb-12 md:pb-20">
          <div className="max-w-3xl space-y-6">
            {/* Media type badge */}
            <motion.div
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {item.mediaType === 'movie' ? '🎬 Movie' : '📺 TV Series'}
                </span>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              {item.title || item.name || 'Untitled'}
            </motion.h1>

            {/* Metadata */}
            <motion.div
              className="flex flex-wrap items-center gap-4 text-sm md:text-base"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className={`font-bold ${getRatingColor(rating)}`}>
                    {formattedRating}
                  </span>
                </div>
                <span className="text-gray-400">
                  ({(item.voteCount || item.vote_count || 0).toLocaleString()} votes)
                </span>
              </div>

              {/* Release year */}
              {item.releaseDate && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">
                    {new Date(item.releaseDate).getFullYear()}
                  </span>
                </>
              )}

              {/* Runtime */}
              {item.runtime && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">
                    {Math.floor(item.runtime / 60)}h {item.runtime % 60}m
                  </span>
                </>
              )}
            </motion.div>

            {/* Genres */}
            {item.genres && item.genres.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-2"
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {item.genres.slice(0, 4).map((genre) => (
                  <span
                    key={genre.id}
                    className="px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-xs text-gray-300"
                  >
                    {genre.name}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Overview */}
            <motion.p
              className="text-base md:text-lg text-gray-300 leading-relaxed line-clamp-3 max-w-2xl"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              {item.overview}
            </motion.p>

            {/* Action buttons */}
            <motion.div
              className="flex flex-wrap gap-4 pt-4"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <FluidButton
                onClick={handlePlay}
                variant="primary"
                size="lg"
                className="min-w-[140px]"
                ariaLabel={`Play ${item.title || item.name || 'content'}`}
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                Play Now
              </FluidButton>

              <FluidButton
                onClick={handleMoreInfo}
                variant="secondary"
                size="lg"
                className="min-w-[140px]"
                ariaLabel={`More information about ${item.title || item.name || 'content'}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                More Info
              </FluidButton>
            </motion.div>
          </div>
        </div>
      </ParallaxLayer>

      {/* Decorative gradient orbs */}
      <ParallaxLayer speed={0.8} className="absolute inset-0 pointer-events-none" zIndex={5}>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </ParallaxLayer>
    </ParallaxContainer>
  );
};

export default HeroSection;
