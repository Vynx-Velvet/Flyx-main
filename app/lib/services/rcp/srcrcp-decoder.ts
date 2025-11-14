/**
 * SrcRCP Decoder Service
 * 
 * Decodes encoded M3U8 URLs from ProRCP/SrcRCP pages using multiple decryption methods.
 * The encoding method rotates frequently as an anti-scraping measure, so we try multiple
 * decoders in order of likelihood until one produces a valid HTTP URL.
 */

import { logger } from './logger';

/**
 * Decoder function interface
 */
export interface Decoder {
  name: string;
  fn: (encoded: string, divId: string) => string | null;
}

/**
 * Result from successful decoding
 */
export interface DecoderResult {
  url: string;           // Primary decoded URL
  method: string;        // Name of decoder that succeeded
  urls: string[];        // All URL variants (after placeholder resolution)
}

/**
 * Decoder success rate tracking
 */
interface DecoderStats {
  attempts: number;
  successes: number;
  successRate: number;
}

/**
 * Decoder registry with success rate tracking
 */
class DecoderRegistry {
  private decoders: Decoder[] = [];
  private stats: Map<string, DecoderStats> = new Map();

  /**
   * Register a decoder
   */
  register(decoder: Decoder): void {
    this.decoders.push(decoder);
    this.stats.set(decoder.name, {
      attempts: 0,
      successes: 0,
      successRate: 0,
    });
  }

  /**
   * Get all decoders ordered by priority (success rate)
   */
  getDecoders(): Decoder[] {
    // Sort by success rate (descending), but keep manual priority for equal rates
    return [...this.decoders].sort((a, b) => {
      const statsA = this.stats.get(a.name)!;
      const statsB = this.stats.get(b.name)!;
      
      // If both have attempts, sort by success rate
      if (statsA.attempts > 0 && statsB.attempts > 0) {
        return statsB.successRate - statsA.successRate;
      }
      
      // Keep original order if no stats
      return 0;
    });
  }

  /**
   * Record decoder attempt
   */
  recordAttempt(decoderName: string, success: boolean): void {
    const stats = this.stats.get(decoderName);
    if (stats) {
      stats.attempts++;
      if (success) {
        stats.successes++;
      }
      stats.successRate = stats.successes / stats.attempts;
    }
  }

  /**
   * Get decoder statistics
   */
  getStats(): Map<string, DecoderStats> {
    return new Map(this.stats);
  }
}

// Global decoder registry
const registry = new DecoderRegistry();

/**
 * Caesar cipher shift
 */
function caesarShift(text: string, shift: number): string {
  return text.split('').map(c => {
    const code = c.charCodeAt(0);
    
    // Uppercase A-Z
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    }
    
    // Lowercase a-z
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    
    // Non-alphabetic characters unchanged
    return c;
  }).join('');
}

/**
 * Validate if string is valid base64
 */
function isValidBase64(str: string): boolean {
  try {
    // Base64 pattern
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(str)) {
      return false;
    }
    
    // Try to decode
    Buffer.from(str, 'base64');
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if string is valid hex
 */
function isValidHex(str: string): boolean {
  const hexPattern = /^[0-9a-fA-F:]+$/;
  return hexPattern.test(str);
}

/**
 * Caesar -3 decoder (legacy content)
 */
const caesarMinus3Decoder: Decoder = {
  name: 'Caesar -3',
  fn: (encoded: string) => {
    try {
      return caesarShift(encoded, -3);
    } catch {
      return null;
    }
  },
};

/**
 * Caesar +3 decoder (CloudStream primary)
 */
const caesarPlus3Decoder: Decoder = {
  name: 'Caesar +3',
  fn: (encoded: string) => {
    try {
      return caesarShift(encoded, 3);
    } catch {
      return null;
    }
  },
};

/**
 * Generate all Caesar shift decoders (1-25)
 */
function generateCaesarDecoders(): Decoder[] {
  const decoders: Decoder[] = [];
  
  for (let shift = 1; shift <= 25; shift++) {
    // Skip -3 and +3 as they're already defined
    if (shift === 3) continue;
    
    decoders.push({
      name: `Caesar ${shift > 13 ? shift - 26 : shift}`,
      fn: (encoded: string) => {
        try {
          return caesarShift(encoded, shift);
        } catch {
          return null;
        }
      },
    });
  }
  
  return decoders;
}

/**
 * Standard Base64 decoder
 */
const base64Decoder: Decoder = {
  name: 'Base64',
  fn: (encoded: string) => {
    try {
      if (!isValidBase64(encoded)) {
        return null;
      }
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch {
      return null;
    }
  },
};

/**
 * Reversed Base64 decoder
 */
const base64ReversedDecoder: Decoder = {
  name: 'Base64 Reversed',
  fn: (encoded: string) => {
    try {
      const reversed = encoded.split('').reverse().join('');
      if (!isValidBase64(reversed)) {
        return null;
      }
      return Buffer.from(reversed, 'base64').toString('utf8');
    } catch {
      return null;
    }
  },
};

/**
 * Standard Hex decoder
 */
const hexDecoder: Decoder = {
  name: 'Hex',
  fn: (encoded: string) => {
    try {
      const cleaned = encoded.replace(/:/g, '');
      if (!isValidHex(cleaned)) {
        return null;
      }
      return Buffer.from(cleaned, 'hex').toString('utf8');
    } catch {
      return null;
    }
  },
};

/**
 * Hex with 'g' prefix decoder
 */
const hexWithGDecoder: Decoder = {
  name: 'Hex with G',
  fn: (encoded: string) => {
    try {
      if (!encoded.startsWith('g')) {
        return null;
      }
      const cleaned = encoded.substring(1).replace(/:/g, '');
      if (!isValidHex(cleaned)) {
        return null;
      }
      return Buffer.from(cleaned, 'hex').toString('utf8');
    } catch {
      return null;
    }
  },
};

/**
 * XOR with Div ID decoder
 */
const xorWithDivIdDecoder: Decoder = {
  name: 'XOR with Div ID',
  fn: (encoded: string, divId: string) => {
    try {
      if (!divId || divId.length === 0) {
        return null;
      }
      
      const buffer = Buffer.from(encoded);
      const xored = Buffer.alloc(buffer.length);
      
      for (let i = 0; i < buffer.length; i++) {
        xored[i] = buffer[i] ^ divId.charCodeAt(i % divId.length);
      }
      
      return xored.toString('utf8');
    } catch {
      return null;
    }
  },
};

/**
 * XOR with Base64-decoded data
 */
const xorBase64Decoder: Decoder = {
  name: 'XOR Base64',
  fn: (encoded: string, divId: string) => {
    try {
      if (!divId || divId.length === 0) {
        return null;
      }
      
      if (!isValidBase64(encoded)) {
        return null;
      }
      
      const decoded = Buffer.from(encoded, 'base64');
      const xored = Buffer.alloc(decoded.length);
      
      for (let i = 0; i < decoded.length; i++) {
        xored[i] = decoded[i] ^ divId.charCodeAt(i % divId.length);
      }
      
      return xored.toString('utf8');
    } catch {
      return null;
    }
  },
};

/**
 * ROT13 decoder
 */
const rot13Decoder: Decoder = {
  name: 'ROT13',
  fn: (encoded: string) => {
    try {
      return encoded.replace(/[a-zA-Z]/g, c => {
        const code = c.charCodeAt(0);
        const base = code >= 97 ? 97 : 65;
        return String.fromCharCode(((code - base + 13) % 26) + base);
      });
    } catch {
      return null;
    }
  },
};

/**
 * Atbash cipher decoder (reverse alphabet)
 */
const atbashDecoder: Decoder = {
  name: 'Atbash',
  fn: (encoded: string) => {
    try {
      return encoded.split('').map(c => {
        const code = c.charCodeAt(0);
        
        // Uppercase A-Z
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(90 - (code - 65));
        }
        
        // Lowercase a-z
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(122 - (code - 97));
        }
        
        return c;
      }).join('');
    } catch {
      return null;
    }
  },
};

/**
 * Simple reverse decoder
 */
const reverseDecoder: Decoder = {
  name: 'Reverse',
  fn: (encoded: string) => {
    try {
      return encoded.split('').reverse().join('');
    } catch {
      return null;
    }
  },
};

/**
 * No encoding passthrough
 */
const noEncodingDecoder: Decoder = {
  name: 'No Encoding',
  fn: (encoded: string) => {
    return encoded;
  },
};

/**
 * Initialize decoder registry with all decoders in priority order
 */
function initializeDecoders(): void {
  // Most common (try first)
  registry.register(caesarMinus3Decoder);
  registry.register(caesarPlus3Decoder);
  
  // Other Caesar shifts
  const caesarDecoders = generateCaesarDecoders();
  caesarDecoders.forEach(decoder => registry.register(decoder));
  
  // Base64 variants
  registry.register(base64Decoder);
  registry.register(base64ReversedDecoder);
  
  // Hex variants
  registry.register(hexDecoder);
  registry.register(hexWithGDecoder);
  
  // XOR variants
  registry.register(xorWithDivIdDecoder);
  registry.register(xorBase64Decoder);
  
  // Other methods
  registry.register(rot13Decoder);
  registry.register(atbashDecoder);
  registry.register(reverseDecoder);
  registry.register(noEncodingDecoder);
}

// Initialize decoders on module load
initializeDecoders();

/**
 * Try all decoders until one produces a valid HTTP URL
 */
export async function tryAllDecoders(
  encoded: string,
  divId: string,
  requestId: string
): Promise<DecoderResult | null> {
  const decoders = registry.getDecoders();
  
  logger.debug('Starting decoder attempts', {
    requestId,
    encodedLength: encoded.length,
    divId,
    decoderCount: decoders.length,
  });
  
  for (const decoder of decoders) {
    try {
      logger.debug(`Trying decoder: ${decoder.name}`, { requestId });
      
      const result = decoder.fn(encoded, divId);
      
      // Validate result contains HTTP URL
      if (result && (result.includes('http://') || result.includes('https://'))) {
        // Record success
        registry.recordAttempt(decoder.name, true);
        
        logger.info(`Decoder succeeded: ${decoder.name}`, {
          requestId,
          decodedUrl: result,
        });
        
        return {
          url: result,
          method: decoder.name,
          urls: [result], // Placeholder resolution will be done by caller
        };
      }
      
      // Record failure
      registry.recordAttempt(decoder.name, false);
      
    } catch (error) {
      // Record failure
      registry.recordAttempt(decoder.name, false);
      
      logger.debug(`Decoder failed: ${decoder.name}`, {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  logger.error('All decoders failed', {
    requestId,
    decodersTried: decoders.length,
  });
  
  return null;
}

/**
 * Get decoder statistics
 */
export function getDecoderStats(): Map<string, DecoderStats> {
  return registry.getStats();
}

/**
 * Export for testing
 */
export const decoders = {
  caesarShift,
  isValidBase64,
  isValidHex,
};
