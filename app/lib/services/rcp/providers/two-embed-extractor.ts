/**
 * 2Embed Provider Extractor
 * 
 * Implements the complete extraction chain for 2Embed provider
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

export interface TwoEmbedExtractionResult {
  success: boolean;
  m3u8Url?: string;
  m3u8Urls?: string[];
  duration: number;
  steps: StepResult[];
  error?: string;
  errorCode?: string;
}

export class TwoEmbedExtractor {
  private readonly providerName = '2embed' as const;
  private readonly vidsrcBaseUrl = 'https://vidsrc.cc/v2/embed';

  async extract(params: ExtractionParams): Promise<TwoEmbedExtractionResult> {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const steps: StepResult[] = [];

    try {
      const vidsrcUrl = this.constructVidSrcUrl(params);
      const vidsrcHtml = await this.fetchVidSrcPage(vidsrcUrl, requestId, steps);
      const hash = await this.extractHash(vidsrcHtml, requestId, steps);
      const rcpHtml = await this.fetchRCPPage(hash, vidsrcUrl, requestId, steps);
      const proRcpUrl = await this.extractProRcpUrl(rcpHtml, requestId, steps);
      const playerHtml = await this.fetchProRcpPage(proRcpUrl, requestId, steps);
      const hiddenDiv = await this.extractHiddenDiv(playerHtml, requestId, steps);
      const decoderResult = await this.decodeM3U8(hiddenDiv.encoded, hiddenDiv.divId, requestId, steps);
      const m3u8Urls = await this.resolvePlaceholders(decoderResult.url, requestId, steps);
      await this.validateM3U8(m3u8Urls[0], requestId, steps);

      return {
        success: true,
        m3u8Url: m3u8Urls[0],
        m3u8Urls,
        duration: Date.now() - startTime,
        steps,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        steps,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.NETWORK_ERROR,
      };
    }
  }

  private constructVidSrcUrl(params: ExtractionParams): string {
    if (params.type === 'movie') {
      return `${this.vidsrcBaseUrl}/movie/${params.tmdbId}`;
    }
    return `${this.vidsrcBaseUrl}/tv/${params.tmdbId}/${params.season}/${params.episode}`;
  }

  private async fetchVidSrcPage(url: string, requestId: string, steps: StepResult[]): Promise<string> {
    const response = await httpClient.fetch(url, { timeout: 10000 }, requestId);
    steps.push({ step: 'fetch-vidsrc', success: true, duration: 0 });
    return response.body;
  }

  private async extractHash(html: string, requestId: string, steps: StepResult[]): Promise<string> {
    const hash = hashExtractor.extract(html, this.providerName, requestId);
    if (!hash) throw new Error('Hash not found');
    steps.push({ step: 'extract-hash', success: true, duration: 0 });
    return hash;
  }

  private async fetchRCPPage(hash: string, referer: string, requestId: string, steps: StepResult[]): Promise<string> {
    const html = await rcpFetcher.fetch(hash, requestId, { referer });
    steps.push({ step: 'fetch-rcp', success: true, duration: 0 });
    return html;
  }

  private async extractProRcpUrl(html: string, requestId: string, steps: StepResult[]): Promise<string> {
    const url = proRcpExtractor.extract(html, this.providerName, requestId);
    if (!url) throw new Error('ProRCP URL not found');
    steps.push({ step: 'extract-prorcp', success: true, duration: 0 });
    return url;
  }

  private async fetchProRcpPage(url: string, requestId: string, steps: StepResult[]): Promise<string> {
    const response = await httpClient.fetch(url, { timeout: 10000 }, requestId);
    steps.push({ step: 'fetch-prorcp-page', success: true, duration: 0 });
    return response.body;
  }

  private async extractHiddenDiv(html: string, requestId: string, steps: StepResult[]): Promise<{ divId: string; encoded: string }> {
    const div = hiddenDivExtractor.extract(html, this.providerName, requestId);
    if (!div) throw new Error('Hidden div not found');
    steps.push({ step: 'extract-hidden-div', success: true, duration: 0 });
    return div;
  }

  private async decodeM3U8(encoded: string, divId: string, requestId: string, steps: StepResult[]): Promise<{ url: string; method: string }> {
    const result = await tryAllDecoders(encoded, divId, requestId);
    if (!result) throw new Error('Decode failed');
    steps.push({ step: 'decode-m3u8', success: true, duration: 0 });
    return result;
  }

  private async resolvePlaceholders(url: string, requestId: string, steps: StepResult[]): Promise<string[]> {
    const urls = resolvePlaceholders(url, requestId);
    steps.push({ step: 'resolve-placeholders', success: true, duration: 0 });
    return urls;
  }

  private async validateM3U8(url: string, requestId: string, steps: StepResult[]): Promise<void> {
    const result = await validateM3U8Url(url, requestId, false);
    if (!result.valid) throw new Error('Validation failed');
    steps.push({ step: 'validate-m3u8', success: true, duration: 0 });
  }
}

export const twoEmbedExtractor = new TwoEmbedExtractor();
