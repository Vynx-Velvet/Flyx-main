/**
 * GET /api/providers
 *
 * Returns all registered providers with their configurations.
 * Dynamically generated from the provider registry — NOT hardcoded
 * (unlike Flyx 2.0 where this was a static list).
 */

import { NextResponse } from "next/server";
import { providerRegistry } from "@flyx/providers";

// Auto-register all providers on first import
import "@flyx/providers/providers";

export async function GET() {
  const configs = providerRegistry.serializeConfigs();
  return NextResponse.json({
    success: true,
    data: {
      providers: configs,
      count: configs.length,
      priorityOrder: providerRegistry.names,
    },
  });
}
