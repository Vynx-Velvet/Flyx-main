/**
 * @flyx/extractors
 *
 * Unified extraction layer for Flyx 3.0.
 *
 * Provides:
 * - **ExtractionPipeline** — Single unified extraction path replacing 5+ duplicates
 * - **Service extractors** — Per-provider extraction logic
 * - **Crypto utilities** — WASM decryption helpers
 */

export { ExtractionPipeline } from "./unified/ExtractionPipeline";
export type { ExtractionOptions } from "./unified/ExtractionPipeline";
