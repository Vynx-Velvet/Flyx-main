/**
 * Tests for PlaceholderResolver
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { PlaceholderResolver, resolvePlaceholders } from '../placeholder-resolver';

describe('PlaceholderResolver', () => {
  let resolver: PlaceholderResolver;
  const requestId = 'test-request-123';

  beforeEach(() => {
    resolver = new PlaceholderResolver(requestId);
  });

  describe('resolve', () => {
    it('should resolve {v1} placeholder', () => {
      const url = 'https://{v1}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/master.m3u8');
    });

    it('should resolve {v2} placeholder', () => {
      const url = 'https://{v2}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.net/path/master.m3u8');
    });

    it('should resolve {v3} placeholder', () => {
      const url = 'https://{v3}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.io/path/master.m3u8');
    });

    it('should resolve {v4} placeholder', () => {
      const url = 'https://{v4}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.org/path/master.m3u8');
    });

    it('should resolve {v5} placeholder (fallback to v1)', () => {
      const url = 'https://{v5}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/master.m3u8');
    });

    it('should resolve multiple placeholders in sequence', () => {
      const url = 'https://{v1}/path/{v2}/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/shadowlandschronicles.net/master.m3u8');
    });

    it('should handle URLs without placeholders', () => {
      const url = 'https://example.com/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(url);
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://{v1}/path/master.m3u8?token=abc123';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/master.m3u8?token=abc123');
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://{v1}/path/master.m3u8#section';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/master.m3u8#section');
    });

    it('should handle complex paths with multiple segments', () => {
      const url = 'https://{v1}/content/movies/2024/12/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/content/movies/2024/12/master.m3u8');
    });

    it('should handle unknown placeholders gracefully', () => {
      const url = 'https://{v99}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      // Should use the placeholder content as fallback
      expect(result[0]).toBe('https://v99/path/master.m3u8');
    });

    it('should handle multiple different placeholders', () => {
      const url = 'https://{v1}/path/{v3}/file/{v2}/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/shadowlandschronicles.io/file/shadowlandschronicles.net/master.m3u8');
    });

    it('should handle same placeholder multiple times', () => {
      const url = 'https://{v1}/path/{v1}/master.m3u8';
      const result = resolver.resolve(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/shadowlandschronicles.com/master.m3u8');
    });

    it('should return array with primary URL first', () => {
      const url = 'https://{v1}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toContain('shadowlandschronicles.com');
    });
  });

  describe('hasPlaceholders', () => {
    it('should return true for URLs with placeholders', () => {
      expect(resolver.hasPlaceholders('https://{v1}/path/master.m3u8')).toBe(true);
      expect(resolver.hasPlaceholders('https://example.com/{v2}/master.m3u8')).toBe(true);
      expect(resolver.hasPlaceholders('https://{v1}/path/{v2}/master.m3u8')).toBe(true);
    });

    it('should return false for URLs without placeholders', () => {
      expect(resolver.hasPlaceholders('https://example.com/path/master.m3u8')).toBe(false);
      expect(resolver.hasPlaceholders('https://shadowlandschronicles.com/master.m3u8')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(resolver.hasPlaceholders('')).toBe(false);
    });

    it('should handle malformed placeholders', () => {
      expect(resolver.hasPlaceholders('https://example.com/{v1/master.m3u8')).toBe(false);
      expect(resolver.hasPlaceholders('https://example.com/v1}/master.m3u8')).toBe(false);
    });
  });

  describe('static methods', () => {
    it('should return all supported placeholders', () => {
      const placeholders = PlaceholderResolver.getSupportedPlaceholders();

      expect(Array.isArray(placeholders)).toBe(true);
      expect(placeholders).toContain('{v1}');
      expect(placeholders).toContain('{v2}');
      expect(placeholders).toContain('{v3}');
      expect(placeholders).toContain('{v4}');
      expect(placeholders).toContain('{v5}');
      expect(placeholders.length).toBe(5);
    });

    it('should return domains for valid placeholders', () => {
      expect(PlaceholderResolver.getDomainsForPlaceholder('{v1}')).toEqual(['shadowlandschronicles.com']);
      expect(PlaceholderResolver.getDomainsForPlaceholder('{v2}')).toEqual(['shadowlandschronicles.net']);
      expect(PlaceholderResolver.getDomainsForPlaceholder('{v3}')).toEqual(['shadowlandschronicles.io']);
      expect(PlaceholderResolver.getDomainsForPlaceholder('{v4}')).toEqual(['shadowlandschronicles.org']);
      expect(PlaceholderResolver.getDomainsForPlaceholder('{v5}')).toEqual(['shadowlandschronicles.com']);
    });

    it('should return undefined for unknown placeholders', () => {
      expect(PlaceholderResolver.getDomainsForPlaceholder('{v99}')).toBeUndefined();
      expect(PlaceholderResolver.getDomainsForPlaceholder('{unknown}')).toBeUndefined();
    });
  });

  describe('resolvePlaceholders utility function', () => {
    it('should resolve placeholders without creating instance', () => {
      const url = 'https://{v1}/path/master.m3u8';
      const result = resolvePlaceholders(url, requestId);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/master.m3u8');
    });

    it('should work without request ID', () => {
      const url = 'https://{v2}/path/master.m3u8';
      const result = resolvePlaceholders(url);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.net/path/master.m3u8');
    });

    it('should handle multiple placeholders', () => {
      const url = 'https://{v1}/path/{v3}/master.m3u8';
      const result = resolvePlaceholders(url, requestId);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://shadowlandschronicles.com/path/shadowlandschronicles.io/master.m3u8');
    });
  });

  describe('edge cases', () => {
    it('should handle URLs with special characters', () => {
      const url = 'https://{v1}/path/file%20name/master.m3u8';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://shadowlandschronicles.com/path/file%20name/master.m3u8');
    });

    it('should handle URLs with port numbers', () => {
      const url = 'https://{v1}:8080/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://shadowlandschronicles.com:8080/path/master.m3u8');
    });

    it('should handle URLs with authentication', () => {
      const url = 'https://user:pass@{v1}/path/master.m3u8';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://user:pass@shadowlandschronicles.com/path/master.m3u8');
    });

    it('should handle very long URLs', () => {
      const longPath = '/very/long/path/'.repeat(20);
      const url = `https://{v1}${longPath}master.m3u8`;
      const result = resolver.resolve(url);

      expect(result[0]).toContain('shadowlandschronicles.com');
      expect(result[0]).toContain(longPath);
    });

    it('should handle URLs with only placeholder', () => {
      const url = '{v1}';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('shadowlandschronicles.com');
    });

    it('should handle placeholder at end of URL', () => {
      const url = 'https://example.com/path/{v1}';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://example.com/path/shadowlandschronicles.com');
    });
  });

  describe('real-world scenarios', () => {
    it('should resolve typical M3U8 URL from RCP providers', () => {
      const url = 'https://{v1}/content/872585/master.m3u8';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://shadowlandschronicles.com/content/872585/master.m3u8');
    });

    it('should resolve URL with quality parameter', () => {
      const url = 'https://{v2}/content/872585/1080p/master.m3u8';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://shadowlandschronicles.net/content/872585/1080p/master.m3u8');
    });

    it('should resolve URL with token', () => {
      const url = 'https://{v3}/content/872585/master.m3u8?token=abc123&expires=1234567890';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://shadowlandschronicles.io/content/872585/master.m3u8?token=abc123&expires=1234567890');
    });

    it('should resolve URL with nested paths', () => {
      const url = 'https://{v1}/cdn/movies/2024/12/872585/hls/master.m3u8';
      const result = resolver.resolve(url);

      expect(result[0]).toBe('https://shadowlandschronicles.com/cdn/movies/2024/12/872585/hls/master.m3u8');
    });
  });
});
