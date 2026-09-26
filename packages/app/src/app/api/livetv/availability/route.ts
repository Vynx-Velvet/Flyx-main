/**
 * GET /api/livetv/availability?ids=51,421,1203
 *
 * Which channels can actually play right now. The schedule marks an event
 * "live" from its timetable, but many event slots are off air or embed a
 * player we can't extract. The Live TV page asks here for the channels of
 * the on-air events so it can put playable ones first and label the rest.
 *
 * Per channel: resolve (cached 10 min by the extractor) then a quick GET of
 * the playlist. Results are cached for 3 minutes. Never throws; unknown
 * channels come back "unknown".
 */

import { NextRequest, NextResponse } from "next/server";
import { extractDLHD, probeDLHDEdge } from "@flyx/extractors/services";
import { relaxedFetch } from "@flyx/core/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type Availability = "online" | "offline" | "unsupported" | "unknown";

const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";
const CACHE_MS = 3 * 60 * 1000;
const MAX_IDS = 60;
const CONCURRENCY = 6;

const cache = new Map<string, { status: Availability; at: number }>();
const inflight = new Map<string, Promise<Availability>>();

async function probe(channelId: string): Promise<Availability> {
  try {
    // Fast path: one request against the known edge (no scrape).
    const quick = await probeDLHDEdge(channelId);
    if (quick) return quick;
    const result = await extractDLHD(channelId);
    if (!result.sources.length) {
      return result.reason === "unsupported" ? "unsupported" : "offline";
    }
    const src = result.sources[0]!;
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 6000);
    try {
      const r = await relaxedFetch(`${src.url}${src.url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          ...(src.referer ? { Referer: src.referer } : {}),
          ...(src.origin ? { Origin: src.origin } : {}),
        },
        signal: c.signal,
      });
      if (r.status === 404 || r.status === 410) return "offline";
      if (!r.ok) return "unknown";
      const text = await r.text();
      return text.trim().startsWith("#EXTM3U") ? "online" : "offline";
    } finally {
      clearTimeout(t);
    }
  } catch {
    return "unknown";
  }
}

function check(channelId: string): Promise<Availability> {
  const hit = cache.get(channelId);
  if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.status);
  const pending = inflight.get(channelId);
  if (pending) return pending;
  const p = probe(channelId)
    .then((status) => {
      cache.set(channelId, { status, at: Date.now() });
      return status;
    })
    .finally(() => inflight.delete(channelId));
  inflight.set(channelId, p);
  return p;
}

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get("ids") || "";
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter((s) => /^\d{1,6}$/.test(s)))].slice(0, MAX_IDS);
  if (!ids.length) {
    return NextResponse.json({ ok: false, error: "ids required" }, { status: 400 });
  }

  const results: Record<string, Availability> = {};
  let i = 0;
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++]!;
      results[id] = await check(id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker));

  return NextResponse.json(
    { ok: true, availability: results, checkedAt: Date.now() },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
