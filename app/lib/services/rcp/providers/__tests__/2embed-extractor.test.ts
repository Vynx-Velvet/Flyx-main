/**
 * Tests for 2Embed Provider Extractor
 */

import { describe, it, expect } from 'bun:test';
import { twoEmbedExtractor } from '../index';
import { ExtractionParams } from '../../types';

describe('TwoEmbedExtractor', () => {
  const extractor = twoEmbedExtractor;

  describe('URL Construction', () => {
    it('should construct correct VidSrc URL for movies', () => {
      const params: ExtractionParams = {
        tmdbId: '278',
        type: 'movie',
      };

      // Access private method through any cast for testing
      const url = (extractor as any).constructVidSrcUrl(params);
      
      expect(url).toBe('https://vidsrc.cc/v2/embed/movie/278');
    });

    it('should construct correct VidSrc URL for TV shows', () => {
      const params: ExtractionParams = {
        tmdbId: '1396',
        type: 'tv',
        season: 1,
        episode: 1,
      };

      const url = (extractor as any).constructVidSrcUrl(params);
      
      expect(url).toBe('https://vidsrc.cc/v2/embed/tv/1396/1/1');
    });

  });

  describe('Integration', () => {
    it('should have correct provider name', () => {
      expect((extractor as any).providerName).toBe('2embed');
    });

    it('should have correct VidSrc base URL', () => {
      expect((extractor as any).vidsrcBaseUrl).toBe('https://vidsrc.cc/v2/embed');
    });
  });
});
