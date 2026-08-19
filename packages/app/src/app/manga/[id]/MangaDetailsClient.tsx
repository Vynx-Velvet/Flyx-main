"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ExtensionGate } from "@/components/ExtensionGate";
import { getMangaDetails } from "@/lib/manga/allmanga-client";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMangaProgress } from "@/hooks/useMangaProgress";
import DownloadButton from "@/components/downloads/DownloadButton";
import type { MangaData, ChapterData } from "@flyx/core";

type Tab = "chapters" | "info";

export default function MangaDetailsClient({ mangaId }: { mangaId: string }) {
  return <ExtensionGate type="manga"><Inner mangaId={mangaId} /></ExtensionGate>;
}

function Inner({ mangaId }: { mangaId: string }) {
  const router = useRouter();
  const [manga, setManga] = useState<MangaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("chapters");
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const { isInWatchlist, toggleItem } = useWatchlist();
  const { getProgress } = useMangaProgress();
  const bookmarked = isInWatchlist(mangaId, "manga");
  const progress = getProgress(mangaId);

  useEffect(() => {
    if (!mangaId) { setError(true); setLoading(false); return; }
    let c = false;
    setLoading(true);
    (async () => {
      const d = await getMangaDetails(mangaId);
      if (c) return;
      if (!d) { setError(true); setLoading(false); return; }
      setManga(d);
      setLoading(false);
    })();
    return () => { c = true; };
  }, [mangaId]);

  const readChapter = useCallback((ch: ChapterData) => {
    router.push(`/manga/read/${mangaId}/${ch.number}`);
  }, [mangaId, router]);

  const startReading = useCallback(() => {
    if (!manga?.chapters?.length) return;
    const target = progress?.chapterNumber ?? 1;
    router.push(`/manga/read/${mangaId}/${target}`);
  }, [manga, mangaId, router, progress]);

  const toggleBookmark = useCallback(() => {
    if (!manga) return;
    toggleItem({ contentId: mangaId, mediaType: "manga", title: manga.title, posterPath: manga.coverImage });
  }, [mangaId, manga, toggleItem]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(0,229,191,0.2)] border-t-[#00e5bf]" />
          <p className="text-sm text-white/40">Loading manga details…</p>
        </div>
      </div>
    );
  }

  if (error || !manga) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-white">Failed to load manga</p>
          <p className="mb-6 text-sm text-white/40">The manga data couldn't be retrieved right now.</p>
          <button onClick={() => router.push("/manga")} className="btn-primary">Back to Browse</button>
        </div>
      </div>
    );
  }

  const chapters = [...manga.chapters].sort((a, b) => a.number - b.number);

  return (
    <div className="anime-detail min-h-screen text-white">
      <div className="page-glow" />
      <HeroBanner
        manga={manga}
        progress={progress}
        bookmarked={bookmarked}
        onBack={() => router.push("/manga")}
        onStartReading={startReading}
        onRestart={() => router.push(`/manga/read/${mangaId}/1`)}
        onToggleBookmark={toggleBookmark}
      />

      <div className="anime-detail-tabs-sticky">
        <div className="content-container">
          <div className="anime-detail-tabs" role="tablist" aria-label="Manga sections">
            {([
              { id: "chapters" as Tab, label: "Chapters", count: chapters.length },
              { id: "info" as Tab, label: "Details", count: undefined },
            ]).map((t) => {
              const active = tab === t.id;
              return (
                <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.id)}
                  className={`anime-detail-tab${active ? " anime-detail-tab-active" : ""}`}>
                  <span className="anime-detail-tab-label">{t.label}</span>
                  {t.count != null ? <span className="anime-detail-tab-count">{t.count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="content-container anime-detail-panel">
        <AnimatePresence mode="wait">
          {tab === "chapters" && (
            <motion.div key="ch" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <ChaptersTab
                chapters={chapters}
                progress={progress}
                onRead={readChapter}
                mangaId={mangaId}
                mangaTitle={manga.title}
              />
            </motion.div>
          )}
          {tab === "info" && (
            <motion.div key="inf" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <InfoTab manga={manga} synopsisExpanded={synopsisExpanded} onToggleSynopsis={() => setSynopsisExpanded((v) => !v)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroBanner({ manga, progress, bookmarked, onBack, onStartReading, onRestart, onToggleBookmark }: {
  manga: MangaData; progress: ReturnType<typeof useMangaProgress>["getProgress"] extends (...a: any[]) => infer R ? R : any;
  bookmarked: boolean; onBack: () => void; onStartReading: () => void; onRestart: () => void; onToggleBookmark: () => void;
}) {
  return (
    <header className="anime-detail-hero">
      <div className="anime-detail-hero-bg" aria-hidden>
        {manga.coverImage && (
          <img src={`/api/manga/image?url=${encodeURIComponent(manga.coverImage)}`} alt=""
            className="anime-detail-hero-bg-img"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <div className="anime-detail-hero-bg-scrim" />
      </div>
      <div className="content-container anime-detail-hero-body">
        <button type="button" onClick={onBack} className="anime-detail-back">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Manga
        </button>
        <div className="anime-detail-hero-row">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="anime-detail-poster-wrap">
            {manga.coverImage ? (
              <img src={`/api/manga/image?url=${encodeURIComponent(manga.coverImage)}`} alt={manga.title}
                className="anime-detail-poster"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <CoverPlaceholder title={manga.title} />
            )}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }} className="anime-detail-hero-copy">
            <h1 className="anime-detail-title">{manga.title}</h1>
            {manga.altTitles.length > 0 && (
              <p className="anime-detail-subtitle">{manga.altTitles[0]}</p>
            )}
            <div className="anime-detail-meta">
              {manga.status && (
                <span className={`anime-detail-status${manga.status === "ongoing" ? " is-airing" : ""}`}>
                  {manga.status === "ongoing" && <span className="anime-detail-live-dot" />}
                  {manga.status.charAt(0).toUpperCase() + manga.status.slice(1)}
                </span>
              )}
              {manga.totalChapters > 0 && (
                <span className="anime-detail-meta-bit">{manga.totalChapters} chapters</span>
              )}
              {manga.author && <span className="anime-detail-meta-bit">{manga.author}</span>}
              {manga.year && <span className="anime-detail-meta-bit">{manga.year}</span>}
            </div>
            {manga.genres.length > 0 && (
              <div className="anime-detail-genres">
                {manga.genres.slice(0, 6).map((g) => (<span key={g}>{g}</span>))}
              </div>
            )}
            {manga.description && (
              <div className="anime-detail-synopsis">
                <p className="line-clamp-3">{manga.description}</p>
              </div>
            )}
            <div className="anime-detail-actions">
              <button type="button" onClick={onStartReading} className="btn-primary !px-5 !py-2.5 text-sm">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                {progress ? `Continue Ch. ${progress.chapterNumber}` : "Start Reading"}
              </button>
              {progress && (
                <button type="button" onClick={onRestart} className="text-sm text-white/30 hover:text-white/60 transition-colors">
                  Restart from Ch. 1
                </button>
              )}
              <button type="button" onClick={onToggleBookmark}
                className={`rounded-lg p-2 transition-all ${bookmarked ? "text-[#00e5bf]" : "text-white/30 hover:text-white/60 hover:bg-white/[0.03]"}`}
                title={bookmarked ? "Bookmarked" : "Bookmark"}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

// ─── Chapters Tab ───────────────────────────────────────────────────────────

function ChaptersTab({ chapters, progress, onRead, mangaId, mangaTitle }: {
  chapters: ChapterData[];
  progress: any;
  onRead: (ch: ChapterData) => void;
  mangaId: string;
  mangaTitle: string;
}) {
  if (chapters.length === 0) {
    return (
      <div className="anime-detail-empty">
        <p>No chapters available yet</p>
        <span>Check back later for updates.</span>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 0.75rem" }}>
        <DownloadButton
          items={chapters.map((ch) => ({
            kind: "manga",
            mangaId,
            chapter: ch.number,
            title: mangaTitle,
          }))}
          label={`Download All (${chapters.length})`}
          className="btn-secondary !px-4 !py-2 text-sm"
        />
      </div>
      <div className="anime-ep-list">
        {chapters.map((ch) => {
          const isContinue = progress?.chapterNumber === ch.number;
          return (
            <div key={ch.id || ch.number} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button type="button" onClick={() => onRead(ch)} className="anime-ep-row" style={{ flex: 1 }}>
                <div className="anime-ep-body">
                  <div className="anime-ep-title">
                    {isContinue && <span className="text-[#00e5bf] mr-2 text-xs font-semibold">● Continue</span>}
                    {ch.title || `Chapter ${ch.number}`}
                  </div>
                  <div className="anime-ep-meta">
                    <span>Ch. {ch.number}</span>
                    {ch.publishedAt && <><span className="text-white/15">·</span><span>{new Date(ch.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></>}
                  </div>
                </div>
              </button>
              <DownloadButton
                item={{ kind: "manga", mangaId, chapter: ch.number, title: mangaTitle }}
                label="⬇"
                queuedLabel="✓"
                title={`Download Chapter ${ch.number}`}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "0.8rem",
                  padding: "0.35rem 0.5rem",
                  cursor: "pointer",
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Info Tab ───────────────────────────────────────────────────────────────

function InfoTab({ manga, synopsisExpanded, onToggleSynopsis }: {
  manga: MangaData; synopsisExpanded: boolean; onToggleSynopsis: () => void;
}) {
  const rows = (
    [
      ["Status", manga.status ? manga.status.charAt(0).toUpperCase() + manga.status.slice(1) : undefined],
      ["Author", manga.author],
      ["Artist", manga.artist],
      ["Year", manga.year?.toString()],
      ["Total Chapters", manga.totalChapters > 0 ? manga.totalChapters.toString() : undefined],
      ["Genres", manga.genres.join(", ")],
      ["Content Rating", manga.contentRating],
    ] as [string, string | undefined][]
  ).filter(([, v]) => v != null && v !== "");

  return (
    <div className="anime-info">
      <div className="anime-info-table">
        {rows.map(([label, value]) => (
          <div key={label} className="anime-info-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </div>
      {manga.description && (
        <div className="anime-info-block">
          <p className="anime-section-label">Synopsis</p>
          <div>
            <p className={`anime-info-prose ${synopsisExpanded ? "" : "line-clamp-4"}`}>{manga.description}</p>
            {manga.description.length > 300 && (
              <button type="button" onClick={onToggleSynopsis} className="anime-detail-readmore">
                {synopsisExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cover Placeholder ──────────────────────────────────────────────────────

const PLACEHOLDER_GRADIENTS = [
  ["#f062a0", "#8b7cf0"], ["#00e5bf", "#38bdf8"], ["#fbbf24", "#f45050"],
  ["#8b7cf0", "#2dd4a8"], ["#38bdf8", "#f062a0"], ["#2dd4a8", "#fbbf24"],
];

function CoverPlaceholder({ title }: { title: string }) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  const [from, to] = PLACEHOLDER_GRADIENTS[Math.abs(hash) % PLACEHOLDER_GRADIENTS.length]!;
  const words = title.trim().split(/\s+/);
  const initials = words.length >= 2 ? (words[0]![0]! + words[1]![0]!).toUpperCase() : title.trim().substring(0, 2).toUpperCase();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-[0.9rem]" style={{ background: `linear-gradient(135deg, ${from}30, ${to}40)` }}>
      <span className="font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight drop-shadow-lg" style={{ color: from, textShadow: `0 2px 12px ${from}50` }}>{initials}</span>
    </div>
  );
}
