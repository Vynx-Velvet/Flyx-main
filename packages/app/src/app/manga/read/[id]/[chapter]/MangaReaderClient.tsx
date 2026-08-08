"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ExtensionGate } from "@/components/ExtensionGate";
import { getChapterPages, getMangaDetails } from "@/lib/manga/allmanga-client"; // weebcentral-backed client
import { useWatchlist } from "@/hooks/useWatchlist";
import { useMangaProgress } from "@/hooks/useMangaProgress";
import type { MangaPageData, ChapterData } from "@flyx/core";

const spring = { type: "spring" as const, stiffness: 400, damping: 35 };

export default function MangaReaderClient({ mangaId, chapterNumber }: { mangaId: string; chapterNumber: number }) {
  return <ExtensionGate type="manga"><Reader mangaId={mangaId} chapterNumber={chapterNumber} /></ExtensionGate>;
}

function Reader({ mangaId, chapterNumber }: { mangaId: string; chapterNumber: number }) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toggleItem, isInWatchlist } = useWatchlist();
  const { saveProgress, getChapterProgress } = useMangaProgress();

  const [pages, setPages] = useState<MangaPageData[]>([]);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [mangaTitle, setMangaTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const resumePageRef = useRef(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [sidebar, setSidebar] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const pageRef = useRef(1);
  const pagesRef = useRef<MangaPageData[]>([]);
  const prevChapterRef = useRef<ChapterData | null>(null);
  const nextChapterRef = useRef<ChapterData | null>(null);
  const goToChapterRef = useRef<(ch: number, startPage?: number) => void>(() => {});
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);
  /** True when page change came from a nav button/keyboard/slider — prevents
   *  the scroll-detection handler from fighting with scrollIntoView. */
  const userNavigated = useRef(false);
  const bookmarked = isInWatchlist(mangaId, "manga");

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // Handle ?page= param for back-navigation
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("page");
    if (p) {
      const target = parseInt(p);
      if (target > 1) {
        resumePageRef.current = true;
        userNavigated.current = true;
        setPage(target);
      }
    }
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mangaId) return;
    let c = false;
    setLoading(true); setError(null); setPage(1);
    (async () => {
      try {
        const [pd, md] = await Promise.all([getChapterPages(mangaId, chapterNumber), getMangaDetails(mangaId)]);
        if (c) return;
        if (!pd?.length) { setError("No pages found."); setLoading(false); return; }
        // Deduplicate by imageUrl in case API returns dupes at chapter boundaries
        const seen = new Set<string>();
        const unique = pd.filter(p => { if (seen.has(p.imageUrl)) return false; seen.add(p.imageUrl); return true; });
        setPages(unique); if (md) { setMangaTitle(md.title); setChapters(md.chapters); }
        setPage(prev => Math.min(prev, pd.length));
        setLoading(false);
        // Skip initial load guard if resuming from a specific page (back-nav)
        if (resumePageRef.current) initialLoad.current = false;
      } catch (e) { if (!c) { setError((e as Error).message || "Failed to load."); setLoading(false); } }
    })();
    return () => { c = true; };
  }, [mangaId, chapterNumber]);

  useEffect(() => {
    if (!loading && pages.length > 0) { const t = setTimeout(() => { initialLoad.current = false; }, 1500); return () => clearTimeout(t); }
  }, [loading, pages.length]);

  // ── Save progress ──────────────────────────────────────────────────────

  useEffect(() => {
    if (loading || pages.length === 0 || initialLoad.current) return;
    saveProgress(mangaId, chapterNumber, page);
  }, [page, chapterNumber, mangaId, loading, pages.length, saveProgress]);

  // ── Nav ────────────────────────────────────────────────────────────────

  const clamp = (n: number) => Math.max(1, Math.min(n, pagesRef.current.length));
  const next = useCallback(() => {
    const c = pageRef.current;
    const total = pagesRef.current.length;
    if (total > 0 && c >= total) {
      const nch = nextChapterRef.current;
      if (nch) { goToChapterRef.current(nch.number); return; }
      return;
    }
    if (total > 0 && c < total) { userNavigated.current = true; setPage(c + 1); }
  }, []);
  const prev = useCallback(() => {
    const c = pageRef.current;
    if (c <= 1 && pagesRef.current.length > 0) {
      const pch = prevChapterRef.current;
      if (pch) { goToChapterRef.current(pch.number, 99999); } return;
    }
    if (c > 1) { userNavigated.current = true; setPage(c - 1); }
  }, []);
  const jump = useCallback((n: number) => { userNavigated.current = true; setPage(clamp(n)); }, []);
  const goToChapter = useCallback((ch: number, startPage?: number) => {
    const pageParam = startPage && startPage > 1 ? `?page=${startPage}` : "";
    router.push(`/manga/read/${mangaId}/${ch}${pageParam}`);
  }, [mangaId, router]);
  const goBack = useCallback(() => router.push(`/manga/${mangaId}`), [mangaId, router]);

  // ── UI ─────────────────────────────────────────────────────────────────
  // Show on mouse move, double tap, or click. Hide after 3s of inactivity.

  const flash = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setUiVisible(false), 3000);
  }, []);


  // Show UI on mouse movement
  useEffect(() => {
    const onMove = () => flash();
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [flash]);

  // Double tap detection
  const lastTap = useRef(0);
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 350) flash(); // double tap
    lastTap.current = now;
  }, [flash]);

  const toggleBookmark = useCallback(() => {
    toggleItem({ contentId: mangaId, mediaType: "manga", title: mangaTitle || `Manga ${mangaId}` });
  }, [mangaId, mangaTitle, toggleItem]);

  // ── Keyboard ───────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowRight": case "d": case "D": e.preventDefault(); next(); return;
        case "ArrowLeft":  case "a": case "A": e.preventDefault(); prev(); return;
        case "ArrowDown":  case "s": case "S": e.preventDefault(); next(); return;
        case "ArrowUp":    case "w": case "W": e.preventDefault(); prev(); return;
        case "f": case "F": e.preventDefault(); document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : document.documentElement.requestFullscreen().catch(() => {}); return;
        case "Home": e.preventDefault(); jump(1); return;
        case "End":  e.preventDefault(); jump(99999); return;
        case "Escape": setSidebar(false); setShowHelp(false); return;
        case "?": e.preventDefault(); setShowHelp(v => !v); setUiVisible(true); return;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [next, prev, jump]);

  // ── Scroll tracking ────────────────────────────────────────────────────
  //
  // Two effects work together to keep the page counter in sync with the viewport:
  //
  //   1. Scroll handler (below) — listens for scroll events and updates `page`
  //      to match whichever page is closest to 30% from the top of the viewport.
  //      Skips programmatic scrolls triggered by scrollIntoView (nav buttons etc.)
  //      to avoid fighting with the auto-scroll effect.
  //
  //   2. Auto-scroll effect — when `page` changes via a nav action (next/prev/jump/
  //      keyboard/slider), scrolls the target page into view. Does NOT scroll
  //      when the page change came from the scroll handler itself (user scrolling).

  useEffect(() => {
    if (pages.length === 0) return;
    const el = scrollRef.current; if (!el) return;
    let ticking = false;
    const onScroll = () => {
      // Skip scroll events caused by our own scrollIntoView calls
      if (userNavigated.current) return;
      if (initialLoad.current || ticking || loading) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!el) { ticking = false; return; }
        const els = el.querySelectorAll("[data-page]");
        if (els.length === 0) { ticking = false; return; }
        let best = pageRef.current, bestD = Infinity;
        const t = el.scrollTop + el.clientHeight * 0.3;
        els.forEach(pageEl => {
          const rect = pageEl.getBoundingClientRect();
          const top = rect.top - el.getBoundingClientRect().top + el.scrollTop;
          const d = Math.abs(top - t);
          if (d < bestD) { const n = parseInt((pageEl as HTMLElement).dataset.page || "0", 10); if (n > 0) { best = n; bestD = d; } }
        });
        if (best !== pageRef.current && bestD < el.clientHeight * 0.8) setPage(best);
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [pages]);

  useEffect(() => {
    if (initialLoad.current || loading || pages.length === 0 || !scrollRef.current) return;
    // Only auto-scroll when the page change came from a nav action, not from
    // the scroll-detection handler. This prevents the view from jumping while
    // the user is manually scrolling.
    if (!userNavigated.current) return;
    userNavigated.current = false;
    const el = scrollRef.current.querySelector(`[data-page="${page}"]`);
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
  }, [page, loading, pages.length]);

  // ── Click / swipe ──────────────────────────────────────────────────────

  const swipeX = useRef(0);
  const onClick = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("button") || t.closest("input") || t.closest("a")) return;
    const pct = (e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left) / (e.currentTarget as HTMLElement).offsetWidth;
    if (pct < 0.2) prev(); else if (pct > 0.8) next();
  }, [next, prev, flash]);

  const onPtrDown = useCallback((e: React.PointerEvent) => { swipeX.current = e.clientX; }, []);
  const onPtrUp = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - swipeX.current;
    if (Math.abs(dx) > 60) dx < -40 ? next() : prev();
  }, [next, prev]);

  // ── Derived ────────────────────────────────────────────────────────────

  const proxyUrl = useCallback((p: MangaPageData) =>
    `/api/manga/image?url=${encodeURIComponent(p.imageUrl)}${p.referer ? `&referer=${encodeURIComponent(p.referer)}` : ""}`, []);
  const pct = pages.length ? (page / pages.length) * 100 : 0;
  const resumePage = getChapterProgress(mangaId, chapterNumber);
  const idx = chapters.findIndex(c => c.number === chapterNumber);
  const prevCh = idx > 0 ? chapters[idx - 1] : null;
  const nextCh = idx < chapters.length - 1 ? chapters[idx + 1] : null;
  // Sync refs for auto-advance on first/last page
  prevChapterRef.current = prevCh;
  nextChapterRef.current = nextCh;
  goToChapterRef.current = goToChapter;

  // ── Shared icon components ─────────────────────────────────────────────

  const ArrowLeftIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
  );
  const ChevronLeftIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
  );
  const ChevronRightIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
  );
  const ListIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
  );
  const FullscreenIcon = ({ className = "h-5 w-5" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"/></svg>
  );
  const BookmarkIcon = ({ className = "h-5 w-5", filled = false }) => (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
  );

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a10] px-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-6 sm:mb-8">
            <div className="absolute inset-0 rounded-full blur-2xl bg-[#00e5bf]/10 animate-pulse" />
            <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/[0.02] ring-1 ring-white/[0.04]">
              <svg className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-[#00e5bf]/60" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-15" /><path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </div>
          </div>
          <p className="text-lg sm:text-xl font-medium text-white/70 font-[family-name:var(--font-display)]">Chapter {chapterNumber}</p>
          <p className="mt-1.5 text-sm text-white/25">Loading pages…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a10] px-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-rose-500/[0.06] ring-1 ring-rose-500/[0.08]">
            <svg className="h-8 w-8 sm:h-10 sm:w-10 text-rose-300/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-white font-[family-name:var(--font-display)]">Chapter Unavailable</h2>
          <p className="mt-2 sm:mt-3 max-w-xs text-sm text-white/35">{error}</p>
          <div className="mt-6 sm:mt-8 flex gap-3">
            <button onClick={goBack} className="rounded-xl border border-white/[0.08] px-5 py-2.5 sm:py-3 text-sm font-medium text-white/60 hover:border-white/20 hover:text-white hover:bg-white/[0.02] transition-all min-h-[44px]">Back</button>
            <button onClick={() => window.location.reload()} className="rounded-xl bg-white/[0.04] px-5 py-2.5 sm:py-3 text-sm font-medium text-white/80 ring-1 ring-white/[0.08] hover:bg-white/[0.08] transition-all min-h-[44px]">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // READER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-50 flex bg-[#0a0a10] select-none">

      {/* ═════ SIDEBAR ═════ */}
      <AnimatePresence>
        {sidebar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebar(false)} />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={spring}
              className="fixed left-0 top-0 bottom-0 z-50 w-[85vw] max-w-sm sm:max-w-md lg:max-w-lg bg-[#0c0c14] border-r border-white/[0.05] flex flex-col shadow-2xl"
            >
              {/* Sidebar header */}
              <div className="shrink-0 px-4 sm:px-5 py-3 sm:py-4 border-b border-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-white/85 font-[family-name:var(--font-display)] truncate">{mangaTitle || "Manga"}</h3>
                    <p className="text-xs sm:text-sm text-white/30 mt-0.5">{chapters.length} chapters</p>
                  </div>
                  <button onClick={() => setSidebar(false)} className="rounded-lg p-3 text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
                <button onClick={toggleBookmark}
                  className={`mt-3 w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium transition-all min-h-[44px] ${
                    bookmarked ? "border-[#00e5bf]/20 bg-[#00e5bf]/8 text-[#00e5bf]" : "border-white/[0.05] bg-white/[0.01] text-white/40 hover:border-white/10 hover:text-white/70"
                  }`}>
                  <BookmarkIcon className="h-4 w-4 sm:h-5 sm:w-5" filled={bookmarked} />
                  {bookmarked ? "Bookmarked" : "Add to Watchlist"}
                </button>
              </div>
              {/* Chapter list */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
                {chapters.map(ch => {
                  const cur = ch.number === chapterNumber;
                  const prog = getChapterProgress(mangaId, ch.number);
                  return (
                    <button key={ch.id} onClick={() => { goToChapter(ch.number); setSidebar(false); }}
                      className={`w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-3.5 text-left transition-all hover:bg-white/[0.02] min-h-[48px] ${
                        cur ? "bg-[#00e5bf]/5 border-l-[3px] border-l-[#00e5bf] pl-[13px] sm:pl-[17px]" : "border-l-[3px] border-l-transparent pl-[13px] sm:pl-[17px]"
                      }`}>
                      <span className={`text-sm sm:text-base tabular-nums min-w-[36px] sm:min-w-[44px] font-semibold ${cur ? "text-[#00e5bf]" : "text-white/50"}`}>{ch.number}</span>
                      <span className={`text-sm sm:text-base truncate flex-1 ${cur ? "text-white/80" : "text-white/35"}`}>
                        {ch.title && ch.title !== `Chapter ${ch.number}` ? ch.title : `Chapter ${ch.number}`}
                      </span>
                      {prog && !cur && <span className="text-xs text-white/20 tabular-nums">p.{prog}</span>}
                      {cur && <span className="w-2 h-2 rounded-full bg-[#00e5bf] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═════ MAIN ═════ */}
      <div className="flex-1 flex flex-col relative">

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-30 h-[2px] sm:h-[2px] lg:h-[3px] bg-white/[0.02]">
          <motion.div className="h-full bg-gradient-to-r from-[#00e5bf] to-[#8b7cf0]" animate={{ width: `${pct}%` }} transition={{ duration: 0.18 }} />
        </div>

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {uiVisible && (
            <motion.div initial={{ y: -120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -120, opacity: 0 }} transition={spring}
              className="absolute top-0 left-0 right-0 z-20">
              <div className="bg-gradient-to-b from-[#0a0a10]/98 via-[#0a0a10]/90 to-transparent backdrop-blur-2xl">

                {/* Mobile: compact single row */}
                <div className="flex sm:hidden items-center gap-2 px-3 py-3">
                  <button onClick={goBack} className="rounded-xl p-2.5 text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition-all shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <ArrowLeftIcon />
                  </button>
                  <div className="flex-1 min-w-0 text-center">
                    <p className="text-sm font-semibold text-white/80 font-[family-name:var(--font-display)]">Ch. {chapterNumber}</p>
                    <p className="text-[11px] text-white/25 tabular-nums">{page} / {pages.length}</p>
                  </div>
                  <button onClick={() => setSidebar(true)} className="rounded-xl p-2.5 text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition-all shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <ListIcon />
                  </button>
                </div>

                {/* Desktop: full row */}
                <div className="hidden sm:flex items-center gap-3 lg:gap-4 px-4 lg:px-6 py-3 lg:py-4">
                  <button onClick={goBack}
                    className="flex items-center gap-2 rounded-xl px-3 lg:px-4 py-2 lg:py-2.5 text-sm lg:text-base font-medium text-white/50 hover:text-white/85 hover:bg-white/[0.04] transition-all shrink-0">
                    <ArrowLeftIcon />
                    <span>Back</span>
                  </button>
                  <div className="h-6 w-px bg-white/[0.06]" />
                  <div className="flex items-center gap-2">
                    <button onClick={() => prevCh && goToChapter(prevCh.number)} disabled={!prevCh}
                      className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-10 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeftIcon />
                    </button>
                    <span className="text-base lg:text-lg font-semibold text-white/90 font-[family-name:var(--font-display)] tabular-nums">Ch. {chapterNumber}</span>
                    <button onClick={() => nextCh && goToChapter(nextCh.number)} disabled={!nextCh}
                      className="p-1.5 text-white/30 hover:text-white/70 disabled:opacity-10 disabled:cursor-not-allowed transition-colors">
                      <ChevronRightIcon />
                    </button>
                  </div>
                  <div className="h-6 w-px bg-white/[0.06]" />
                  <span className="text-sm lg:text-base tabular-nums font-medium text-white/35 min-w-[60px]">
                    <span className="text-white/60">{page}</span>
                    <span className="text-white/20"> / {pages.length}</span>
                  </span>
                  <div className="flex-1" />
                  {resumePage && resumePage > 1 && (
                    <button onClick={() => jump(resumePage)}
                      className="text-xs lg:text-sm font-medium text-[#00e5bf]/60 hover:text-[#00e5bf] px-3 py-1.5 rounded-lg hover:bg-[#00e5bf]/5 transition-all">Resume p.{resumePage}</button>
                  )}
                  <button onClick={toggleBookmark}
                    className={`rounded-xl p-2.5 lg:p-3 transition-all ${bookmarked ? "text-[#00e5bf]" : "text-white/35 hover:text-white/70 hover:bg-white/[0.04]"}`} title={bookmarked ? "Bookmarked" : "Bookmark"}>
                    <BookmarkIcon className="h-5 w-5 lg:h-6 lg:w-6" filled={bookmarked} />
                  </button>
                  <button onClick={() => setSidebar(true)}
                    className="rounded-xl p-2.5 lg:p-3 text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-all" title="Chapters">
                    <ListIcon className="h-5 w-5 lg:h-6 lg:w-6" />
                  </button>
                  <button onClick={() => { document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : document.documentElement.requestFullscreen().catch(() => {}); }}
                    className="rounded-xl p-2.5 lg:p-3 text-white/35 hover:text-white/70 hover:bg-white/[0.04] transition-all" title="Fullscreen (F)">
                    <FullscreenIcon className="h-5 w-5 lg:h-6 lg:w-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Help ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showHelp && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowHelp(false)}>
              <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 sm:p-6 lg:p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-white/80 mb-4 sm:mb-6 font-[family-name:var(--font-display)]">Controls</h3>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm lg:text-base">
                  {[
                    ["← → or A D", "Previous / Next page"],
                    ["↑ ↓ or W S", "Scroll up / down"],
                    ["Click left/right edge", "Previous / Next page"],
                    ["Click center", "Toggle controls"],
                    ["Swipe left/right", "Previous / Next page"],
                    ["F", "Fullscreen"],
                    ["Home / End", "First / Last page"],
                    ["?", "This help"],
                  ].map(([k, d]) => (
                    <div key={k} className="flex items-center gap-3 sm:gap-4">
                      <kbd className="rounded-lg bg-white/[0.04] px-2 sm:px-3 py-1 sm:py-1.5 font-mono text-[10px] sm:text-xs lg:text-sm text-white/55 ring-1 ring-white/[0.06] min-w-[100px] sm:min-w-[130px] text-center">{k}</kbd>
                      <span className="text-white/35">{d}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── PAGES ──────────────────────────────────────────────────────── */}
        <div ref={scrollRef} onClick={onClick} onPointerDown={onPtrDown} onPointerUp={onPtrUp} onTouchEnd={onTouchEnd}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent", WebkitOverflowScrolling: "touch" }}>
          <div className="h-14 sm:h-16 lg:h-20" />
          <div className="flex flex-col items-center">
            {pages.map((p, i) => (
              <div key={p.pageNumber} data-page={p.pageNumber} className="flex justify-center w-full"
                style={{ marginBottom: i < pages.length - 1 ? 0 : 0 }}>
                <img src={proxyUrl(p)} alt={`Page ${p.pageNumber}`}
                  className="w-full h-screen object-contain select-none"
                  loading={i <= 2 ? "eager" : "lazy"} draggable={false}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ))}
          </div>
          <div className="h-24 sm:h-32 lg:h-40" />
        </div>

        {/* ── PAGE NAV OVERLAYS ──────────────────────────────────────────── */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-[20%] z-10 flex items-center">
          {page > 1 && uiVisible && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }}
              className="ml-2 sm:ml-4 lg:ml-8 flex h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-full bg-white/[0.02] ring-1 ring-white/[0.04]">
              <ChevronLeftIcon className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
            </motion.div>
          )}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-[20%] z-10 flex items-center justify-end">
          {page < pages.length && uiVisible && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }}
              className="mr-2 sm:mr-4 lg:mr-8 flex h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-full bg-white/[0.02] ring-1 ring-white/[0.04]">
              <ChevronRightIcon className="h-5 w-5 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-white" />
            </motion.div>
          )}
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {uiVisible && (
            <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={spring}
              className="absolute bottom-0 left-0 right-0 z-20">
              <div className="bg-gradient-to-t from-[#0a0a10]/98 via-[#0a0a10]/90 to-transparent backdrop-blur-2xl">

                {/* Mobile: large thumb-friendly buttons */}
                <div className="flex sm:hidden items-center justify-between px-4 py-4 pb-5">
                  <button onClick={prev} disabled={page <= 1}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/60 transition-all active:scale-95 disabled:opacity-15 disabled:cursor-not-allowed min-h-[48px]">
                    <ChevronLeftIcon className="h-4 w-4" /> Prev
                  </button>
                  <div className="flex flex-col items-center min-w-[70px]">
                    <span className="text-lg tabular-nums font-bold text-white/55 tracking-tight">
                      <span className="text-white/75">{page}</span>
                      <span className="text-white/20">/{pages.length}</span>
                    </span>
                    <input type="range" min={1} max={pages.length} value={page} onChange={e => jump(parseInt(e.target.value))}
                      className="mt-1 h-1 w-full appearance-none rounded-full bg-white/[0.08] cursor-pointer" style={{ accentColor: "#00e5bf" }} />
                  </div>
                  <button onClick={next} disabled={page >= pages.length}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/60 transition-all active:scale-95 disabled:opacity-15 disabled:cursor-not-allowed min-h-[48px]">
                    Next <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Desktop footer */}
                <div className="hidden sm:flex items-center justify-between px-4 lg:px-6 py-3 lg:py-4">
                  <button onClick={prev} disabled={page <= 1}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 lg:px-6 py-2.5 lg:py-3 text-sm lg:text-base font-semibold text-white/55 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-white/85 active:scale-[0.97] disabled:opacity-15 disabled:cursor-not-allowed">
                    <ChevronLeftIcon className="h-4 w-4 lg:h-5 lg:w-5" /> Prev Page
                  </button>
                  <div className="flex items-center gap-4 lg:gap-6">
                    <input type="range" min={1} max={pages.length} value={page} onChange={e => jump(parseInt(e.target.value))}
                      className="h-1.5 lg:h-2 w-32 lg:w-56 xl:w-80 appearance-none rounded-full bg-white/[0.06] cursor-pointer" style={{ accentColor: "#00e5bf" }} />
                    <span className="text-sm lg:text-lg tabular-nums font-semibold text-white/35 min-w-[70px] lg:min-w-[90px] text-center tracking-tight">
                      <span className="text-white/60">{page}</span>
                      <span className="text-white/20"> / {pages.length}</span>
                    </span>
                  </div>
                  <button onClick={next} disabled={page >= pages.length}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 lg:px-6 py-2.5 lg:py-3 text-sm lg:text-base font-semibold text-white/55 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-white/85 active:scale-[0.97] disabled:opacity-15 disabled:cursor-not-allowed">
                    Next Page <ChevronRightIcon className="h-4 w-4 lg:h-5 lg:w-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
