'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { MediaItem } from '@/types/media';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { PageTransition } from '@/components/layout/PageTransition';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';

interface HomePageClientProps {
  heroContent: MediaItem | null;
  trendingToday: MediaItem[];
  trendingWeek: MediaItem[];
  popularMovies: MediaItem[];
  popularTV: MediaItem[];
  topRated: MediaItem[];
  actionMovies: MediaItem[];
  comedyMovies: MediaItem[];
  horrorMovies: MediaItem[];
  sciFiTV: MediaItem[];
  anime: MediaItem[];
  documentaries: MediaItem[];
  error: string | null;
}

/**
 * FlyX Homepage - The Most Stunning Landing Page Ever
 * Features immersive hero sections, smooth animations, and comprehensive analytics
 */
export default function HomePageClient({
  heroContent,
  trendingToday,
  trendingWeek: _trendingWeek,
  popularMovies,
  popularTV,
  topRated,
  actionMovies,
  comedyMovies,
  horrorMovies,
  sciFiTV,
  anime,
  documentaries,
  error,
}: HomePageClientProps) {
  const router = useRouter();
  const { trackEvent, trackPageView } = useAnalytics();

  // State management
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollY, setScrollY] = useState(0);

  // Refs
  const searchRef = useRef<HTMLInputElement>(null);

  // Hero carousel content
  const heroItems = [heroContent, ...trendingToday.slice(0, 4)].filter(Boolean) as MediaItem[];

  // Analytics tracking
  useEffect(() => {
    trackPageView('/');
    trackEvent('homepage_loaded', {
      hero_content: heroContent?.title || heroContent?.name || 'unknown',
      trending_count: trendingToday.length,
      popular_movies_count: popularMovies.length,
      popular_tv_count: popularTV.length
    });
  }, [trackPageView, trackEvent, heroContent, trendingToday.length, popularMovies.length, popularTV.length]);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hero carousel auto-rotation
  useEffect(() => {
    if (heroItems.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroItems.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [heroItems.length]);

  // Handle content interaction
  const handleContentClick = useCallback((item: MediaItem, source: string) => {
    trackEvent('content_clicked', {
      content_id: item.id,
      content_type: item.mediaType,
      content_title: item.title || item.name,
      source_section: source,
      vote_average: item.vote_average
    });
    // Store navigation origin so details page can return here with scroll position
    sessionStorage.setItem('flyx_navigation_origin', JSON.stringify({
      type: 'home',
      scrollY: window.scrollY,
      source: source,
    }));
    router.push(`/details/${item.id}?type=${item.mediaType}`);
  }, [router, trackEvent]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      trackEvent('search_initiated', {
        query: query.trim(),
        source: 'homepage'
      });
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  }, [router, trackEvent]);

  // Handle hero navigation
  const handleHeroNavigation = useCallback((direction: 'prev' | 'next') => {
    trackEvent('hero_navigation', { direction });
    if (direction === 'next') {
      setCurrentHeroIndex((prev) => (prev + 1) % heroItems.length);
    } else {
      setCurrentHeroIndex((prev) => (prev - 1 + heroItems.length) % heroItems.length);
    }
  }, [heroItems.length, trackEvent]);

  // Current hero item
  const currentHero = heroItems[currentHeroIndex];

  if (error) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-8 bg-black/20 backdrop-blur-lg rounded-2xl border border-white/10"
          >
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-2xl font-bold text-white mb-2">Oops! Something went wrong</h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
            >
              Try Again
            </button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-black overflow-hidden">
        {/* Navigation */}
        <Navigation onSearch={handleSearch} />

        {/* Immersive Hero Section */}
        {currentHero && (
          <section className="relative h-[85vh] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentHeroIndex}
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {/* Background Image with Parallax */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(https://image.tmdb.org/t/p/original${currentHero.backdrop_path || currentHero.backdropPath || ''})`,
                    transform: `translateY(${scrollY * 0.5}px)`,
                  }}
                />

                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />

                {/* Animated Particles */}
                <div className="absolute inset-0">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-1 h-1 bg-white/20 rounded-full"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        y: [-20, -100],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Hero Content */}
            <div className="relative z-10 h-full flex items-center">
              <div className="container mx-auto px-6 lg:px-8">
                <div className="max-w-4xl">
                  <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    {/* Featured Content Marquee */}
                    <div className="mb-8">
                      <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="px-3 py-1 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full text-white text-sm font-semibold">
                            NOW FEATURED
                          </div>
                          <div className="flex items-center gap-2 text-yellow-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                            <span className="text-white text-sm font-medium">
                              {(currentHero.vote_average || currentHero.rating || 0).toFixed(1)} / 10
                            </span>
                          </div>
                        </div>

                        {/* Animated Title Marquee */}
                        <div className="relative overflow-hidden mb-4">
                          <motion.h1
                            key={currentHeroIndex}
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight"
                          >
                            {currentHero.title || currentHero.name || 'Featured Content'}
                          </motion.h1>
                        </div>

                        {/* Description with fade animation */}
                        <motion.div
                          key={`desc-${currentHeroIndex}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.6, delay: 0.3 }}
                          className="mb-6"
                        >
                          <p className="text-lg md:text-xl text-gray-300 max-w-3xl leading-relaxed line-clamp-3">
                            {currentHero.overview || 'Experience premium entertainment with stunning visuals and immersive storytelling that will captivate your imagination.'}
                          </p>
                        </motion.div>
                      </motion.div>
                    </div>

                    {/* Brand Title */}
                    <div className="mb-8">
                      <h2 className="text-2xl md:text-3xl font-bold text-white/60 mb-2">
                        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                          FlyX
                        </span>
                        <span className="text-white/40 ml-2">Stream Beyond</span>
                      </h2>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-12">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleContentClick(currentHero, 'hero_play')}
                        className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full text-lg shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 flex items-center justify-center gap-3"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch Now
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleContentClick(currentHero, 'hero_info')}
                        className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-full text-lg border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center justify-center gap-3"
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                        More Info
                      </motion.button>
                    </div>

                    {/* Featured Content Info */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="flex items-center gap-6 text-sm text-gray-400"
                    >
                      <span className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {(currentHero.vote_average || currentHero.rating || 0).toFixed(1)}
                      </span>
                      <span>{new Date(currentHero.release_date || currentHero.first_air_date || currentHero.releaseDate || '').getFullYear()}</span>
                      <span className="px-2 py-1 bg-white/10 rounded text-xs uppercase tracking-wide">
                        {currentHero.mediaType === 'movie' ? 'Movie' : 'TV Series'}
                      </span>
                    </motion.div>
                  </motion.div>
                </div>
              </div>

              {/* Hero Navigation */}
              {heroItems.length > 1 && (
                <div className="absolute bottom-8 right-8 flex gap-6">
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleHeroNavigation('prev')}
                    className="w-20 h-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-white/20 hover:to-white/10 transition-all duration-300 border border-white/30 shadow-2xl"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    </svg>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 10px 30px rgba(255, 255, 255, 0.2)" }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleHeroNavigation('next')}
                    className="w-20 h-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-white/20 hover:to-white/10 transition-all duration-300 border border-white/30 shadow-2xl"
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                  </motion.button>
                </div>
              )}

              {/* Hero Indicators */}
              {heroItems.length > 1 && (
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3">
                  {heroItems.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentHeroIndex(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentHeroIndex ? 'bg-white w-12' : 'bg-white/40'
                        }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Scroll Indicator */}
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute bottom-8 left-8 text-white/60"
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium">Scroll to explore</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" />
                  <path d="M19 12l-7 7-7-7" />
                </svg>
              </div>
            </motion.div>
          </section>
        )}

        {/* Main Content */}
        <main className="relative z-10 bg-gradient-to-b from-black via-gray-900 to-black">
          {/* Search Section */}
          <section className="py-20 px-6">
            <div className="container mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  What do you want to watch?
                </h2>
                <div className="max-w-2xl mx-auto relative">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                    onFocus={() => { }}
                    onBlur={() => { }}
                    placeholder="Search movies, TV shows, actors..."
                    className="w-full px-6 py-4 pl-14 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white placeholder-gray-400 text-lg focus:outline-none focus:border-purple-500 transition-all duration-300"
                  />
                  <svg
                    className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => handleSearch(searchQuery)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-300"
                    >
                      Search
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </section>

          {/* Content Sections */}
          <div className="space-y-12 mb-20">
            <ContentSection
              title="Trending Now"
              items={trendingToday}
              onItemClick={(item) => handleContentClick(item, 'trending_today')}
            />
            <ContentSection
              title="Blockbuster Movies"
              items={popularMovies}
              onItemClick={(item) => handleContentClick(item, 'popular_movies')}
            />
            <ContentSection
              title="Binge-Worthy TV"
              items={popularTV}
              onItemClick={(item) => handleContentClick(item, 'popular_tv')}
            />
            <ContentSection
              title="Critically Acclaimed"
              items={topRated}
              onItemClick={(item) => handleContentClick(item, 'top_rated')}
            />
            <ContentSection
              title="High-Octane Action"
              items={actionMovies}
              onItemClick={(item) => handleContentClick(item, 'action_movies')}
            />
            <ContentSection
              title="Laugh Out Loud"
              items={comedyMovies}
              onItemClick={(item) => handleContentClick(item, 'comedy_movies')}
            />
            <ContentSection
              title="Sci-Fi & Fantasy Worlds"
              items={sciFiTV}
              onItemClick={(item) => handleContentClick(item, 'scifi_tv')}
            />
            <ContentSection
              title="Chills & Thrills"
              items={horrorMovies}
              onItemClick={(item) => handleContentClick(item, 'horror_movies')}
            />
            <ContentSection
              title="Anime Hits"
              items={anime}
              onItemClick={(item) => handleContentClick(item, 'anime')}
            />
            <ContentSection
              title="Real Stories"
              items={documentaries}
              onItemClick={(item) => handleContentClick(item, 'documentaries')}
            />
          </div>

          {/* Explore by Genre */}
          <section className="py-20 px-6">
            <div className="container mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-4xl font-bold text-white mb-12 text-center">
                  Explore by Genre
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    {
                      name: 'Action',
                      gradient: 'from-red-500 to-orange-500',
                      icon: '⚡'
                    },
                    {
                      name: 'Comedy',
                      gradient: 'from-yellow-400 to-pink-500',
                      icon: '😂'
                    },
                    {
                      name: 'Drama',
                      gradient: 'from-purple-500 to-blue-500',
                      icon: '🎭'
                    },
                    {
                      name: 'Horror',
                      gradient: 'from-gray-800 to-red-900',
                      icon: '👻'
                    },
                    {
                      name: 'Sci-Fi',
                      gradient: 'from-cyan-500 to-blue-600',
                      icon: '🚀'
                    },
                    {
                      name: 'Romance',
                      gradient: 'from-pink-500 to-rose-500',
                      icon: '💕'
                    },
                  ].map((genre, index) => (
                    <motion.button
                      key={genre.name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => {
                        trackEvent('genre_clicked', { genre: genre.name });
                        handleSearch(genre.name);
                      }}
                      className={`relative p-6 rounded-2xl bg-gradient-to-br ${genre.gradient} text-white font-semibold text-center overflow-hidden group`}
                    >
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all duration-300" />
                      <div className="relative z-10">
                        <div className="text-3xl mb-2">{genre.icon}</div>
                        <div className="text-sm font-semibold">{genre.name}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </section>

          {/* Features Showcase */}
          <section className="py-20 px-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
            <div className="container mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center mb-16"
              >
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                  Why Choose FlyX?
                </h2>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  Experience entertainment like never before with our cutting-edge platform
                </p>
              </motion.div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 12l2 2 4-4" />
                        <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
                        <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
                        <path d="M13 12h3" />
                        <path d="M8 12H5" />
                      </svg>
                    ),
                    title: 'AI-Powered Recommendations',
                    description: 'Smart algorithms learn your preferences to suggest content you\'ll love'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                    ),
                    title: 'Lightning Fast Streaming',
                    description: 'Instant playback with adaptive quality for your connection speed'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    ),
                    title: '4K Ultra HD Quality',
                    description: 'Crystal clear picture quality with HDR support on compatible devices'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <rect x="7" y="8" width="10" height="8" rx="1" ry="1" />
                        <path d="M7 16h10" />
                        <path d="M12 8v8" />
                      </svg>
                    ),
                    title: 'Multi-Device Sync',
                    description: 'Start watching on one device, continue seamlessly on another'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18" />
                        <path d="M6 6l12 12" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    ),
                    title: 'No Ads, No Interruptions',
                    description: 'Enjoy uninterrupted viewing with zero advertisements'
                  },
                  {
                    icon: (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    ),
                    title: 'Secure & Private',
                    description: 'Your data is protected with enterprise-grade security'
                  }
                ].map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -10 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="p-8 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all duration-300"
                  >
                    <div className="text-purple-400 mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                    <p className="text-gray-300 leading-relaxed">{feature.description}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="py-20 px-6">
            <div className="container mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto"
              >
                <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
                  Ready to Start Your Journey?
                </h2>
                <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
                  Join millions of users who have already discovered the future of entertainment
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 15px 35px rgba(120, 119, 198, 0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      trackEvent('cta_clicked', { action: 'start_exploring' });
                      handleSearch('trending');
                    }}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-full text-lg shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 flex items-center gap-3"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                    Start Exploring
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: "0 10px 25px rgba(255, 255, 255, 0.1)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      trackEvent('cta_clicked', { action: 'browse_content' });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-full text-lg border border-white/20 hover:bg-white/20 transition-all duration-300 flex items-center gap-3"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6l2 13h7l4-8H9" />
                      <circle cx="9" cy="20" r="1" />
                      <circle cx="20" cy="20" r="1" />
                    </svg>
                    Browse Content
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </PageTransition>
  );
}

// Content Section Component
function ContentSection({
  title,
  items,
  onItemClick
}: {
  title: string;
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 600;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-12 px-6">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              {title.includes('Trending') && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-500">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              )}
              {title.includes('Blockbuster') && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500">
                  <path d="M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64c1.21 0 2.18-.97 2.18-2.18V4.18C22 2.97 21.03 2 19.82 2zM7 16l5-5 5 5H7z" />
                </svg>
              )}
              {title.includes('TV') && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
              )}
              {title.includes('Acclaimed') && (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-500">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              )}
              {title.includes('Action') && (
                <span className="text-3xl">⚡</span>
              )}
              {title.includes('Laugh') && (
                <span className="text-3xl">😂</span>
              )}
              {title.includes('Sci-Fi') && (
                <span className="text-3xl">🚀</span>
              )}
              {title.includes('Chills') && (
                <span className="text-3xl">👻</span>
              )}
              {title.includes('Anime') && (
                <span className="text-3xl">🎌</span>
              )}
              {title.includes('Real') && (
                <span className="text-3xl">🌍</span>
              )}
              <span>{title}</span>
            </h2>
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => scroll('left')}
                className="w-20 h-20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1, boxShadow: "0 8px 25px rgba(120, 119, 198, 0.4)" }}
                whileTap={{ scale: 0.9 }}
                onClick={() => scroll('right')}
                className="w-20 h-20 bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:from-purple-600/30 hover:to-pink-600/30 transition-all duration-300 border border-white/20 shadow-xl"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </motion.button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-8 pt-4 px-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onItemClick(item)}
                className="flex-shrink-0 w-56 md:w-64 cursor-pointer group p-2"
              >
                <motion.div
                  whileHover={{ scale: 1.05, y: -8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="relative rounded-xl bg-gray-800 shadow-2xl overflow-hidden"
                >
                  <div className="overflow-hidden rounded-xl">
                    <img
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path || item.posterPath || ''}`}
                      alt={item.title || item.name || 'Content'}
                      className="w-full h-80 md:h-96 object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="w-20 h-20 bg-gradient-to-r from-purple-600/80 to-pink-600/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/20"
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="white" strokeWidth="0">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </motion.div>
                  </div>

                  {/* Rating Badge */}
                  <div className="absolute top-4 right-4 px-3 py-2 bg-gradient-to-r from-yellow-500/90 to-orange-500/90 backdrop-blur-md rounded-full text-white text-sm font-bold flex items-center gap-2 shadow-lg border border-white/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {(item.vote_average || item.rating || 0).toFixed(1)}
                  </div>
                </motion.div>

                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">
                    {item.title || item.name || 'Untitled'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {new Date(item.release_date || item.first_air_date || item.releaseDate || '').getFullYear()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}