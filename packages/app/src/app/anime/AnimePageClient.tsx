"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ExtensionGate } from "@/components/ExtensionGate";
import {
  jikanList,
  jikanSearch,
  GENRES,
  type AnimeCard as Anime,
} from "@/lib/anime/jikan-client";

// ─── Category definitions ──────────────────────────────────────────────────

interface CategoryDef {
  id: string;
  title: string;
  subtitle: string;
  endpoint: string;
}

const FEATURED_DEFS: CategoryDef[] = [
  {
    id: "popular",
    title: "Most Popular",
    subtitle: "All-time fan favorites",
    endpoint: "/top/anime?limit=16&filter=bypopularity",
  },
  {
    id: "airing",
    title: "Currently Airing",
    subtitle: "Fresh episodes this season",
    endpoint: "/seasons/now?limit=16",
  },
  {
    id: "top-rated",
    title: "Top Rated",
    subtitle: "Highest scored by the community",
    endpoint: "/top/anime?limit=16",
  },
  {
    id: "upcoming",
    title: "Upcoming",
    subtitle: "Coming next season",
    endpoint: "/seasons/upcoming?limit=14",
  },
  {
    id: "movies",
    title: "Anime Movies",
    subtitle: "Feature-length gems",
    endpoint: "/top/anime?limit=14&type=movie",
  },
];

const ALL_TAB = "all";

/** Map MAL type → display chip + accent (Flyx palette) */
function typeChip(type?: string | null): { label: string; color: string } {
  const t = (type || "").toLowerCase();
  if (t === "movie") return { label: "Movie", color: "#8b7cf0" };
  if (t === "ova") return { label: "OVA", color: "#f062a0" };
  if (t === "ona") return { label: "ONA", color: "#38bdf8" };
  if (t === "special" || t === "tv special")
    return { label: "Special", color: "#fbbf24" };
  if (t === "music") return { label: "Music", color: "#a78bfa" };
  return { label: type || "TV", color: "#00e5bf" };
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function AnimePageClient() {
  return (
    <ExtensionGate type="anime">
      <AnimePageClientInner />
    </ExtensionGate>
  );
}

function AnimePageClientInner() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB);
  const [hero, setHero] = useState<{ item: Anime; idx: number } | null>(null);
  const [featured, setFeatured] = useState<Record<string, Anime[]>>({});
  const [genreData, setGenreData] = useState<Record<string, Anime[]>>({});
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingGenre, setLoadingGenre] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Anime[] | null>(null);
  const [searching, setSearching] = useState(false);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const first = FEATURED_DEFS[0];
      const popular = await jikanList(first.endpoint);
      if (cancelled) return;
      setFeatured((prev) => ({ ...prev, [first.id]: popular }));
      setLoadingFeatured(false);

      for (const def of FEATURED_DEFS.slice(1)) {
        if (cancelled) return;
        const items = await jikanList(def.endpoint);
        if (cancelled) return;
        setFeatured((prev) => ({ ...prev, [def.id]: items }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // First category that actually returned items — the hero must render
    // even when "Most Popular" / "Currently Airing" come back empty
    // (e.g. upstream rate limits). Empty arrays are truthy, so || chains
    // would pick an empty list and strand the title bar on a spinner.
    const candidates = FEATURED_DEFS.map((def) => featured[def.id] || []).find(
      (items) => items.length > 0,
    ) || [];
    if (candidates.length === 0) return;
    const top = candidates.slice(0, 8);
    setHero({ item: top[0], idx: 0 });
    if (top.length <= 1) return;
    heroTimer.current = setInterval(() => {
      setHero((prev) => {
        const next = ((prev?.idx ?? 0) + 1) % top.length;
        return { item: top[next], idx: next };
      });
    }, 6000);
    return () => {
      if (heroTimer.current) clearInterval(heroTimer.current);
    };
  }, [featured]);

  useEffect(() => {
    if (activeTab === ALL_TAB) return;
    const genre = GENRES.find((g) => String(g.id) === activeTab);
    if (!genre || genreData[activeTab]?.length) return;
    let cancelled = false;
    setLoadingGenre(true);
    (async () => {
      const items = await jikanList(
        `/anime?genres=${genre.id}&order_by=popularity&sort=desc&limit=18&sfw=true`,
      );
      if (cancelled) return;
      setGenreData((prev) => ({ ...prev, [activeTab]: items }));
      setLoadingGenre(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, genreData]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const items = await jikanSearch(query);
      if (cancelled) return;
      setSearchResults(items);
      setSearching(false);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const openAnime = useCallback(
    (item: Anime) => router.push(`/anime/${item.mal_id}`),
    [router],
  );

  const selectHero = useCallback(
    (idx: number) => {
      const candidates = (featured.popular || featured.airing || []).slice(
        0,
        8,
      );
      if (candidates[idx]) setHero({ item: candidates[idx], idx });
      if (heroTimer.current) clearInterval(heroTimer.current);
      heroTimer.current = setInterval(() => {
        setHero((prev) => {
          const next = ((prev?.idx ?? 0) + 1) % candidates.length;
          return { item: candidates[next], idx: next };
        });
      }, 6000);
    },
    [featured.popular, featured.airing],
  );

  const showSearch = searchResults !== null;
  const showGenre = activeTab !== ALL_TAB && !showSearch;
  const showFeatured = activeTab === ALL_TAB && !showSearch;

  return (
    <div className="min-h-screen text-white">
      <div className="page-glow" />
      <HeroSection
        hero={hero}
        featured={featured}
        onSelectIdx={selectHero}
        onPlay={openAnime}
        loading={loadingFeatured}
      />
      <StickyBar
        query={query}
        onQuery={setQuery}
        activeTab={activeTab}
        onTab={setActiveTab}
        hideGenres={showSearch}
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
              <SearchResults
                query={query}
                results={searchResults}
                loading={searching}
                onOpen={openAnime}
              />
            </motion.div>
          )}
          {showGenre && (
            <motion.div
              key="genre"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <GenreView
                genreId={activeTab}
                items={genreData[activeTab] || []}
                loading={loadingGenre}
                onOpen={openAnime}
              />
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
              {FEATURED_DEFS.map((def) => {
                const items = featured[def.id];
                if (items === undefined)
                  return (
                    <RowSkeleton
                      key={def.id}
                      title={def.title}
                      subtitle={def.subtitle}
                    />
                  );
                if (items.length === 0) return null;
                return (
                  <CategoryRow
                    key={def.id}
                    title={def.title}
                    subtitle={def.subtitle}
                    items={items}
                    onItemClick={openAnime}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroSection({
  hero,
  featured,
  onSelectIdx,
  onPlay,
  loading,
}: {
  hero: { item: Anime; idx: number } | null;
  featured: Record<string, Anime[]>;
  onSelectIdx: (i: number) => void;
  onPlay: (item: Anime) => void;
  loading: boolean;
}) {
  // Same first-non-empty pick as the hero effect — an empty popular list
  // must not strand the title bar (empty arrays are truthy).
  const candidates = (FEATURED_DEFS.map((def) => featured[def.id] || []).find(
    (items) => items.length > 0,
  ) || []).slice(0, 8);
  const current = hero?.item;

  if (!current) {
    return (
      <section className="relative flex h-[42vh] min-h-[280px] max-h-[420px] items-center justify-center">
        <div className="hero-vignette" />
        {loading ? <div className="loading" /> : null}
      </section>
    );
  }

  const chip = typeChip(current.type);

  return (
    <section className="relative h-[52vh] min-h-[340px] max-h-[520px] overflow-hidden">
      <motion.div
        key={current.mal_id}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current.image ? (
          <img
            src={current.image}
            alt=""
            aria-hidden
            className="h-full w-full scale-110 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
        <div className="hero-vignette" />
      </motion.div>

      <div className="content-container relative flex h-full items-end pb-8 md:pb-10">
        <motion.div
          key={`copy-${current.mal_id}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="max-w-2xl"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="badge">Featured</span>
            {current.score != null && (
              <span className="rating-badge !py-1.5 !px-2.5 !text-xs">
                <Star className="h-3 w-3" />
                {current.score.toFixed(2)}
              </span>
            )}
            <span
              className="meta-chip uppercase tracking-wider !text-[10px]"
              style={{
                color: chip.color,
                borderColor: `${chip.color}40`,
              }}
            >
              {chip.label}
            </span>
          </div>

          <h1 className="hero-title line-clamp-2 text-3xl md:text-5xl lg:text-[3.25rem]">
            {current.title_english || current.title}
          </h1>
          {current.title_english &&
            current.title !== current.title_english && (
              <p className="mt-1.5 text-sm font-medium text-white/45">
                {current.title}
              </p>
            )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/40">
            {current.year && <span>{current.year}</span>}
            {current.episodes != null && (
              <>
                {current.year && <span className="text-white/20">·</span>}
                <span>
                  {current.episodes} episode
                  {current.episodes !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onPlay(current)}
              className="btn-primary !px-5 !py-2.5 text-sm"
            >
              <PlayIcon className="h-4 w-4" />
              View Details
            </button>
          </div>

          {candidates.length > 1 && (
            <div className="mt-5 flex gap-1.5">
              {candidates.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectIdx(i)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === hero?.idx
                      ? "w-6 bg-[#00e5bf]"
                      : "w-3 bg-white/20 hover:bg-white/40"
                  }`}
                  style={
                    i === hero?.idx
                      ? { boxShadow: "0 0 12px rgba(0,229,191,0.5)" }
                      : undefined
                  }
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

// ─── Sticky search + genre strip ────────────────────────────────────────────

function StickyBar({
  query,
  onQuery,
  activeTab,
  onTab,
  hideGenres,
}: {
  query: string;
  onQuery: (q: string) => void;
  activeTab: string;
  onTab: (id: string) => void;
  hideGenres: boolean;
}) {
  const genreScrollRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);

  const checkScroll = () => {
    const el = genreScrollRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = genreScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hideGenres]);

  return (
    <div className="anime-sticky">
      <div className="content-container anime-sticky-inner">
        {/* Search — matches home density */}
        <div className="anime-search">
          <span className="anime-search-icon" aria-hidden>
            <SearchIcon className="h-[18px] w-[18px]" />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search anime by title…"
            className="anime-search-input"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label="Clear search"
              className="anime-search-clear"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Genre categories — hide fully while searching */}
        {!hideGenres && (
          <div className="anime-genres-wrap">
            {canL && <div className="anime-genres-fade-l" aria-hidden />}
            {canR && <div className="anime-genres-fade-r" aria-hidden />}
            <div
              ref={genreScrollRef}
              onScroll={checkScroll}
              className="anime-genres"
              role="tablist"
              aria-label="Anime genres"
            >
              <GenreChip
                active={activeTab === ALL_TAB}
                onClick={() => onTab(ALL_TAB)}
              >
                All
              </GenreChip>
              {GENRES.map((g) => (
                <GenreChip
                  key={g.id}
                  active={activeTab === String(g.id)}
                  onClick={() => onTab(String(g.id))}
                >
                  {g.name}
                </GenreChip>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GenreChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`anime-genre-chip${active ? " anime-genre-chip-active" : ""}`}
    >
      {children}
    </button>
  );
}

// ─── Category row ───────────────────────────────────────────────────────────

function CategoryRow({
  title,
  subtitle,
  items,
  onItemClick,
}: {
  title: string;
  subtitle: string;
  items: Anime[];
  onItemClick: (item: Anime) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 4);
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
  }, [items.length]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -640 : 640,
      behavior: "smooth",
    });
  };

  return (
    <section className="content-container">
      <div className="section-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          <p className="section-sub">{subtitle}</p>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <ArrowBtn
            dir="left"
            onClick={() => scroll("left")}
            disabled={!canScrollL}
          />
          <ArrowBtn
            dir="right"
            onClick={() => scroll("right")}
            disabled={!canScrollR}
          />
        </div>
      </div>
      <div className="relative">
        {canScrollL && (
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-10 bg-gradient-to-r from-[#030307] to-transparent" />
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none sm:gap-3.5"
        >
          {items.map((item, i) => (
            <div
              key={`${item.mal_id}-${i}`}
              className="w-[138px] shrink-0 sm:w-[156px] md:w-[168px]"
            >
              <PosterCard
                item={item}
                onClick={() => onItemClick(item)}
                rank={i < 10 ? i + 1 : undefined}
              />
            </div>
          ))}
        </div>
        {canScrollR && (
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-10 bg-gradient-to-l from-[#030307] to-transparent" />
        )}
      </div>
    </section>
  );
}

function ArrowBtn({
  dir,
  onClick,
  disabled,
}: {
  dir: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-lg text-white transition-all hover:border-[rgba(0,229,191,0.3)] hover:bg-[rgba(0,229,191,0.12)] disabled:cursor-not-allowed disabled:opacity-30"
    >
      {dir === "left" ? "‹" : "›"}
    </button>
  );
}

// ─── Search results ─────────────────────────────────────────────────────────

function SearchResults({
  query,
  results,
  loading,
  onOpen,
}: {
  query: string;
  results: Anime[] | null;
  loading: boolean;
  onOpen: (a: Anime) => void;
}) {
  return (
    <section className="content-container pt-6">
      <div className="page-header mb-5">
        <p className="eyebrow">Search</p>
        <h1 className="!text-2xl md:!text-3xl">
          {loading ? "Searching…" : `Results for “${query}”`}
        </h1>
        {!loading && results && (
          <p className="subtitle">
            {results.length === 0
              ? "No matches"
              : `${results.length} title${results.length === 1 ? "" : "s"}`}
          </p>
        )}
      </div>
      {loading && <GridSkeleton count={12} />}
      {!loading && results && results.length === 0 && (
        <div className="glass-strong flex flex-col items-center rounded-3xl px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-white/70">
            No anime found for “{query}”
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-white/35">
            Try another title, or clear search and browse by genre.
          </p>
        </div>
      )}
      {!loading && results && results.length > 0 && (
        <div className="content-grid">
          {results.map((item, i) => (
            <PosterCard
              key={`${item.mal_id}-s-${i}`}
              item={item}
              onClick={() => onOpen(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Genre view ─────────────────────────────────────────────────────────────

function GenreView({
  genreId,
  items,
  loading,
  onOpen,
}: {
  genreId: string;
  items: Anime[];
  loading: boolean;
  onOpen: (a: Anime) => void;
}) {
  const genre = GENRES.find((g) => String(g.id) === genreId);
  return (
    <section className="content-container pt-6">
      <div className="page-header mb-5">
        <p className="eyebrow">Genre</p>
        <h1>{genre?.name ?? "Genre"}</h1>
        <p className="subtitle">
          {loading && items.length === 0
            ? "Loading catalog…"
            : `Popular ${genre?.name?.toLowerCase() ?? ""} anime`}
        </p>
      </div>
      {loading && items.length === 0 ? (
        <GridSkeleton count={12} />
      ) : (
        <div className="content-grid">
          {items.map((item, i) => (
            <PosterCard
              key={`${item.mal_id}-g-${i}`}
              item={item}
              onClick={() => onOpen(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Poster card (aligned with ContentCard) ─────────────────────────────────

function PosterCard({
  item,
  onClick,
  rank,
}: {
  item: Anime;
  onClick: () => void;
  rank?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const chip = typeChip(item.type);
  const rating = item.score ?? 0;
  const hasRating = item.score != null && item.score > 0;

  const circleLen = 2 * Math.PI * 14;
  const pct = Math.min((rating / 10) * 100, 100);
  const dash = (pct / 100) * circleLen;
  const ringColor =
    rating >= 7 ? "#2dd4a8" : rating >= 5 ? "#f59e0b" : "#f45050";

  const title = item.title_english || item.title;

  useEffect(() => {
    setLoaded(false);
    setImgError(false);
  }, [item.image]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !item.image) return;
    if (img.complete && img.naturalWidth > 0) setLoaded(true);
  }, [item.image]);

  const showImage = Boolean(item.image) && !imgError;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      aria-label={`View ${title}`}
    >
      <div className="w-full">
        {/* Poster only — rounded clip; title lives outside */}
        <div
          className="relative w-full overflow-hidden rounded-[0.9rem] bg-[#111118] transition-[transform,box-shadow] duration-300 ease-out will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.02]"
          style={{
            aspectRatio: "2/3",
            boxShadow:
              "0 10px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 z-[6] rounded-[0.9rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: "inset 0 0 0 1.5px rgba(0,229,191,0.35)" }}
            aria-hidden
          />

          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[#14141c]" />
            {showImage ? (
              <>
                {!loaded && (
                  <div className="skeleton absolute inset-0 z-[1] rounded-none" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={item.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onLoad={() => setLoaded(true)}
                  onError={() => {
                    setImgError(true);
                    setLoaded(false);
                  }}
                  className={`absolute inset-0 z-[2] h-full w-full object-cover transition-[transform,opacity] duration-300 ease-out group-hover:scale-[1.05] ${
                    loaded ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ transformOrigin: "center 30%" }}
                />
              </>
            ) : (
              <div className="absolute inset-0 z-[2] flex items-center justify-center bg-gradient-to-br from-[#1a1a24] to-[#0e0e14]">
                <span className="text-xs font-semibold text-white/20">
                  No art
                </span>
              </div>
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[42%]"
            style={{
              background:
                "linear-gradient(to top, rgba(3,3,7,0.8) 0%, transparent 100%)",
            }}
          />

          {/* Netflix-style rank on rails */}
          {rank != null && rank <= 10 && (
            <div
              className="pointer-events-none absolute bottom-1 left-1.5 z-[5] font-[family-name:var(--font-display)] text-[2.5rem] font-black leading-none tracking-tighter sm:text-[2.75rem]"
              style={{
                color: "rgba(255,255,255,0.95)",
                textShadow: "0 2px 10px rgba(0,0,0,0.95), 0 0 1px #000",
              }}
              aria-hidden
            >
              {rank}
            </div>
          )}

          {/* Rating ring — same as ContentCard */}
          {hasRating && (
            <div className="absolute right-2 top-2 z-10">
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10"
                style={{
                  background: "rgba(0,0,0,0.72)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  boxShadow:
                    "0 3px 12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              >
                <svg
                  className="absolute inset-0 h-full w-full -rotate-90 p-[2px]"
                  viewBox="0 0 36 36"
                  aria-hidden
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="2.5"
                    strokeDasharray={`${dash.toFixed(1)} ${circleLen.toFixed(1)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="relative text-[10px] font-bold tabular-nums leading-none text-white sm:text-[11px]">
                  {rating.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Type chip — only when not showing rank (avoids clutter on top-10) */}
          {rank == null && (
            <span
              className="poster-type-badge absolute left-2 top-2 z-10"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 7,
                paddingBottom: 7,
                paddingLeft: 12,
                paddingRight: 12,
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                background: "rgba(0, 0, 0, 0.72)",
                border: `1px solid ${chip.color}60`,
                color: chip.color,
                boxShadow: `0 0 14px ${chip.color}20`,
                WebkitBackdropFilter: "blur(10px)",
                backdropFilter: "blur(10px)",
              }}
            >
              {chip.label}
            </span>
          )}

          {/* Episode count — bottom-right, quiet */}
          {item.episodes != null && item.episodes > 0 && (
            <span className="anime-ep-chip absolute bottom-2 right-2 z-[5]">
              {item.episodes} ep{item.episodes !== 1 ? "s" : ""}
            </span>
          )}

          {/* Play affordance */}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div
              className="flex h-11 w-11 translate-y-2 scale-90 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
              style={{
                background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
                boxShadow: "0 8px 24px rgba(0,229,191,0.4)",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="#030307"
                className="ml-0.5"
                aria-hidden
              >
                <path d="M8 5.5v13l11-6.5L8 5.5z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Title + meta outside clip */}
        <div className="px-0.5 pb-0.5 pt-2">
          <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug tracking-tight text-white/95 sm:text-[13px]">
            {title}
          </p>
          <div className="mt-1 flex min-h-[1rem] items-center gap-1.5 text-[11px] text-white/45">
            {item.year != null && (
              <span className="tabular-nums">{item.year}</span>
            )}
            {hasRating && (
              <>
                {item.year != null && (
                  <span className="text-white/20">·</span>
                )}
                <span className="font-semibold tabular-nums text-amber-300/90">
                  ★ {rating.toFixed(1)}
                </span>
              </>
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

function RowSkeleton({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <section className="content-container">
      <div className="section-head">
        <div>
          <h2 className="!text-white/45">{title}</h2>
          <p className="section-sub !text-white/25">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="skeleton aspect-[2/3] w-[138px] shrink-0 rounded-[0.9rem] sm:w-[156px]"
          />
        ))}
      </div>
    </section>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function Star({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}
function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m21 21-4.3-4.3" />
    </svg>
  );
}
