/**
 * The app's single ExtractionPipeline.
 *
 * Every API route used to construct its own pipeline, each with its own
 * 15-minute cache — so a title resolved by /api/stream/extract had to be
 * re-extracted by the download dialog, the VLC route and the downloader,
 * and a flaky provider answer in one route did not benefit from a success
 * in another. One shared instance keeps the caches coherent.
 */

import { ExtractionPipeline } from "@flyx/extractors";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";

export const pipeline = new ExtractionPipeline(providerRegistry);
