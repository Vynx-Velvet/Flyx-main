/**
 * GET  /api/downloads — list download jobs (with progress)
 * POST /api/downloads — queue one or more downloads ({ items: [...] })
 *
 * Admin-only: downloads write files to the server machine's disk.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { createJobs, listJobs } from "@/lib/downloads/manager";
import type { DownloadItemInput } from "@/lib/downloads/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateItems(items: unknown): DownloadItemInput[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items must be a non-empty array");
  }
  if (items.length > 100) {
    throw new Error("too many items (max 100 per request)");
  }

  return items.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`items[${i}] is invalid`);
    }
    const it = item as Record<string, unknown>;

    if (it.kind === "video") {
      const tmdbId = Number(it.tmdbId);
      const malId = it.malId ? Number(it.malId) : undefined;
      if (!Number.isFinite(tmdbId)) {
        throw new Error(`items[${i}] is missing a valid tmdbId`);
      }
      // Anime requests route by malId and may carry tmdbId=0.
      if (tmdbId <= 0 && !malId) {
        throw new Error(`items[${i}] is missing a valid tmdbId`);
      }
      const mediaType = it.mediaType === "tv" ? "tv" : "movie";
      if (mediaType === "tv" && !it.season && !it.episode) {
        throw new Error(`items[${i}] is missing season/episode`);
      }
      return {
        kind: "video",
        tmdbId,
        mediaType,
        season: it.season ? Number(it.season) : undefined,
        episode: it.episode ? Number(it.episode) : undefined,
        malId,
        title: typeof it.title === "string" ? it.title : undefined,
        provider: typeof it.provider === "string" ? it.provider : undefined,
        quality: typeof it.quality === "string" ? it.quality : undefined,
        language: it.language === "dub" ? "dub" : it.language === "sub" ? "sub" : undefined,
        durationSec: it.durationSec ? Number(it.durationSec) : undefined,
      } as DownloadItemInput;
    }

    if (it.kind === "manga") {
      const mangaId = String(it.mangaId || "");
      const chapter = Number(it.chapter);
      if (!mangaId || !Number.isFinite(chapter) || chapter <= 0) {
        throw new Error(`items[${i}] is missing a valid mangaId/chapter`);
      }
      return {
        kind: "manga",
        mangaId,
        chapter,
        title: typeof it.title === "string" ? it.title : undefined,
      } as DownloadItemInput;
    }

    throw new Error(`items[${i}] has an unsupported kind`);
  });
}

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, jobs: listJobs() });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const items = validateItems(body?.items);
    const jobs = createJobs(items);
    return NextResponse.json({ ok: true, jobs: jobs.map((j) => ({ id: j.id, label: j.label })) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
