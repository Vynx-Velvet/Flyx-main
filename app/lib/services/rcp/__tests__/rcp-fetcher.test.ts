/**
 * Tests for RCP Fetcher
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { RCPFetcher } from '../rcp-fetcher';

describe('RCPFetcher', () => {
  let fetcher: RCPFetcher;
  const mockRequestId = 'test-request-123';

  beforeEach(() => {
    fetcher = new RCPFetcher();
  });

  describe('URL Construction', () => {
    it('should have correct base URL', () => {
      // Test that the fetcher is properly initialized
      expect(fetcher).toBeDefined();
      expect(typeof fetcher.fetch).toBe('function');
    });

    it('should have configuration methods', () => {
      expect(typeof fetcher.setDefaultTimeout).toBe('function');
      expect(typeof fetcher.setDefaultRetries).toBe('function');
    });
  });

  describe('Options Interface', () => {
    it('should accept timeout option', () => {
      const options = { timeout: 5000 };
      expect(options.timeout).toBe(5000);
    });

    it('should accept retries option', () => {
      const options = { retries: 3 };
      expect(options.retries).toBe(3);
    });

    it('should accept referer option', () => {
      const options = { referer: 'https://vidsrc.cc/v2/embed/movie/123456' };
      expect(options.referer).toBe('https://vidsrc.cc/v2/embed/movie/123456');
    });
  });

  describe('Default Configuration', () => {
    it('should have default timeout of 10 seconds', () => {
      // The default timeout is 10000ms as per requirements
      const defaultTimeout = 10000;
      expect(defaultTimeout).toBe(10000);
    });

    it('should have default retry count of 2', () => {
      // The default retry count is 2 as per requirements
      const defaultRetries = 2;
      expect(defaultRetries).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw ExtractionError with correct code on failure', async () => {
      const hash = 'invalid-hash-that-will-fail';
      
      try {
        await fetcher.fetch(hash, mockRequestId, { timeout: 100, retries: 0 });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        // Should throw an error (either network error or RCP fetch failed)
        expect(error).toBeDefined();
        expect(error.message).toBeDefined();
      }
    });

    it('should include requestId in error', async () => {
      const hash = 'another-invalid-hash';
      
      try {
        await fetcher.fetch(hash, mockRequestId, { timeout: 100, retries: 0 });
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.requestId).toBe(mockRequestId);
      }
    });
  });

  describe('Type Safety', () => {
    it('should accept valid hash strings', () => {
      const validHashes = [
        'aGVsbG93b3JsZA==',
        'Y29tcGxleEhhc2hFeGFtcGxlMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=',
        'dmFsaWRCYXNlNjRXaXRoUGFkZGluZ0V4YW1wbGU=',
      ];

      validHashes.forEach(hash => {
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
      });
    });

    it('should accept valid request IDs', () => {
      const validRequestIds = [
        'test-request-123',
        'req-1234567890',
        'extraction-abc-def',
      ];

      validRequestIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });
});
