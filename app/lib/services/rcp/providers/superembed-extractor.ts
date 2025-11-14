/**
 * Superembed Provider Extractor
 * 
 * Implements the complete extraction chain for Superembed provider:
 * 1. Construct VidSrc embed URL
 * 2. Fetch VidSrc page
 * 3. Extract Superembed hash
 * 4. Fetch CloudNestra RCP page
 * 5. Extract ProRCP URL
 * 6. Fetch ProRCP player page
 * 7. Extract hidden div with encoded data
 * 8. Decode M3U8 URL using all available methods
 * 9. Resolve placeholders to CDN domains
 * 10. Validate M3U8 URL
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 4.1, 4.2, 4.3, 4.4
 */

import { ExtractionParams, ERROR_CODES, ExtractionError, StepResult } from '../types';
import { hashExtractor } from '../hash-extractor';
import { rcpFetcher } from '../rcp-fetcher';
import { proRcpExtractor } from '../prorcp-extractor';
import { hiddenDivExtractor } from '../hidden-div-extractor';
import { tryAllDecoders } from '../srcrcp-decoder';
import { resolvePlaceholders } from '../placeholder-resolver';
import { validateM3U8Url } from '../m3u8-validator';
import { httpClient } from '../http-client';
import { logger } from '../logger';
import { generateRequestId } from '../request-id';

/**
 * Result from Superembed extraction
 */
export interface SuperembedExtractionResult {
  success: boolean;
  m3u8Url?: string;
  m3u8Urls?: string[]; // All CDN variants
  duration: number;
  steps: StepResult[];
  error?: string;
  errorCode?: string;
}

/**
 * Superembed Provider Extractor
 */
export class SuperembedExtractor {
  private readonly providerName = 'superembed' as const;
  private readonly vidsrcBaseUrl = 'https://vidsrc.cc/v2/embed';

  /**
   * Extract M3U8 URL for a movie or TV episode
   */
  async extract(params: ExtractionParams): Promise<SuperembedExtractionResult> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const steps: StepResult[] = [];

    logger.info(
      requestId,
      `Starting Superembed extraction`,
      { params },
      this.providerName,
      'extraction-start'
    );

    try {
      // Step 1: Construct VidSrc embed URL
      const vidsrcUrl = this.constructVidSrcUrl(params);
      steps.push({
        step: 'construct-vidsrc-url',
        success: true,
        duration: 0,
        data: { vidsrcUrl }
      });

      // Step 2: Fetch VidSrc embed page
      const vidsrcHtml = await this.fetchVidSrcPage(vidsrcUrl, requestId, steps);

      // Step 3: Extract Superembed hash
      const hash = await this.extractHash(vidsrcHtml, requestId, steps);

      // Step 4: Fetch CloudNestra RCP page
      const rcpHtml = await this.fetchRCPPage(hash, vidsrcUrl, requestId, steps);

      // Step 5: Extract ProRCP URL
      const proRcpUrl = await this.extractProRcpUrl(rcpHtml, requestId, steps);

      // Step 6: Fetch ProRCP player page
      const playerHtml = await this.fetchProRcpPage(proRcpUrl, requestId, steps);

      // Step 7: Extract hidden div
      const hiddenDiv = await this.extractHiddenDiv(playerHtml, requestId, steps);

      // Step 8: Decode M3U8 URL
      const decoderResult = await this.decodeM3U8(
        hiddenDiv.encoded,
        hiddenDiv.divId,
        requestId,
        steps
      );

      // Step 9: Resolve placeholders
      const m3u8Urls = await this.resolvePlaceholders(decoderResult.url, requestId, steps);

      // Step 10: Validate M3U8 URL
      await this.validateM3U8(m3u8Urls[0], requestId, steps);

      const duration = Date.now() - startTime;

      logger.info(
        requestId,
        `Superembed extraction successful`,
        { 
          m3u8Url: m3u8Urls[0],
          decoderMethod: decoderResult.method,
          cdnVariants: m3u8Urls.length
        },
        this.providerName,
        'extraction-complete',
        duration
      );

      return {
        success: true,
        m3u8Url: m3u8Urls[0],
        m3u8Urls,
        duration,
        steps,
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.isExtractionError(error)) {
        logger.error(
          requestId,
          `Superembed extraction failed: ${error.message}`,
          { 
            code: error.code,
            step: error.step,
            details: error.details
          },
          this.providerName,
          'extraction-failed',
          duration
        );

        return {
          success: false,
          duration,
          steps,
          error: error.message,
          errorCode: error.code,
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(
        requestId,
        `Superembed extraction failed with unexpected error: ${errorMessage}`,
        { error },
        this.providerName,
        'extraction-failed',
        duration
      );

      return {
        success: false,
        duration,
        steps,
        error: errorMessage,
        errorCode: ERROR_CODES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Construct VidSrc embed URL for movie or TV show
   */
  private constructVidSrcUrl(params: ExtractionParams): string {
    const { tmdbId, type, season, episode } = params;

    if (type === 'movie') {
      return `${this.vidsrcBaseUrl}/movie/${tmdbId}`;
    } else {
      if (!season || !episode) {
        throw this.createError(
          ERROR_CODES.HASH_NOT_FOUND,
          'Season and episode are required for TV shows',
          'construct-vidsrc-url',
          { params }
        );
      }
      return `${this.vidsrcBaseUrl}/tv/${tmdbId}/${season}/${episode}`;
    }
  }

  /**
   * Fetch VidSrc embed page
   */
  private async fetchVidSrcPage(
    url: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<string> {
    const stepStart = Date.now();

    try {
      const response = await httpClient.fetch(url, { timeout: 10000, retries: 2 }, requestId);
      const duration = Date.now() - stepStart;

      steps.push({
        step: 'fetch-vidsrc-page',
        success: true,
        duration,
        data: { url, status: response.status, bodyLength: response.body.length }
      });

      return response.body;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'fetch-vidsrc-page',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw this.createError(
        ERROR_CODES.NETWORK_ERROR,
        `Failed to fetch VidSrc page: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'fetch-vidsrc-page',
        { url }
      );
    }
  }

  /**
   * Extract Superembed hash from VidSrc HTML
   */
  private async extractHash(
    html: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<string> {
    const stepStart = Date.now();

    try {
      const hash = hashExtractor.extract(html, this.providerName, requestId);

      if (!hash) {
        throw this.createError(
          ERROR_CODES.HASH_NOT_FOUND,
          'Superembed hash not found in VidSrc page',
          'extract-hash',
          { htmlLength: html.length }
        );
      }

      const duration = Date.now() - stepStart;
      steps.push({
        step: 'extract-hash',
        success: true,
        duration,
        data: { hashLength: hash.length }
      });

      return hash;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'extract-hash',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Fetch CloudNestra RCP page
   */
  private async fetchRCPPage(
    hash: string,
    referer: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<string> {
    const stepStart = Date.now();

    try {
      const html = await rcpFetcher.fetch(hash, requestId, { referer });
      const duration = Date.now() - stepStart;

      steps.push({
        step: 'fetch-rcp-page',
        success: true,
        duration,
        data: { hash, bodyLength: html.length }
      });

      return html;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'fetch-rcp-page',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Extract ProRCP URL from RCP HTML
   */
  private async extractProRcpUrl(
    html: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<string> {
    const stepStart = Date.now();

    try {
      const proRcpUrl = proRcpExtractor.extract(html, this.providerName, requestId);

      if (!proRcpUrl) {
        throw this.createError(
          ERROR_CODES.PRORCP_NOT_FOUND,
          'ProRCP URL not found in RCP page',
          'extract-prorcp-url',
          { htmlLength: html.length }
        );
      }

      const duration = Date.now() - stepStart;
      steps.push({
        step: 'extract-prorcp-url',
        success: true,
        duration,
        data: { proRcpUrl }
      });

      return proRcpUrl;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'extract-prorcp-url',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Fetch ProRCP player page
   */
  private async fetchProRcpPage(
    url: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<string> {
    const stepStart = Date.now();

    try {
      const response = await httpClient.fetch(
        url,
        { timeout: 10000, retries: 2, referer: 'https://cloudnestra.com/' },
        requestId
      );

      const duration = Date.now() - stepStart;
      steps.push({
        step: 'fetch-prorcp-page',
        success: true,
        duration,
        data: { url, status: response.status, bodyLength: response.body.length }
      });

      return response.body;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'fetch-prorcp-page',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw this.createError(
        ERROR_CODES.PRORCP_FETCH_FAILED,
        `Failed to fetch ProRCP page: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'fetch-prorcp-page',
        { url }
      );
    }
  }

  /**
   * Extract hidden div with encoded data
   */
  private async extractHiddenDiv(
    html: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<{ divId: string; encoded: string }> {
    const stepStart = Date.now();

    try {
      const hiddenDiv = hiddenDivExtractor.extract(html, this.providerName, requestId);

      if (!hiddenDiv) {
        throw this.createError(
          ERROR_CODES.HIDDEN_DIV_NOT_FOUND,
          'Hidden div not found in ProRCP page',
          'extract-hidden-div',
          { htmlLength: html.length }
        );
      }

      const duration = Date.now() - stepStart;
      steps.push({
        step: 'extract-hidden-div',
        success: true,
        duration,
        data: { divId: hiddenDiv.divId, encodedLength: hiddenDiv.encoded.length }
      });

      return hiddenDiv;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'extract-hidden-div',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Decode M3U8 URL using all available methods
   */
  private async decodeM3U8(
    encoded: string,
    divId: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<{ url: string; method: string }> {
    const stepStart = Date.now();

    try {
      const decoderResult = await tryAllDecoders(encoded, divId, requestId);

      if (!decoderResult) {
        throw this.createError(
          ERROR_CODES.DECODE_FAILED,
          'Failed to decode M3U8 URL with any method',
          'decode-m3u8',
          { encodedLength: encoded.length, divId }
        );
      }

      const duration = Date.now() - stepStart;
      steps.push({
        step: 'decode-m3u8',
        success: true,
        duration,
        data: { method: decoderResult.method, urlLength: decoderResult.url.length }
      });

      return { url: decoderResult.url, method: decoderResult.method };
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'decode-m3u8',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Resolve placeholders to CDN domains
   */
  private async resolvePlaceholders(
    url: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<string[]> {
    const stepStart = Date.now();

    try {
      const urls = resolvePlaceholders(url, requestId);
      const duration = Date.now() - stepStart;

      steps.push({
        step: 'resolve-placeholders',
        success: true,
        duration,
        data: { originalUrl: url, resolvedCount: urls.length, primaryUrl: urls[0] }
      });

      return urls;
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'resolve-placeholders',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate M3U8 URL
   */
  private async validateM3U8(
    url: string,
    requestId: string,
    steps: StepResult[]
  ): Promise<void> {
    const stepStart = Date.now();

    try {
      const validationResult = await validateM3U8Url(url, requestId, false);

      if (!validationResult.valid) {
        throw this.createError(
          validationResult.errorCode || ERROR_CODES.M3U8_INVALID,
          validationResult.error || 'M3U8 URL validation failed',
          'validate-m3u8',
          { url }
        );
      }

      const duration = Date.now() - stepStart;
      steps.push({
        step: 'validate-m3u8',
        success: true,
        duration,
        data: { url }
      });
    } catch (error) {
      const duration = Date.now() - stepStart;
      steps.push({
        step: 'validate-m3u8',
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create a standardized extraction error
   */
  private createError(
    code: string,
    message: string,
    step: string,
    details?: any
  ): ExtractionError {
    return {
      code,
      message,
      provider: this.providerName,
      step,
      details,
      requestId: generateRequestId(),
    };
  }

  /**
   * Type guard to check if error is an ExtractionError
   */
  private isExtractionError(error: unknown): error is ExtractionError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'requestId' in error
    );
  }
}

/**
 * Singleton instance
 */
export const superembedExtractor = new SuperembedExtractor();
