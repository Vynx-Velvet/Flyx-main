/**
 * Tests for SrcRCP Decoder Service
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { tryAllDecoders, getDecoderStats, decoders } from '../srcrcp-decoder';

describe('SrcRCP Decoder Service', () => {
  const requestId = 'test-request-123';

  describe('Caesar Cipher Decoders', () => {
    it('should decode Caesar -3 encoded text', async () => {
      // "https://" encoded with Caesar +3 becomes "kwwsv://"
      const encoded = 'kwwsv://vkdgrzodqgvfkurqlfohv.frp/sdwk/pdvwhu.p3x8';
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Caesar -3');
      expect(result?.url).toContain('http');
    });

    it('should decode Caesar +3 encoded text', async () => {
      // "https://" encoded with Caesar -3 becomes "eqqmp://"
      const encoded = 'eqqmp://pexailtxkaplzebkfzibp.zld/mxqe/lxpqbo.l3r8';
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Caesar +3');
      expect(result?.url).toContain('http');
    });

    it('should validate character ranges (A-Z, a-z)', () => {
      const shifted = decoders.caesarShift('ABC xyz 123', 3);
      expect(shifted).toBe('DEF abc 123');
      
      const shiftedBack = decoders.caesarShift('DEF abc 123', -3);
      expect(shiftedBack).toBe('ABC xyz 123');
    });

    it('should handle wrap-around for Caesar cipher', () => {
      const shifted = decoders.caesarShift('XYZ', 3);
      expect(shifted).toBe('ABC');
      
      const shiftedBack = decoders.caesarShift('ABC', -3);
      expect(shiftedBack).toBe('XYZ');
    });
  });

  describe('Base64 Decoders', () => {
    it('should decode standard Base64', async () => {
      const url = 'https://shadowlandschronicles.com/path/master.m3u8';
      const encoded = Buffer.from(url).toString('base64');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Base64');
      expect(result?.url).toBe(url);
    });

    it('should decode reversed Base64', async () => {
      const url = 'https://shadowlandschronicles.com/path/master.m3u8';
      const encoded = Buffer.from(url).toString('base64').split('').reverse().join('');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Base64 Reversed');
      expect(result?.url).toBe(url);
    });

    it('should validate Base64 before decoding', () => {
      expect(decoders.isValidBase64('aGVsbG8=')).toBe(true);
      expect(decoders.isValidBase64('aGVsbG8')).toBe(true);
      expect(decoders.isValidBase64('not-base64!')).toBe(false);
      expect(decoders.isValidBase64('aGVs bG8=')).toBe(false); // Space not allowed
    });

    it('should handle Base64 padding issues', () => {
      const withPadding = 'aGVsbG8=';
      const withoutPadding = 'aGVsbG8';
      
      expect(decoders.isValidBase64(withPadding)).toBe(true);
      expect(decoders.isValidBase64(withoutPadding)).toBe(true);
    });
  });

  describe('Hex Decoders', () => {
    it('should decode standard Hex', async () => {
      const url = 'https://test.com/file.m3u8';
      const encoded = Buffer.from(url).toString('hex');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Hex');
      expect(result?.url).toBe(url);
    });

    it('should decode Hex with g prefix', async () => {
      const url = 'https://test.com/file.m3u8';
      const encoded = 'g' + Buffer.from(url).toString('hex');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Hex with G');
      expect(result?.url).toBe(url);
    });

    it('should validate hex characters', () => {
      expect(decoders.isValidHex('48656c6c6f')).toBe(true);
      expect(decoders.isValidHex('48:65:6c:6c:6f')).toBe(true);
      expect(decoders.isValidHex('not-hex')).toBe(false);
      expect(decoders.isValidHex('48656c6c6g')).toBe(false);
    });

    it('should handle colon separators in hex strings', async () => {
      const url = 'https://test.com/file.m3u8';
      const hex = Buffer.from(url).toString('hex');
      const withColons = hex.match(/.{2}/g)?.join(':') || hex;
      const result = await tryAllDecoders(withColons, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe(url);
    });
  });

  describe('XOR Decoders', () => {
    it('should decode XOR with Div ID', async () => {
      const url = 'https://test.com/file.m3u8';
      const divId = 'myDivId123';
      
      // Encode with XOR
      const buffer = Buffer.from(url);
      const encoded = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        encoded[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      
      const result = await tryAllDecoders(encoded.toString(), divId, requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('XOR with Div ID');
      expect(result?.url).toBe(url);
    });

    it('should decode XOR with Base64-decoded data', async () => {
      const url = 'https://test.com/file.m3u8';
      const divId = 'myDivId123';
      
      // Encode with XOR then Base64
      const buffer = Buffer.from(url);
      const xored = Buffer.alloc(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      const encoded = xored.toString('base64');
      
      const result = await tryAllDecoders(encoded, divId, requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('XOR Base64');
      expect(result?.url).toBe(url);
    });

    it('should validate key length for XOR', async () => {
      const encoded = 'some-encoded-data';
      const result = await tryAllDecoders(encoded, '', requestId);
      
      // Should not use XOR decoders when divId is empty
      expect(result?.method).not.toBe('XOR with Div ID');
      expect(result?.method).not.toBe('XOR Base64');
    });

    it('should handle buffer operations safely', async () => {
      const invalidData = '\x00\x01\x02\x03';
      const divId = 'test';
      
      // Should not throw, just return null or try other decoders
      const result = await tryAllDecoders(invalidData, divId, requestId);
      
      // May succeed with other decoders or fail gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Additional Decoders', () => {
    it('should decode ROT13', async () => {
      // "https" in ROT13 is "uggcf"
      // Note: ROT13 is equivalent to Caesar 13, so it may match that decoder first
      const encoded = 'uggcf://grfg.pbz/svyr.z3h8';
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(['ROT13', 'Caesar 13']).toContain(result?.method);
      expect(result?.url).toContain('http');
    });

    it('should decode Atbash cipher', async () => {
      // Atbash: A↔Z, B↔Y, etc.
      // "https" becomes "gskkh" (h↔s, t↔g, t↔g, p↔k, s↔h)
      // But we need the full URL to contain "http" after decoding
      // Let's use a simpler test - just verify the decoder exists and works
      const url = 'https://test.com/file.m3u8';
      
      // Manually encode with Atbash
      const encoded = url.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(90 - (code - 65));
        }
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(122 - (code - 97));
        }
        return c;
      }).join('');
      
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Atbash');
      expect(result?.url).toBe(url);
    });

    it('should decode simple reverse', async () => {
      const url = 'https://test.com/file.m3u8';
      const encoded = url.split('').reverse().join('');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('Reverse');
      expect(result?.url).toBe(url);
    });

    it('should handle no-encoding passthrough', async () => {
      const url = 'https://test.com/file.m3u8';
      const result = await tryAllDecoders(url, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBe('No Encoding');
      expect(result?.url).toBe(url);
    });
  });

  describe('Decoder Orchestration', () => {
    it('should iterate through all decoders', async () => {
      const url = 'https://test.com/file.m3u8';
      const result = await tryAllDecoders(url, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.url).toContain('http');
    });

    it('should validate each decoder result contains "http"', async () => {
      const invalidData = 'no-url-here';
      const result = await tryAllDecoders(invalidData, '', requestId);
      
      // Should fail because no decoder produces a URL with "http"
      expect(result).toBeNull();
    });

    it('should return first successful decoder result with method name', async () => {
      const url = 'https://test.com/file.m3u8';
      const encoded = Buffer.from(url).toString('base64');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.method).toBeTruthy();
      expect(result?.url).toBe(url);
    });

    it('should handle decoder exceptions gracefully', async () => {
      // Malformed data that might cause exceptions
      const malformed = '\x00\x01\x02\x03\x04\x05';
      
      // Should not throw, just return null
      const result = await tryAllDecoders(malformed, '', requestId);
      expect(result).toBeDefined();
    });

    it('should track decoder success rates', async () => {
      const url = 'https://test.com/file.m3u8';
      const encoded = Buffer.from(url).toString('base64');
      
      // Run multiple times
      await tryAllDecoders(encoded, '', requestId);
      await tryAllDecoders(encoded, '', requestId);
      await tryAllDecoders(encoded, '', requestId);
      
      const stats = getDecoderStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Base64 decoder should have some successes
      const base64Stats = stats.get('Base64');
      expect(base64Stats).toBeDefined();
      expect(base64Stats?.successes).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', async () => {
      const result = await tryAllDecoders('', '', requestId);
      expect(result).toBeNull();
    });

    it('should handle very long strings', async () => {
      const longUrl = 'https://test.com/' + 'a'.repeat(10000) + '.m3u8';
      const encoded = Buffer.from(longUrl).toString('base64');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe(longUrl);
    });

    it('should handle special characters', async () => {
      const url = 'https://test.com/path?param=value&other=123#fragment.m3u8';
      const encoded = Buffer.from(url).toString('base64');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe(url);
    });

    it('should handle unicode characters', async () => {
      const url = 'https://test.com/文件.m3u8';
      const encoded = Buffer.from(url).toString('base64');
      const result = await tryAllDecoders(encoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe(url);
    });
  });

  describe('Performance', () => {
    it('should complete within reasonable time', async () => {
      const url = 'https://test.com/file.m3u8';
      const encoded = Buffer.from(url).toString('base64');
      
      const start = Date.now();
      await tryAllDecoders(encoded, '', requestId);
      const duration = Date.now() - start;
      
      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should try decoders in priority order', async () => {
      // Caesar -3 and +3 should be tried first
      const caesarEncoded = 'kwwsv://whvw.frp/iloh.p3x8';
      const result = await tryAllDecoders(caesarEncoded, '', requestId);
      
      expect(result).not.toBeNull();
      expect(['Caesar -3', 'Caesar +3']).toContain(result?.method);
    });
  });
});
