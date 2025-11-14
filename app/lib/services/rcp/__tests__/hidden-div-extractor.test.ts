/**
 * Unit tests for HiddenDivExtractor
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { HiddenDivExtractor } from '../hidden-div-extractor';
import { ProviderName } from '../types';

describe('HiddenDivExtractor', () => {
  let extractor: HiddenDivExtractor;
  const requestId = 'test-request-123';
  const provider: ProviderName = '2embed';

  beforeEach(() => {
    extractor = new HiddenDivExtractor();
    extractor.resetPatternStats();
  });

  describe('Pattern 1: display:none style', () => {
    it('should extract hidden div with display:none', () => {
      const html = `
        <html>
          <body>
            <div id="player-container">
              <div id="enc_data_123" style="display:none;">aHR0cHM6Ly9zaGFkb3dsYW5kc2Nocm9uaWNsZXMuY29tL3BhdGgvbWFzdGVyLm0zdTg=</div>
            </div>
          </body>
        </html>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('enc_data_123');
      expect(result?.encoded).toBe('aHR0cHM6Ly9zaGFkb3dsYW5kc2Nocm9uaWNsZXMuY29tL3BhdGgvbWFzdGVyLm0zdTg=');
    });

    it('should extract hidden div with display: none (with space)', () => {
      const html = `
        <div id="hidden_content" style="display: none;">ZW5jb2RlZF9kYXRhX2hlcmVfd2l0aF9sb25nX3N0cmluZw==</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('hidden_content');
      expect(result?.encoded).toBe('ZW5jb2RlZF9kYXRhX2hlcmVfd2l0aF9sb25nX3N0cmluZw==');
    });

    it('should extract hidden div with additional styles', () => {
      const html = `
        <div id="data_div" style="position:absolute;display:none;opacity:0;">dGhpc19pc19lbmNvZGVkX2RhdGFfd2l0aF9sb25nX3N0cmluZw==</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('data_div');
      expect(result?.encoded).toBe('dGhpc19pc19lbmNvZGVkX2RhdGFfd2l0aF9sb25nX3N0cmluZw==');
    });
  });

  describe('Pattern 2: style attribute first', () => {
    it('should extract when style comes before id', () => {
      const html = `
        <div style="display:none;" id="reversed_order">YmFzZTY0X2VuY29kZWRfZGF0YV93aXRoX2xvbmdfc3RyaW5n</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('reversed_order');
      expect(result?.encoded).toBe('YmFzZTY0X2VuY29kZWRfZGF0YV93aXRoX2xvbmdfc3RyaW5n');
    });
  });

  describe('Pattern 3: visibility:hidden', () => {
    it('should extract hidden div with visibility:hidden', () => {
      const html = `
        <div id="invisible_div" style="visibility:hidden;">aGV4X2VuY29kZWRfZGF0YV93aXRoX2xvbmdfc3RyaW5n</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('invisible_div');
      expect(result?.encoded).toBe('aGV4X2VuY29kZWRfZGF0YV93aXRoX2xvbmdfc3RyaW5n');
    });
  });

  describe('Pattern 4: hidden class', () => {
    it('should extract div with hidden class', () => {
      const html = `
        <div id="class_hidden" class="hidden">c29tZV9lbmNvZGVkX2RhdGFfd2l0aF9sb25nX3N0cmluZw==</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('class_hidden');
      expect(result?.encoded).toBe('c29tZV9lbmNvZGVkX2RhdGFfd2l0aF9sb25nX3N0cmluZw==');
    });

    it('should extract div with multiple classes including hidden', () => {
      const html = `
        <div id="multi_class" class="container hidden data-holder">ZGF0YV9lbmNvZGVkX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('multi_class');
      expect(result?.encoded).toBe('ZGF0YV9lbmNvZGVkX3dpdGhfbG9uZ19zdHJpbmc=');
    });
  });

  describe('Pattern 5: data-encoded attribute', () => {
    it('should extract from data-encoded attribute', () => {
      const html = `
        <div id="data_attr" data-encoded="ZW5jb2RlZF9pbl9hdHRyaWJ1dGVfd2l0aF9sb25nX3N0cmluZw=="></div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('data_attr');
      expect(result?.encoded).toBe('ZW5jb2RlZF9pbl9hdHRyaWJ1dGVfd2l0aF9sb25nX3N0cmluZw==');
    });
  });

  describe('Pattern 6: suspicious div (fallback)', () => {
    it('should extract div with suspicious ID and long encoded content', () => {
      const html = `
        <div id="enc_12345678">aHR0cHM6Ly9zaGFkb3dsYW5kc2Nocm9uaWNsZXMuY29tL3BhdGgvdG8vdmlkZW8vbWFzdGVyLm0zdTg=</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('enc_12345678');
      expect(result?.encoded).toBe('aHR0cHM6Ly9zaGFkb3dsYW5kc2Nocm9uaWNsZXMuY29tL3BhdGgvdG8vdmlkZW8vbWFzdGVyLm0zdTg=');
    });
  });

  describe('Hex encoded data', () => {
    it('should extract hex encoded data', () => {
      const html = `
        <div id="hex_data" style="display:none;">68747470733a2f2f736861646f776c616e64736368726f6e69636c65732e636f6d</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('hex_data');
      expect(result?.encoded).toBe('68747470733a2f2f736861646f776c616e64736368726f6e69636c65732e636f6d');
    });

    it('should extract hex with colons', () => {
      const html = `
        <div id="hex_colon" style="display:none;">68:74:74:70:73:3a:2f:2f:73:68:61:64:6f:77:6c:61:6e:64:73</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('hex_colon');
      expect(result?.encoded).toBe('68:74:74:70:73:3a:2f:2f:73:68:61:64:6f:77:6c:61:6e:64:73');
    });
  });

  describe('Multiple hidden divs', () => {
    it('should select first valid hidden div when multiple exist', () => {
      const html = `
        <div id="invalid_short" style="display:none;">abc</div>
        <div id="valid_first" style="display:none;">Zmlyc3RfdmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
        <div id="valid_second" style="display:none;">c2Vjb25kX3ZhbGlkX2VuY29kZWRfZGF0YV93aXRoX2xvbmdfc3RyaW5n</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('valid_first');
      expect(result?.encoded).toBe('Zmlyc3RfdmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=');
    });

    it('should skip invalid divs and find valid one', () => {
      const html = `
        <div id="too_short" style="display:none;">abc</div>
        <div id="has_html" style="display:none;"><span>invalid</span></div>
        <div id="valid_one" style="display:none;">dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('valid_one');
      expect(result?.encoded).toBe('dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=');
    });
  });

  describe('Validation', () => {
    it('should reject empty encoded data', () => {
      const html = `
        <div id="empty_data" style="display:none;"></div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should reject too short encoded data', () => {
      const html = `
        <div id="short_data" style="display:none;">abc123</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should reject data with HTML tags', () => {
      const html = `
        <div id="has_tags" style="display:none;"><span>aHR0cHM6Ly9leGFtcGxlLmNvbQ==</span></div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should reject whitespace-only data', () => {
      const html = `
        <div id="whitespace" style="display:none;">     </div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should reject div ID with spaces', () => {
      const html = `
        <div id="invalid id" style="display:none;">dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should reject div ID that is too short', () => {
      const html = `
        <div id="ab" style="display:none;">dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should reject encoded data with invalid characters', () => {
      const html = `
        <div id="invalid_chars" style="display:none;">this has spaces and @#$ special chars</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });
  });

  describe('Malformed HTML', () => {
    it('should handle HTML with no hidden divs', () => {
      const html = `
        <html>
          <body>
            <div id="visible">This is visible</div>
            <p>Some content</p>
          </body>
        </html>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should handle empty HTML', () => {
      const html = '';

      const result = extractor.extract(html, provider, requestId);

      expect(result).toBeNull();
    });

    it('should handle malformed div tags', () => {
      const html = `
        <div id="broken" style="display:none;>dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      const result = extractor.extract(html, provider, requestId);

      // Should still work if the pattern can match
      expect(result).toBeNull();
    });
  });

  describe('Real-world examples', () => {
    it('should extract from CloudStream-style hidden div', () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Player</title></head>
        <body>
          <div id="player"></div>
          <div id="vsrc_data_1234567890" style="display:none;">eqqmp://vkdgrzodqgvfkurqlfohv.frp/sdwk/wr/ylghr/pdvwhu.p3x8</div>
          <script src="/player.js"></script>
        </body>
        </html>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('vsrc_data_1234567890');
      expect(result?.encoded).toBe('eqqmp://vkdgrzodqgvfkurqlfohv.frp/sdwk/wr/ylghr/pdvwhu.p3x8');
    });

    it('should extract from 2Embed-style hidden div', () => {
      const html = `
        <div class="player-container">
          <div id="enc_2embed_abc123" style="position:absolute;left:-9999px;display:none;">aHR0cHM6Ly97djF9L3BhdGgvdG8vdmlkZW8vbWFzdGVyLm0zdTg=</div>
        </div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('enc_2embed_abc123');
      expect(result?.encoded).toBe('aHR0cHM6Ly97djF9L3BhdGgvdG8vdmlkZW8vbWFzdGVyLm0zdTg=');
    });

    it('should extract from Superembed-style hidden div', () => {
      const html = `
        <div id="superembed_player">
          <div id="data_se_xyz789" class="hidden">68747470733a2f2f7b76327d2f706174682f746f2f766964656f2f6d61737465722e6d337538</div>
        </div>
      `;

      const result = extractor.extract(html, provider, requestId);

      expect(result).not.toBeNull();
      expect(result?.divId).toBe('data_se_xyz789');
      expect(result?.encoded).toBe('68747470733a2f2f7b76327d2f706174682f746f2f766964656f2f6d61737465722e6d337538');
    });
  });

  describe('Pattern statistics', () => {
    it('should track pattern attempts and successes', () => {
      const html = `
        <div id="test_div" style="display:none;">dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      extractor.extract(html, provider, requestId);

      const stats = extractor.getPatternStats();
      expect(stats.size).toBeGreaterThan(0);

      // At least one pattern should have been attempted
      let totalAttempts = 0;
      let totalSuccesses = 0;
      stats.forEach(stat => {
        totalAttempts += stat.attempts;
        totalSuccesses += stat.successes;
      });

      expect(totalAttempts).toBeGreaterThan(0);
      expect(totalSuccesses).toBe(1);
    });

    it('should reset pattern statistics', () => {
      const html = `
        <div id="test_div" style="display:none;">dmFsaWRfZW5jb2RlZF9kYXRhX3dpdGhfbG9uZ19zdHJpbmc=</div>
      `;

      extractor.extract(html, provider, requestId);
      extractor.resetPatternStats();

      const stats = extractor.getPatternStats();
      expect(stats.size).toBe(0);
    });
  });
});
