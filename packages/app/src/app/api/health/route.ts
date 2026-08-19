/**
 * GET /api/health
 *
 * Health check endpoint for monitoring and load balancers.
 */

import { NextResponse } from "next/server";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "3.0.4",
    timestamp: Date.now(),
    providers: providerRegistry.size,
    uptime: process.uptime(),
  });
}
