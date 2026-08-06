"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ExtensionGate } from "@/components/ExtensionGate";
import {
  searchManga,
  getPopularManga,
  getLatestManga,
  getActionManga,
  getRomanceManga,
  getFantasyManga,
  MANGA_CATEGORIES,
  type MangaCategoryId,
} from "@/lib/manga/allmanga-client";
import type { MangaCard } from "@flyx/core";

// ─── Main ───────────────────────────────────────────────────────────────────

export default function MangaPageClient() {
  return (
    <ExtensionGate type="manga">
      <MangaPageClientInner />
    </ExtensionGate>
  );
}

function MangaPageClientInner() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<MangaCategoryId>("all");
  const [popular, setPopular] = useState<MangaCard[]>([]);
  const [latest, setLatest] = useState<MangaCard[]>([]);
  const [action, setAction] = useState<MangaCard[]>([]);
  const [romance, setRomance] = useState<MangaCard[]>([]);
  const [fantasy, setFantasy] = useState<MangaCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MangaCard[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Load all categories on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pop, lat, act, rom, fan] = await Promise.all([
          getPopularManga(16),
          getLatestManga(16),
          getActionManga(16),
          getRomanceManga(16),
          getFantasyManga(16),
        ]);
        if (cancelled) return;
        setPopular(pop);
        setLatest(lat);
        setAction(act);
        setRomance(rom);
        setFantasy(fan);
      } catch (e) {
        console.error("[MangaPage] Failed to load:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const results = await searchManga(query);
      if (cancelled) return;
      setSearchResults(results);
      setSearching(false);
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const openManga = useCallback(
    (item: MangaCard) => router.push(`/manga/${item.id}`),
    [router],
  );

  const showSearch = searchResults !== null;
  const showCategory = activeCategory !== "all" && !showSearch;
  const showFeatured = activeCategory === "all" && !showSearch;

  const candidates = popular.slice(0, 6);

  return (
    <div className="min-h-screen text-white">
      <div className="page-glow" />
      {candidates.length > 0 && (
        <HeroSection items={candidates} onOpen={openManga} />
      )}

      <StickyBar
        query={query}
        onQuery={setQuery}
        activeCategory={activeCategory}
        onCategory={setActiveCategory}
        hideCategories={showSearch}
      />

      <main className="relative pb-20">
        <AnimatePresence mode="wait">
          {showSearch && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SearchResults query={query} results={searchResults} loading={searching} onOpen={openManga} />
            </motion.div>
          )}
          {showCategory && (
            <motion.div
              key="category"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CategoryView categoryId={activeCategory} items={activeCategory === "popular" ? popular : latest} onOpen={openManga} />
            </motion.div>
          )}
          {showFeatured && (
            <motion.div
              key="featured"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="stack-sections pt-4"
            >
              {loading ? (
                <div className="flex min-h-[60vh] items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(0,229,191,0.2)] border-t-[#00e5bf]" />
                    <p className="text-sm text-white/40">Browsing manga library…</p>
                  </div>
                </div>
              ) : popular.length === 0 && latest.length === 0 && action.length === 0 ? (
                <div className="glass-strong flex min-h-[50vh] flex-col items-center justify-center rounded-3xl px-6 py-16 text-center">
                  <p className="mb-2 font-[family-name:var(--font-display)] text-lg font-semibold text-white/70">Could not load manga</p>
                  <p className="mb-6 max-w-xs text-sm text-white/35">The manga API is temporarily unavailable. Try searching for a specific title above.</p>
                  <button type="button" onClick={() => window.location.reload()} className="btn-primary !px-4 !py-2 text-sm">Retry</button>
                </div>
              ) : (
                <>
                  {popular.length > 0 && (
                    <CategoryRow title="Most Popular" subtitle="Fan-favorite manga" items={popular} onItemClick={openManga} />
                  )}
                  {latest.length > 0 && (
                    <CategoryRow title="Latest Updates" subtitle="Recently updated chapters" items={latest} onItemClick={openManga} />
                  )}
                  {action.length > 0 && (
                    <CategoryRow title="Action & Adventure" subtitle="Epic battles and heroes" items={action} onItemClick={openManga} />
                  )}
                  {romance.length > 0 && (
                    <CategoryRow title="Romance & Drama" subtitle="Love stories and feels" items={romance} onItemClick={openManga} />
                  )}
                  {fantasy.length > 0 && (
                    <CategoryRow title="Fantasy & Isekai" subtitle="Other worlds and magic" items={fantasy} onItemClick={openManga} />
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroSection({ items, onOpen }: { items: MangaCard[]; onOpen: (item: MangaCard) => void }) {
  const [idx, setIdx] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const current = items[idx] ?? items[0];
  if (!current) return null;

  useEffect(() => {
    if (items.length <= 1) return;
    timer.current = setInterval(() => setIdx((p) => (p + 1) % items.length), 6000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [items.length]);

  return (
    <section className="relative h-[48vh] min-h-[300px] max-h-[480px] overflow-hidden">
      <motion.div
        key={current.id}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/manga/image?url=${encodeURIComponent(current.coverImage)}`}
          alt=""
          aria-hidden
          className="h-full w-full scale-110 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="hero-vignette" />
      </motion.div>

      <div className="content-container relative flex h-full items-end pb-8 md:pb-10">
        <motion.div
          key={`copy-${current.id}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-2xl"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="badge">Featured</span>
            {current.chapterCount != null && current.chapterCount > 0 && (
              <span className="meta-chip !text-[10px]">
                {current.chapterCount} ch{current.chapterCount !== 1 ? "s" : ""}
              </span>
            )}
            {current.status && (
              <span
                className="meta-chip uppercase tracking-wider !text-[10px]"
                style={{
                  color: current.status === "completed" ? "#2dd4a8" : "#38bdf8",
                  borderColor: current.status === "completed" ? "#2dd4a840" : "#38bdf840",
                }}
              >
                {current.status}
              </span>
            )}
          </div>
          <h1 className="hero-title line-clamp-2 text-3xl md:text-5xl lg:text-[3.25rem]">
            {current.title}
          </h1>
          {current.altTitle && (
            <p className="mt-1.5 text-sm font-medium text-white/45">{current.altTitle}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <button type="button" onClick={() => onOpen(current)} className="btn-primary !px-5 !py-2.5 text-sm">
              <BookOpenIcon className="h-4 w-4" /> View Details
            </button>
          </div>
          {items.length > 1 && (
            <div className="mt-5 flex gap-1.5">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setIdx(i); if (timer.current) clearInterval(timer.current); }}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === idx ? "w-6 bg-[#00e5bf]" : "w-3 bg-white/20 hover:bg-white/40"
                  }`}
                  style={i === idx ? { boxShadow: "0 0 12px rgba(0,229,191,0.5)" } : undefined}
                  aria-label={`Show featured ${i + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Sticky Bar ─────────────────────────────────────────────────────────────

function StickyBar({
  query, onQuery, activeCategory, onCategory, hideCategories,
}: {
  query: string; onQuery: (q: string) => void;
  activeCategory: MangaCategoryId; onCategory: (id: MangaCategoryId) => void;
  hideCategories: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="anime-sticky">
      <div className="content-container anime-sticky-inner">
        <div className="anime-search">
          <span className="anime-search-icon" aria-hidden>
            <SearchIcon className="h-[18px] w-[18px]" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search manga by title…"
            className="anime-search-input"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button type="button" onClick={() => onQuery("")} aria-label="Clear search" className="anime-search-clear">
              ✕
            </button>
          ) : null}
        </div>
        {!hideCategories && (
          <div className="anime-genres-wrap">
            <div ref={scrollRef} className="anime-genres" role="tablist" aria-label="Manga categories">
              {MANGA_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => onCategory(cat.id)}
                  className={`anime-genre-chip${activeCategory === cat.id ? " anime-genre-chip-active" : ""}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Category Row ───────────────────────────────────────────────────────────

function CategoryRow({ title, subtitle, items, onItemClick }: {
  title: string; subtitle: string; items: MangaCard[]; onItemClick: (item: MangaCard) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => { checkScroll(); }, [items.length]);

  return (
    <section className="content-container">
      <div className="section-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          <p className="section-sub">{subtitle}</p>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <ArrowBtn dir="left" onClick={() => scrollRef.current?.scrollBy({ left: -640, behavior: "smooth" })} disabled={!canL} />
          <ArrowBtn dir="right" onClick={() => scrollRef.current?.scrollBy({ left: 640, behavior: "smooth" })} disabled={!canR} />
        </div>
      </div>
      <div className="relative">
        {canL && <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 bg-gradient-to-r from-[#030307] to-transparent" />}
        <div ref={scrollRef} onScroll={checkScroll} className="flex gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none sm:gap-3.5">
          {items.map((item, i) => (
            <div key={`${item.id}-${i}`} className="w-[138px] shrink-0 sm:w-[156px] md:w-[168px]">
              <MangaPosterCard item={item} onClick={() => onItemClick(item)} />
            </div>
          ))}
        </div>
        {canR && <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 bg-gradient-to-l from-[#030307] to-transparent" />}
      </div>
    </section>
  );
}

function ArrowBtn({ dir, onClick, disabled }: { dir: "left" | "right"; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-lg text-white transition-all hover:border-[rgba(0,229,191,0.3)] hover:bg-[rgba(0,229,191,0.12)] disabled:cursor-not-allowed disabled:opacity-30">
      {dir === "left" ? "‹" : "›"}
    </button>
  );
}

// ─── Search Results ─────────────────────────────────────────────────────────

function SearchResults({ query, results, loading, onOpen }: {
  query: string; results: MangaCard[] | null; loading: boolean; onOpen: (a: MangaCard) => void;
}) {
  return (
    <section className="content-container pt-6">
      <div className="page-header mb-5">
        <p className="eyebrow">Search</p>
        <h1 className="!text-2xl md:!text-3xl">{loading ? "Searching…" : `Results for "${query}"`}</h1>
        {!loading && results && (
          <p className="subtitle">{results.length === 0 ? "No matches" : `${results.length} title${results.length === 1 ? "" : "s"}`}</p>
        )}
      </div>
      {loading && <GridSkeleton count={12} />}
      {!loading && results && results.length === 0 && (
        <div className="glass-strong flex flex-col items-center rounded-3xl px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-white/70">No manga found for "{query}"</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/35">Try another title, or clear search and browse categories.</p>
        </div>
      )}
      {!loading && results && results.length > 0 && (
        <div className="content-grid">
          {results.map((item, i) => (
            <MangaPosterCard key={`${item.id}-s-${i}`} item={item} onClick={() => onOpen(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Category View ──────────────────────────────────────────────────────────

function CategoryView({ categoryId, items, onOpen }: {
  categoryId: MangaCategoryId; items: MangaCard[]; onOpen: (a: MangaCard) => void;
}) {
  const cat = MANGA_CATEGORIES.find((c) => c.id === categoryId);
  return (
    <section className="content-container pt-6">
      <div className="page-header mb-5">
        <p className="eyebrow">Category</p>
        <h1>{cat?.label ?? "Browse"}</h1>
        <p className="subtitle">{items.length} manga</p>
      </div>
      <div className="content-grid">
        {items.map((item, i) => (
          <MangaPosterCard key={`${item.id}-c-${i}`} item={item} onClick={() => onOpen(item)} />
        ))}
      </div>
    </section>
  );
}

// ─── Manga Poster Card ──────────────────────────────────────────────────────

function MangaPosterCard({ item, onClick }: { item: MangaCard; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => { setLoaded(false); setImgError(false); }, [item.coverImage]);
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !item.coverImage) return;
    if (img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [item.coverImage]);

  const isDataUrl = item.coverImage?.startsWith("data:");
  const showImage = Boolean(item.coverImage) && !isDataUrl && !imgError;

  return (
    <button type="button" onClick={onClick}
      className="group w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      aria-label={`View ${item.title}`}>
      <div className="w-full">
        <div className="relative w-full overflow-hidden rounded-[0.9rem] bg-[#111118] transition-[transform,box-shadow] duration-300 ease-out will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.02]"
          style={{ aspectRatio: "2/3", boxShadow: "0 10px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)" }}>
          <div className="pointer-events-none absolute inset-0 z-[6] rounded-[0.9rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: "inset 0 0 0 1.5px rgba(0,229,191,0.35)" }} aria-hidden />
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[#14141c]" />
            {showImage ? (
              <>
                {!loaded && <div className="skeleton absolute inset-0 z-[1] rounded-none" />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={`/api/manga/image?url=${encodeURIComponent(item.coverImage)}`} alt="" loading="lazy" decoding="async"
                  onLoad={() => setLoaded(true)} onError={() => { setImgError(true); setLoaded(false); }}
                  className={`absolute inset-0 z-[2] h-full w-full object-cover transition-[transform,opacity] duration-300 ease-out group-hover:scale-[1.05] ${loaded ? "opacity-100" : "opacity-0"}`}
                  style={{ transformOrigin: "center 30%" }} />
              </>
            ) : (
              <CoverPlaceholder title={item.title} />
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[42%]"
            style={{ background: "linear-gradient(to top, rgba(3,3,7,0.8) 0%, transparent 100%)" }} />
          {item.chapterCount != null && item.chapterCount > 0 && (
            <span className="anime-ep-chip absolute bottom-2 right-2 z-[5]">{item.chapterCount} ch{item.chapterCount !== 1 ? "s" : ""}</span>
          )}
          {item.status && (
            <span className="poster-type-badge absolute left-2 top-2 z-10" style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              paddingTop: 7, paddingBottom: 7, paddingLeft: 12, paddingRight: 12,
              borderRadius: 999, fontSize: 10, fontWeight: 700, lineHeight: 1.2,
              letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
              background: "rgba(0, 0, 0, 0.72)",
              border: `1px solid ${item.status === "completed" ? "#2dd4a840" : "#38bdf840"}`,
              color: item.status === "completed" ? "#2dd4a8" : "#38bdf8",
              boxShadow: `0 0 14px ${item.status === "completed" ? "#2dd4a820" : "#38bdf820"}`,
              WebkitBackdropFilter: "blur(10px)", backdropFilter: "blur(10px)",
            }}>
              {item.status}
            </span>
          )}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="flex h-11 w-11 translate-y-2 scale-90 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
              style={{ background: "linear-gradient(135deg, #00e5bf, #8b7cf0)", boxShadow: "0 8px 24px rgba(0,229,191,0.4)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#030307" className="ml-0.5" aria-hidden>
                <path d="M8 5.5v13l11-6.5L8 5.5z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="px-0.5 pb-0.5 pt-2">
          <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug tracking-tight text-white/95 sm:text-[13px]">{item.title}</p>
          <div className="mt-1 flex min-h-[1rem] items-center gap-1.5 text-[11px] text-white/45">
            {item.chapterCount != null && item.chapterCount > 0 && (
              <span className="tabular-nums">{item.chapterCount} chapters</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="content-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[2/3] rounded-[0.9rem]" />
          <div className="skeleton mt-2 h-3 w-3/4 rounded" />
          <div className="skeleton mt-1.5 h-2.5 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

function RowSkeleton({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="content-container">
      <div className="section-head">
        <div><h2 className="!text-white/45">{title}</h2><p className="section-sub !text-white/25">{subtitle}</p></div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[2/3] w-[138px] shrink-0 rounded-[0.9rem] sm:w-[156px]" />
        ))}
      </div>
    </section>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m21 21-4.3-4.3" />
    </svg>
  );
}

// ─── Cover Placeholder ──────────────────────────────────────────────────────

const PLACEHOLDER_GRADIENTS = [
  ["#f062a0", "#8b7cf0"],
  ["#00e5bf", "#38bdf8"],
  ["#fbbf24", "#f45050"],
  ["#8b7cf0", "#2dd4a8"],
  ["#38bdf8", "#f062a0"],
  ["#2dd4a8", "#fbbf24"],
];

function CoverPlaceholder({ title }: { title: string }) {
  // Deterministic gradient from title hash
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  const [from, to] = PLACEHOLDER_GRADIENTS[Math.abs(hash) % PLACEHOLDER_GRADIENTS.length]!;
  // Get initials (up to 2 chars)
  const words = title.trim().split(/\s+/);
  const initials = words.length >= 2
    ? (words[0]![0]! + words[1]![0]!).toUpperCase()
    : title.trim().substring(0, 2).toUpperCase();

  return (
    <div
      className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1"
      style={{ background: `linear-gradient(135deg, ${from}30, ${to}40)` }}
    >
      <span
        className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight drop-shadow-lg sm:text-4xl"
        style={{ color: from, textShadow: `0 2px 12px ${from}50` }}
      >
        {initials}
      </span>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function BookOpenIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}
