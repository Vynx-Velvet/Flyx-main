/**
 * Tests for Superembed Provider Extractor
 */

import { describe, it, expect } from 'bun:test';
import { superembedExtractor } from '../superembed-extractor';
import { ExtractionParams } from '../../types';

describe('SuperembedExtractor', () => {
  const extractor = superembedExtractor;

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

    it('should throw error for TV shows without season', () => {
      const params: ExtractionParams = {
        tmdbId: '1396',
        type: 'tv',
        episode: 1,
      };

      expect(() => {
        (extractor as any).constructVidSrcUrl(params);
      }).toThrow();
    });

    it('should throw error for TV shows without episode', () => {
      const params: ExtractionParams = {
        tmdbId: '1396',
        type: 'tv',
        season: 1,
      };

      expect(() => {
        (extractor as any).constructVidSrcUrl(params);
      }).toThrow();
    });
  });

  describe('Integration', () => {
    it('should have correct provider name', () => {
      expect((extractor as any).providerName).toBe('superembed');
    });

    it('should have correct VidSrc base URL', () => {
      expect((extractor as any).vidsrcBaseUrl).toBe('https://vidsrc.cc/v2/embed');
    });
  });

  describe('Error Handling', () => {
    it('should create extraction error with correct structure', () => {
      const error = (extractor as any).createError(
        'TEST_ERROR',
        'Test error message',
        'test-step',
        { detail: 'test' }
      );

      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test error message');
      expect(error.provider).toBe('superembed');
      expect(error.step).toBe('test-step');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.requestId).toBeDefined();
    });

    it('should identify extraction errors correctly', () => {
      const extractionError = {
        code: 'TEST_ERROR',
        message: 'Test',
        requestId: 'test-123',
      };

      const regularError = new Error('Regular error');

      expect((extractor as any).isExtractionError(extractionError)).toBe(true);
      expect((extractor as any).isExtractionError(regularError)).toBe(false);
      expect((extractor as any).isExtractionError(null)).toBe(false);
      expect((extractor as any).isExtractionError(undefined)).toBe(false);
    });
  });
});
