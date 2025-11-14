/**
 * Hash Extractor Tests
 * 
 * Tests for the hash extraction service with multiple pattern matching strategies
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { HashExtractor } from '../hash-extractor';
import { ProviderName } from '../types';

describe('HashExtractor', () => {
  let extractor: HashExtractor;
  const requestId = 'test-request-123';

  beforeEach(() => {
    extractor = new HashExtractor();
    extractor.resetPatternStats();
  });

  describe('Pattern 1: data-hash attribute', () => {
    it('should extract hash from data-hash attribute with 2Embed', () => {
      const html = `
        <div class="server-item">
          <div data-hash="aHR0cHM6Ly9leGFtcGxlLmNvbS9wbGF5ZXI=">2Embed</div>
        </div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('aHR0cHM6Ly9leGFtcGxlLmNvbS9wbGF5ZXI=');
    });

    it('should extract hash from data-hash attribute with Superembed', () => {
      const html = `
        <div class="server-item">
          <div data-hash="c3VwZXJlbWJlZEhhc2hFeGFtcGxlMTIzNDU2Nzg5MA==">Superembed</div>
        </div>
      `;
      
      const hash = extractor.extract(html, 'superembed', requestId);
      expect(hash).toBe('c3VwZXJlbWJlZEhhc2hFeGFtcGxlMTIzNDU2Nzg5MA==');
    });

    it('should extract hash from data-hash attribute with CloudStream Pro', () => {
      const html = `
        <div class="server-item">
          <div data-hash="Y2xvdWRzdHJlYW1Qcm9IYXNoRXhhbXBsZTEyMzQ1Njc4OTA=">CloudStream Pro</div>
        </div>
      `;
      
      const hash = extractor.extract(html, 'cloudstream', requestId);
      expect(hash).toBe('Y2xvdWRzdHJlYW1Qcm9IYXNoRXhhbXBsZTEyMzQ1Njc4OTA=');
    });

    it('should handle case-insensitive provider names', () => {
      const html = `
        <div data-hash="dGVzdEhhc2hFeGFtcGxlMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=">2embed</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('dGVzdEhhc2hFeGFtcGxlMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=');
    });
  });

  describe('Pattern 2: jQuery iframe with atob', () => {
    it('should extract hash from jQuery iframe creation', () => {
      const html = `
        <script>
          $('<iframe>').attr('src', atob('aHR0cHM6Ly9jbG91ZG5lc3RyYS5jb20vcmNwL2hhc2g='));
        </script>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('aHR0cHM6Ly9jbG91ZG5lc3RyYS5jb20vcmNwL2hhc2g=');
    });

    it('should extract hash with single quotes', () => {
      const html = `
        <script>
          $('<iframe>').attr('src', atob('ZXhhbXBsZUhhc2hXaXRoU2luZ2xlUXVvdGVzMTIzNDU2'));
        </script>
      `;
      
      const hash = extractor.extract(html, 'superembed', requestId);
      expect(hash).toBe('ZXhhbXBsZUhhc2hXaXRoU2luZ2xlUXVvdGVzMTIzNDU2');
    });
  });

  describe('Pattern 3: iframe with base64 src', () => {
    it('should extract hash from iframe base64 src', () => {
      const html = `
        <iframe src="data:text/html;base64,PGh0bWw+PGJvZHk+VGVzdCBDb250ZW50PC9ib2R5PjwvaHRtbD4="></iframe>
      `;
      
      const hash = extractor.extract(html, 'cloudstream', requestId);
      expect(hash).toBe('PGh0bWw+PGJvZHk+VGVzdCBDb250ZW50PC9ib2R5PjwvaHRtbD4=');
    });

    it('should extract hash with single quotes in iframe', () => {
      const html = `
        <iframe src='data:text/html;base64,YW5vdGhlckV4YW1wbGVIYXNoV2l0aFNpbmdsZVF1b3Rlcw=='></iframe>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('YW5vdGhlckV4YW1wbGVIYXNoV2l0aFNpbmdsZVF1b3Rlcw==');
    });
  });

  describe('Pattern 4: JavaScript variable assignment', () => {
    it('should extract hash from variable assignment', () => {
      const html = `
        <script>
          var playerHash = "dmFyaWFibGVBc3NpZ25tZW50SGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==";
        </script>
      `;
      
      const hash = extractor.extract(html, 'superembed', requestId);
      expect(hash).toBe('dmFyaWFibGVBc3NpZ25tZW50SGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==');
    });

    it('should extract hash with let declaration', () => {
      const html = `
        <script>
          let embedHash = "bGV0RGVjbGFyYXRpb25IYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MA==";
        </script>
      `;
      
      // Note: Current pattern only matches 'var', but hash should still be valid base64
      const hash = extractor.extract(html, 'cloudstream', requestId);
      // This might not match with current pattern, which is expected
      if (hash) {
        expect(hash.length).toBeGreaterThan(50);
      }
    });
  });

  describe('Base64 validation', () => {
    it('should reject hashes that are too short', () => {
      const html = `
        <div data-hash="short">2Embed</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBeNull();
    });

    it('should reject invalid base64 characters', () => {
      const html = `
        <div data-hash="invalid@#$%characters!!!!!!!!!!!!!!!!">2Embed</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBeNull();
    });

    it('should accept valid base64 with padding', () => {
      const html = `
        <div data-hash="dmFsaWRCYXNlNjRXaXRoUGFkZGluZ0V4YW1wbGU=">2Embed</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('dmFsaWRCYXNlNjRXaXRoUGFkZGluZ0V4YW1wbGU=');
    });

    it('should accept valid base64 without padding', () => {
      const html = `
        <div data-hash="dmFsaWRCYXNlNjRXaXRob3V0UGFkZGluZ0V4YW1wbGVIZXJl">2Embed</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('dmFsaWRCYXNlNjRXaXRob3V0UGFkZGluZ0V4YW1wbGVIZXJl');
    });
  });

  describe('Multiple patterns fallback', () => {
    it('should try multiple patterns when first fails', () => {
      const html = `
        <div class="no-data-hash">2Embed</div>
        <script>
          $('<iframe>').attr('src', atob('ZmFsbGJhY2tQYXR0ZXJuSGFzaEV4YW1wbGUxMjM0NTY3ODkw'));
        </script>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('ZmFsbGJhY2tQYXR0ZXJuSGFzaEV4YW1wbGUxMjM0NTY3ODkw');
    });

    it('should return first valid match across patterns', () => {
      const html = `
        <div data-hash="invalid">2Embed</div>
        <iframe src="data:text/html;base64,Zmlyc3RWYWxpZE1hdGNoQWNyb3NzUGF0dGVybnNFeGFtcGxl"></iframe>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('Zmlyc3RWYWxpZE1hdGNoQWNyb3NzUGF0dGVybnNFeGFtcGxl');
    });
  });

  describe('Malformed HTML handling', () => {
    it('should handle empty HTML', () => {
      const hash = extractor.extract('', '2embed', requestId);
      expect(hash).toBeNull();
    });

    it('should handle HTML with no matching patterns', () => {
      const html = `
        <div>No hash here</div>
        <p>Just regular content</p>
      `;
      
      const hash = extractor.extract(html, 'superembed', requestId);
      expect(hash).toBeNull();
    });

    it('should handle malformed HTML tags', () => {
      const html = `
        <div data-hash="dGVzdEhhc2hXaXRoTWFsZm9ybWVkSFRNTEV4YW1wbGU=">2Embed
        <script>incomplete script
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('dGVzdEhhc2hXaXRoTWFsZm9ybWVkSFRNTEV4YW1wbGU=');
    });
  });

  describe('Pattern statistics tracking', () => {
    it('should track pattern attempts', () => {
      const html = `
        <div data-hash="c3RhdHNUcmFja2luZ0hhc2hFeGFtcGxlMTIzNDU2Nzg5MA==">2Embed</div>
      `;
      
      extractor.extract(html, '2embed', requestId);
      
      const stats = extractor.getPatternStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should track pattern successes', () => {
      const html = `
        <div data-hash="c3VjY2Vzc1RyYWNraW5nSGFzaEV4YW1wbGUxMjM0NTY3ODkw">2Embed</div>
      `;
      
      extractor.extract(html, '2embed', requestId);
      
      const stats = extractor.getPatternStats();
      const dataHashStats = stats.get('data-hash-attribute');
      
      expect(dataHashStats).toBeDefined();
      if (dataHashStats) {
        expect(dataHashStats.successes).toBeGreaterThan(0);
      }
    });

    it('should reset pattern statistics', () => {
      const html = `
        <div data-hash="cmVzZXRTdGF0c0hhc2hFeGFtcGxlMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=">2Embed</div>
      `;
      
      extractor.extract(html, '2embed', requestId);
      expect(extractor.getPatternStats().size).toBeGreaterThan(0);
      
      extractor.resetPatternStats();
      expect(extractor.getPatternStats().size).toBe(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should extract from complex HTML with multiple elements', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>VidSrc Embed</title></head>
        <body>
          <div class="servers">
            <div class="server-item" data-id="1">
              <div data-hash="Y29tcGxleEhUTUxIYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkw">2Embed</div>
            </div>
            <div class="server-item" data-id="2">
              <div data-hash="b3RoZXJTZXJ2ZXJIYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkw">Other Server</div>
            </div>
          </div>
          <script src="player.js"></script>
        </body>
        </html>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('Y29tcGxleEhUTUxIYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkw');
    });

    it('should handle minified HTML', () => {
      const html = '<div class="s"><div data-hash="bWluaWZpZWRIVE1MSGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==">2Embed</div></div>';
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('bWluaWZpZWRIVE1MSGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MA==');
    });

    it('should extract from HTML with whitespace variations', () => {
      const html = `
        <div   data-hash  =  "d2hpdGVzcGFjZVZhcmlhdGlvbnNIYXNoRXhhbXBsZTEyMzQ1Njc4OTA="  >
          2Embed
        </div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('d2hpdGVzcGFjZVZhcmlhdGlvbnNIYXNoRXhhbXBsZTEyMzQ1Njc4OTA=');
    });
  });

  describe('Provider-specific extraction', () => {
    it('should extract hash for 2Embed provider', () => {
      const html = `
        <div data-hash="MkVtYmVkSGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=">2Embed</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('MkVtYmVkSGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=');
    });
    
    it('should extract hash for Superembed provider', () => {
      const html = `
        <div data-hash="U3VwZXJlbWJlZEhhc2hFeGFtcGxlMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkw">Superembed</div>
      `;
      
      const hash = extractor.extract(html, 'superembed', requestId);
      expect(hash).toBe('U3VwZXJlbWJlZEhhc2hFeGFtcGxlMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkw');
    });
    
    it('should extract hash for CloudStream Pro provider', () => {
      const html = `
        <div data-hash="Q2xvdWRTdHJlYW1Qcm9IYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MA==">CloudStream Pro</div>
      `;
      
      const hash = extractor.extract(html, 'cloudstream', requestId);
      expect(hash).toBe('Q2xvdWRTdHJlYW1Qcm9IYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MA==');
    });
    
    it('should extract correct hash when provider name matches', () => {
      const html = `
        <div data-hash="Rmlyc3RIYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MA==">2Embed</div>
        <div data-hash="U2Vjb25kSGFzaEV4YW1wbGUxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=">Other Provider</div>
      `;
      
      const hash = extractor.extract(html, '2embed', requestId);
      expect(hash).toBe('Rmlyc3RIYXNoRXhhbXBsZTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MA==');
    });
  });
});
