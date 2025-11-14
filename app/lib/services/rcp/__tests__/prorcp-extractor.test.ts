/**
 * Unit tests for ProRCP URL Extractor
 */

import { ProRCPExtractor } from '../prorcp-extractor';
import { ProviderName } from '../types';

describe('ProRCPExtractor', () => {
  let extractor: ProRCPExtractor;
  const mockRequestId = 'test-request-123';
  const mockProvider: ProviderName = '2embed';

  beforeEach(() => {
    extractor = new ProRCPExtractor();
    extractor.resetPatternStats();
  });

  describe('Pattern 1: jQuery iframe creation for prorcp', () => {
    it('should extract ProRCP URL from jQuery iframe pattern', () => {
      const html = `
        <script>
          $('<iframe>').attr('src', '/prorcp/aHR0cHM6Ly9leGFtcGxl');
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/aHR0cHM6Ly9leGFtcGxl');
    });

    it('should handle single quotes in jQuery pattern', () => {
      const html = `
        <script>
          $('<iframe>').attr('src', '/prorcp/dGVzdGhhc2gxMjM0NTY3ODkw');
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/dGVzdGhhc2gxMjM0NTY3ODkw');
    });

    it('should handle double quotes in jQuery pattern', () => {
      const html = `
        <script>
          $("<iframe>").attr("src", "/prorcp/YW5vdGhlcmhhc2g5ODc2NTQzMjE=");
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/YW5vdGhlcmhhc2g5ODc2NTQzMjE=');
    });
  });

  describe('Pattern 2: Direct iframe tag for prorcp', () => {
    it('should extract ProRCP URL from iframe src attribute', () => {
      const html = `
        <div>
          <iframe src="/prorcp/bXlwcm9yY3BoYXNoMTIzNDU2Nzg5MA==" width="100%" height="100%"></iframe>
        </div>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/bXlwcm9yY3BoYXNoMTIzNDU2Nzg5MA==');
    });

    it('should handle iframe with single quotes', () => {
      const html = `<iframe src='/prorcp/c2luZ2xlcXVvdGVoYXNoMTIzNDU2' frameborder='0'></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/c2luZ2xlcXVvdGVoYXNoMTIzNDU2');
    });

    it('should handle iframe with double quotes', () => {
      const html = `<iframe src="/prorcp/ZG91YmxlcXVvdGVoYXNoOTg3NjU0MzIx" frameborder="0"></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/ZG91YmxlcXVvdGVoYXNoOTg3NjU0MzIx');
    });
  });

  describe('Pattern 3: JavaScript variable for prorcp', () => {
    it('should extract ProRCP URL from var assignment', () => {
      const html = `
        <script>
          var playerUrl = "/prorcp/dmFyaWFibGVoYXNoMTIzNDU2Nzg5MA==";
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/dmFyaWFibGVoYXNoMTIzNDU2Nzg5MA==');
    });

    it('should extract ProRCP URL from let assignment', () => {
      const html = `
        <script>
          let rcpPath = "/prorcp/bGV0dmFyaWFibGVoYXNoOTg3NjU0MzIx";
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/bGV0dmFyaWFibGVoYXNoOTg3NjU0MzIx');
    });

    it('should extract ProRCP URL from const assignment', () => {
      const html = `
        <script>
          const PLAYER_SRC = "/prorcp/Y29uc3R2YXJpYWJsZWhhc2gxMjM0NTY=";
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/Y29uc3R2YXJpYWJsZWhhc2gxMjM0NTY=');
    });
  });

  describe('Pattern 4: SrcRCP variant detection', () => {
    it('should extract SrcRCP URL from iframe', () => {
      const html = `
        <iframe src="/srcrcp/c3JjcmNwaGFzaDEyMzQ1Njc4OTA=" width="100%" height="100%"></iframe>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/srcrcp/c3JjcmNwaGFzaDEyMzQ1Njc4OTA=');
    });

    it('should extract SrcRCP URL from jQuery pattern', () => {
      const html = `
        <script>
          $('<iframe>').attr('src', '/srcrcp/anF1ZXJ5c3JjcmNwaGFzaDk4NzY1NDMyMQ==');
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/srcrcp/anF1ZXJ5c3JjcmNwaGFzaDk4NzY1NDMyMQ==');
    });

    it('should extract SrcRCP URL from variable assignment', () => {
      const html = `
        <script>
          var srcRcpUrl = "/srcrcp/dmFyc3JjcmNwaGFzaDEyMzQ1Njc4OTA=";
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/srcrcp/dmFyc3JjcmNwaGFzaDEyMzQ1Njc4OTA=');
    });
  });

  describe('URL construction', () => {
    it('should construct full URL with cloudnestra.com domain', () => {
      const html = `<iframe src="/prorcp/dGVzdGhhc2g="></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toContain('https://cloudnestra.com');
      expect(result).toContain('/prorcp/');
    });

    it('should handle paths that already start with slash', () => {
      const html = `<iframe src="/prorcp/c2xhc2hoYXNo"></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/c2xhc2hoYXNo');
    });
  });

  describe('Multiple patterns in same HTML', () => {
    it('should return first valid match when multiple patterns exist', () => {
      const html = `
        <script>
          $('<iframe>').attr('src', '/prorcp/Zmlyc3RoYXNoMTIzNDU2Nzg5MA==');
        </script>
        <iframe src="/prorcp/c2Vjb25kaGFzaDk4NzY1NDMyMQ=="></iframe>
        <script>
          var url = "/prorcp/dGhpcmRoYXNoMTExMTExMTExMQ==";
        </script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      // Should return one of the valid URLs (first match found)
      expect(result).toMatch(/https:\/\/cloudnestra\.com\/prorcp\/.+/);
    });
  });

  describe('Edge cases and validation', () => {
    it('should return null when no patterns match', () => {
      const html = `
        <div>No ProRCP URLs here</div>
        <script>console.log('test');</script>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBeNull();
    });

    it('should reject paths that are too short', () => {
      const html = `<iframe src="/prorcp/abc"></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBeNull();
    });

    it('should reject paths with invalid characters', () => {
      const html = `<iframe src="/prorcp/invalid path with spaces"></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBeNull();
    });

    it('should reject paths that are too long', () => {
      const longPath = 'a'.repeat(600);
      const html = `<iframe src="/prorcp/${longPath}"></iframe>`;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBeNull();
    });

    it('should handle empty HTML', () => {
      const result = extractor.extract('', mockProvider, mockRequestId);

      expect(result).toBeNull();
    });

    it('should handle malformed HTML', () => {
      const html = `<iframe src="/prorcp/dGVzdA== width="100%">`; // Missing closing quote

      const result = extractor.extract(html, mockProvider, mockRequestId);

      // Should still work if pattern can match
      expect(result).toBeNull(); // This specific malformed HTML won't match
    });
  });

  describe('Pattern statistics tracking', () => {
    it('should track pattern attempts', () => {
      const html = `<iframe src="/prorcp/dGVzdGhhc2g="></iframe>`;

      extractor.extract(html, mockProvider, mockRequestId);

      const stats = extractor.getPatternStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should track pattern successes', () => {
      const html = `<iframe src="/prorcp/dGVzdGhhc2gxMjM0NTY3ODkw"></iframe>`;

      extractor.extract(html, mockProvider, mockRequestId);

      const stats = extractor.getPatternStats();
      let foundSuccess = false;

      stats.forEach((stat) => {
        if (stat.successes > 0) {
          foundSuccess = true;
          expect(stat.lastSuccess).toBeInstanceOf(Date);
        }
      });

      expect(foundSuccess).toBe(true);
    });

    it('should reset pattern statistics', () => {
      const html = `<iframe src="/prorcp/dGVzdGhhc2g="></iframe>`;

      extractor.extract(html, mockProvider, mockRequestId);
      extractor.resetPatternStats();

      const stats = extractor.getPatternStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Real-world HTML examples', () => {
    it('should extract from CloudNestra RCP page with jQuery', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>RCP</title></head>
        <body>
          <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
          <script>
            $(document).ready(function() {
              $('<iframe>').attr('src', '/prorcp/aHR0cHM6Ly9jbG91ZG5lc3RyYS5jb20vcHJvcmNwL3Rlc3Q=').appendTo('body');
            });
          </script>
        </body>
        </html>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/aHR0cHM6Ly9jbG91ZG5lc3RyYS5jb20vcHJvcmNwL3Rlc3Q=');
    });

    it('should extract from CloudNestra RCP page with direct iframe', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <div id="player-container">
            <iframe 
              src="/prorcp/ZGlyZWN0aWZyYW1ldGVzdGhhc2gxMjM0NTY3ODkw" 
              width="100%" 
              height="500" 
              frameborder="0" 
              allowfullscreen>
            </iframe>
          </div>
        </body>
        </html>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/ZGlyZWN0aWZyYW1ldGVzdGhhc2gxMjM0NTY3ODkw');
    });

    it('should extract from CloudNestra RCP page with SrcRCP variant', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            var playerConfig = {
              url: "/srcrcp/c3JjcmNwdmFyaWFudHRlc3RoYXNoOTg3NjU0MzIx"
            };
          </script>
        </body>
        </html>
      `;

      const result = extractor.extract(html, mockProvider, mockRequestId);

      expect(result).toBe('https://cloudnestra.com/srcrcp/c3JjcmNwdmFyaWFudHRlc3RoYXNoOTg3NjU0MzIx');
    });
  });

  describe('Different provider contexts', () => {
    it('should work with 2embed provider', () => {
      const html = `<iframe src="/prorcp/MmVtYmVkdGVzdGhhc2gxMjM0NTY3ODkw"></iframe>`;

      const result = extractor.extract(html, '2embed', mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/MmVtYmVkdGVzdGhhc2gxMjM0NTY3ODkw');
    });

    it('should work with superembed provider', () => {
      const html = `<iframe src="/prorcp/c3VwZXJlbWJlZHRlc3RoYXNoOTg3NjU0MzIx"></iframe>`;

      const result = extractor.extract(html, 'superembed', mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/c3VwZXJlbWJlZHRlc3RoYXNoOTg3NjU0MzIx');
    });

    it('should work with cloudstream provider', () => {
      const html = `<iframe src="/prorcp/Y2xvdWRzdHJlYW10ZXN0aGFzaDExMTExMTExMTE="></iframe>`;

      const result = extractor.extract(html, 'cloudstream', mockRequestId);

      expect(result).toBe('https://cloudnestra.com/prorcp/Y2xvdWRzdHJlYW10ZXN0aGFzaDExMTExMTExMTE=');
    });
  });
});
