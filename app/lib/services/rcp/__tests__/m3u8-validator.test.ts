/**
 * Tests for M3U8 URL Validator
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { M3U8Validator, createM3U8Validator, validateM3U8Url } from '../m3u8-validator';

describe('M3U8Validator', () => {
  let validator: M3U8Validator;
  const requestId = 'test-request-123';

  beforeEach(() => {
    validator = new M3U8Validator(requestId);
  });

  describe('Protocol Validation', () => {
    it('should accept URLs with https protocol', async () => {
      const url = 'https://example.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept URLs with http protocol', async () => {
      const url = 'http://example.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject URLs without protocol', async () => {
      const url = 'example.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('http://');
      expect(result.errorCode).toBe('M3U8_INVALID');
    });

    it('should reject URLs with invalid protocol', async () => {
      const url = 'ftp://example.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('http://');
    });
  });

  describe('Domain Validation', () => {
    it('should accept URLs with valid domain', async () => {
      const url = 'https://shadowlandschronicles.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should accept URLs with subdomains', async () => {
      const url = 'https://cdn.shadowlandschronicles.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should accept URLs with different TLDs', async () => {
      const urls = [
        'https://shadowlandschronicles.net/master.m3u8',
        'https://shadowlandschronicles.io/master.m3u8',
        'https://shadowlandschronicles.org/master.m3u8',
      ];

      for (const url of urls) {
        const result = await validator.validateQuick(url);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject URLs with invalid domain format', async () => {
      const url = 'https://invalid domain/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('M3U8_INVALID');
    });

    it('should reject URLs without domain', async () => {
      const url = 'https:///path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('hostname');
    });

    it('should reject URLs with localhost-style domains', async () => {
      const url = 'https://localhost/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('domain');
    });
  });

  describe('Extension Validation', () => {
    it('should accept URLs with .m3u8 extension', async () => {
      const url = 'https://example.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should accept URLs with .m3u8 in path', async () => {
      const url = 'https://example.com/path/video.m3u8?token=abc123';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should accept URLs with .m3u8 and query parameters', async () => {
      const url = 'https://example.com/master.m3u8?quality=1080p&token=xyz';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should reject URLs without .m3u8 extension', async () => {
      const url = 'https://example.com/path/master.mp4';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.m3u8');
      expect(result.errorCode).toBe('M3U8_INVALID');
    });

    it('should reject URLs with wrong extension', async () => {
      const url = 'https://example.com/path/master.mpd';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.m3u8');
    });
  });

  describe('Placeholder Validation', () => {
    it('should accept URLs without placeholders', async () => {
      const url = 'https://shadowlandschronicles.com/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should reject URLs with {v1} placeholder', async () => {
      const url = 'https://{v1}/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('placeholder');
      expect(result.error).toContain('{v1}');
      expect(result.errorCode).toBe('M3U8_INVALID');
    });

    it('should reject URLs with {v2} placeholder', async () => {
      const url = 'https://{v2}/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('{v2}');
    });

    it('should reject URLs with multiple placeholders', async () => {
      const url = 'https://{v1}/path/{v2}/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('placeholder');
    });

    it('should reject URLs with custom placeholders', async () => {
      const url = 'https://example.com/{cdn}/path/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('{cdn}');
    });

    it('should reject URLs with placeholder in query string', async () => {
      const url = 'https://example.com/master.m3u8?token={token}';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('placeholder');
    });
  });

  describe('Complete Validation', () => {
    it('should validate a complete valid URL', async () => {
      const url = 'https://shadowlandschronicles.com/hls/movie/12345/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should validate URLs with complex paths', async () => {
      const url = 'https://shadowlandschronicles.com/v1/hls/content/movies/2024/action/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should validate URLs with query parameters', async () => {
      const url = 'https://shadowlandschronicles.com/master.m3u8?quality=1080p&token=abc123&expires=1234567890';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should fail on first validation error', async () => {
      // Missing protocol
      const url1 = 'example.com/master.m3u8';
      const result1 = await validator.validateQuick(url1);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('http://');

      // Missing extension
      const url2 = 'https://example.com/master.mp4';
      const result2 = await validator.validateQuick(url2);
      expect(result2.valid).toBe(false);
      expect(result2.error).toContain('.m3u8');

      // Unresolved placeholder
      const url3 = 'https://{v1}/master.m3u8';
      const result3 = await validator.validateQuick(url3);
      expect(result3.valid).toBe(false);
      expect(result3.error).toContain('placeholder');
    });
  });

  describe('Availability Check', () => {
    it('should skip availability check by default', async () => {
      const url = 'https://nonexistent-domain-12345.com/master.m3u8';
      const result = await validator.validateQuick(url);
      
      // Should pass basic validation even if domain doesn't exist
      expect(result.valid).toBe(true);
    });

    it('should perform availability check when requested', async () => {
      // This will fail because the domain doesn't exist
      const url = 'https://nonexistent-domain-12345.com/master.m3u8';
      const result = await validator.validateFull(url);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Factory Functions', () => {
    it('should create validator with createM3U8Validator', () => {
      const newValidator = createM3U8Validator('test-123');
      expect(newValidator).toBeInstanceOf(M3U8Validator);
    });

    it('should validate with utility function', async () => {
      const url = 'https://example.com/master.m3u8';
      const result = await validateM3U8Url(url, 'test-456', false);
      
      expect(result.valid).toBe(true);
    });

    it('should use default requestId in utility function', async () => {
      const url = 'https://example.com/master.m3u8';
      const result = await validateM3U8Url(url);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Real-World URLs', () => {
    it('should validate typical shadowlandschronicles URLs', async () => {
      const urls = [
        'https://shadowlandschronicles.com/hls/movie/872585/master.m3u8',
        'https://shadowlandschronicles.net/content/tv/12345/s01e01/master.m3u8',
        'https://shadowlandschronicles.io/stream/master.m3u8?token=xyz',
        'https://shadowlandschronicles.org/v2/hls/master.m3u8',
      ];

      for (const url of urls) {
        const result = await validator.validateQuick(url);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject malformed real-world URLs', async () => {
      const urls = [
        'shadowlandschronicles.com/master.m3u8', // No protocol
        'https://{v1}/master.m3u8', // Unresolved placeholder
        'https://shadowlandschronicles.com/master.mp4', // Wrong extension
        'https://shadowlandschronicles/master.m3u8', // Invalid domain
      ];

      for (const url of urls) {
        const result = await validator.validateQuick(url);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty URL', async () => {
      const url = '';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
    });

    it('should handle URL with only protocol', async () => {
      const url = 'https://';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(false);
    });

    it('should handle very long URLs', async () => {
      const longPath = 'a'.repeat(1000);
      const url = `https://example.com/${longPath}/master.m3u8`;
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with special characters in path', async () => {
      const url = 'https://example.com/path%20with%20spaces/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with fragment identifier', async () => {
      const url = 'https://example.com/master.m3u8#fragment';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with port number', async () => {
      const url = 'https://example.com:8080/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });

    it('should handle URLs with authentication', async () => {
      const url = 'https://user:pass@example.com/master.m3u8';
      const result = await validator.validateQuick(url);
      
      expect(result.valid).toBe(true);
    });
  });
});
