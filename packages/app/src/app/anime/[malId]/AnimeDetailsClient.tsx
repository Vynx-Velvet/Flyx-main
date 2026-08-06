"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ExtensionGate } from "@/components/ExtensionGate";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  jikanFull,
  jikanEpisodes,
  jikanCharacters,
  jikanRelatedContent,
  type JikanAnime,
  type JikanEpisode,
  type JikanCharacter,
  type AnimeCard,
  type RelatedGroup,
} from "@/lib/anime/jikan-client";

type Tab = "episodes" | "characters" | "related" | "info";

function typeChip(type?: string | null): { label: string; color: string } {
  const t = (type || "").toLowerCase();
  if (t === "movie") return { label: "Movie", color: "#8b7cf0" };
  if (t === "ova") return { label: "OVA", color: "#f062a0" };
  if (t === "ona") return { label: "ONA", color: "#38bdf8" };
  if (t === "special" || t === "tv special")
    return { label: "Special", color: "#fbbf24" };
  return { label: type || "TV", color: "#00e5bf" };
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function AnimeDetailsClient({ malId }: { malId: number }) {
  return (
    <ExtensionGate type="anime">
      <AnimeDetailsClientInner malId={malId} />
    </ExtensionGate>
  );
}

function AnimeDetailsClientInner({ malId }: { malId: number }) {
  const router = useRouter();
  const { addItem, removeItem, isInWatchlist } = useWatchlist();
  const [anime, setAnime] = useState<JikanAnime | null>(null);
  const [episodes, setEpisodes] = useState<JikanEpisode[]>([]);
  const [characters, setCharacters] = useState<JikanCharacter[]>([]);
  const [relationGroups, setRelationGroups] = useState<RelatedGroup[]>([]);
  const [recommendations, setRecommendations] = useState<AnimeCard[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("episodes");
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const malKey = String(malId);
  const inList = isInWatchlist(malKey, "anime");

  useEffect(() => {
    if (!malId) {
      setError(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setRelationGroups([]);
    setRecommendations([]);
    setRelatedLoading(true);
    setCharacters([]);
    setEpisodes([]);

    (async () => {
      const data = await jikanFull(malId);
      if (cancelled) return;
      if (!data) {
        setError(true);
        setLoading(false);
        return;
      }
      setAnime(data);
      setLoading(false);

      // Seed relations immediately from /full (Jikan or AniList) so Related isn't empty
      const seeded = await jikanRelatedContent(data.mal_id, data);
      if (cancelled) return;
      setRelationGroups(seeded.relations);
      setRecommendations(seeded.recommendations);
      setRelatedLoading(false);

      // Episodes + characters in parallel (queue still serializes network)
      const [eps, chars] = await Promise.all([
        jikanEpisodes(data.mal_id, undefined, 2),
        jikanCharacters(data.mal_id),
      ]);
      if (cancelled) return;
      setEpisodes(eps);
      setCharacters(chars);
    })();

    return () => {
      cancelled = true;
    };
  }, [malId]);

  const isMovie = anime?.type === "Movie";
  const mainChars = useMemo(
    () => characters.filter((c) => c.role === "Main").slice(0, 18),
    [characters],
  );
  const supportingChars = useMemo(
    () => characters.filter((c) => c.role === "Supporting").slice(0, 12),
    [characters],
  );
  const trailerId = anime?.trailer?.youtube_id || null;
  const epCount =
    episodes.length > 0 ? episodes.length : (anime?.episodes ?? 0);

  const relatedCount =
    relationGroups.reduce((n, g) => n + g.items.length, 0) +
    recommendations.length;

  const playEp = useCallback(
    (epNum: number) => {
      const q = new URLSearchParams({
        malId: String(malId),
        mediaType: "anime",
      });
      if (!isMovie && epNum) q.set("episode", String(epNum));
      router.push(`/watch?${q.toString()}`);
    },
    [isMovie, malId, router],
  );

  const poster =
    anime?.images?.webp?.large_image_url ||
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.jpg?.image_url ||
    "";

  const toggleWatchlist = useCallback(() => {
    if (!anime) return;
    if (inList) {
      removeItem(malKey, "anime");
      return;
    }
    addItem({
      contentId: malKey,
      mediaType: "anime",
      title: anime.title_english || anime.title,
      posterPath: poster || undefined,
      rating: anime.score ?? undefined,
      year: anime.year != null ? String(anime.year) : undefined,
    });
  }, [anime, inList, malKey, poster, addItem, removeItem]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[rgba(0,229,191,0.2)] border-t-[#00e5bf]" />
          <p className="text-sm text-white/40">Loading anime details…</p>
        </div>
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <p className="mb-2 font-[family-name:var(--font-display)] text-xl font-semibold text-white">
            Failed to load anime
          </p>
          <p className="mb-6 text-sm text-white/40">
            The anime data couldn&apos;t be retrieved right now.
          </p>
          <button
            type="button"
            onClick={() => router.push("/anime")}
            className="btn-primary"
          >
            Back to Browse
          </button>
        </div>
      </div>
    );
  }

  const tabs = (
    [
      {
        id: "episodes" as Tab,
        label: !isMovie ? "Episodes" : "Movie",
        count: !isMovie && epCount > 0 ? epCount : undefined,
      },
      {
        id: "characters" as Tab,
        label: "Characters",
        count: characters.length > 0 ? characters.length : undefined,
      },
      {
        id: "related" as Tab,
        label: "Related",
        count: relatedCount > 0 ? relatedCount : undefined,
        loading: relatedLoading && relatedCount === 0,
      },
      { id: "info" as Tab, label: "Details" },
    ] as const
  );

  return (
    <div className="anime-detail min-h-screen text-white">
      <div className="page-glow" />

      <HeroBanner
        anime={anime}
        poster={poster}
        isMovie={isMovie}
        epCount={epCount}
        synopsisExpanded={synopsisExpanded}
        onToggleSynopsis={() => setSynopsisExpanded((v) => !v)}
        trailerId={trailerId}
        onTrailer={() => setTrailerOpen(true)}
        onWatch={() => playEp(1)}
        onBack={() => router.push("/anime")}
        inList={inList}
        onToggleList={toggleWatchlist}
      />

      {/* Pill tab strip — sticky, compact */}
      <div className="anime-detail-tabs-sticky">
        <div className="content-container">
          <div className="anime-detail-tabs" role="tablist" aria-label="Anime sections">
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`anime-detail-tab${active ? " anime-detail-tab-active" : ""}`}
                >
                  <span className="anime-detail-tab-label">{t.label}</span>
                  {"loading" in t && t.loading ? (
                    <span className="anime-detail-tab-spinner" aria-hidden />
                  ) : "count" in t && t.count != null ? (
                    <span className="anime-detail-tab-count">{t.count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="content-container anime-detail-panel">
        <AnimatePresence mode="wait">
          {tab === "episodes" && (
            <motion.div
              key="ep"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <EpisodesTab
                episodes={episodes}
                fallbackCount={epCount}
                isMovie={isMovie}
                poster={poster}
                onPlay={playEp}
                onWatchMovie={() => playEp(1)}
              />
            </motion.div>
          )}
          {tab === "characters" && (
            <motion.div
              key="ch"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <CharactersTab main={mainChars} supporting={supportingChars} />
            </motion.div>
          )}
          {tab === "related" && (
            <motion.div
              key="rel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <RelatedTab
                relations={relationGroups}
                recommendations={recommendations}
                loading={relatedLoading}
                onOpen={(a) => router.push(`/anime/${a.mal_id}`)}
              />
            </motion.div>
          )}
          {tab === "info" && (
            <motion.div
              key="inf"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <InfoTab anime={anime} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {trailerOpen && trailerId && (
        <TrailerModal
          youtubeId={trailerId}
          onClose={() => setTrailerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────

function HeroBanner({
  anime,
  poster,
  isMovie,
  epCount,
  synopsisExpanded,
  onToggleSynopsis,
  trailerId,
  onTrailer,
  onWatch,
  onBack,
  inList,
  onToggleList,
}: {
  anime: JikanAnime;
  poster: string;
  isMovie: boolean;
  epCount: number;
  synopsisExpanded: boolean;
  onToggleSynopsis: () => void;
  trailerId: string | null;
  onTrailer: () => void;
  onWatch: () => void;
  onBack: () => void;
  inList: boolean;
  onToggleList: () => void;
}) {
  const chip = typeChip(anime.type);
  const airing = anime.status === "Currently Airing";

  // Compact meta — avoid chip soup
  const metaBits: string[] = [];
  if (anime.year != null) metaBits.push(String(anime.year));
  if (!isMovie && epCount > 0) metaBits.push(`${epCount} eps`);
  if (anime.duration) metaBits.push(anime.duration);

  return (
    <header className="anime-detail-hero">
      <div className="anime-detail-hero-bg" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="anime-detail-hero-bg-img" />
        <div className="anime-detail-hero-bg-scrim" />
      </div>

      <div className="content-container anime-detail-hero-body">
        <button type="button" onClick={onBack} className="anime-detail-back">
          <ArrowLeft className="h-3.5 w-3.5" />
          Anime
        </button>

        <div className="anime-detail-hero-row">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="anime-detail-poster-wrap"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt={anime.title}
              className="anime-detail-poster"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="anime-detail-hero-copy"
          >
            <h1 className="anime-detail-title">
              {anime.title_english || anime.title}
            </h1>
            {anime.title_english && anime.title_english !== anime.title && (
              <p className="anime-detail-subtitle">{anime.title}</p>
            )}

            <div className="anime-detail-meta">
              {anime.score != null && (
                <span className="anime-detail-score">
                  <Star className="h-3.5 w-3.5" />
                  {anime.score.toFixed(2)}
                </span>
              )}
              <span
                className="anime-detail-type"
                style={{
                  color: chip.color,
                  borderColor: `${chip.color}45`,
                  background: `${chip.color}14`,
                }}
              >
                {chip.label}
              </span>
              {anime.status && (
                <span
                  className={`anime-detail-status${airing ? " is-airing" : ""}`}
                >
                  {airing && <span className="anime-detail-live-dot" />}
                  {anime.status}
                </span>
              )}
              {metaBits.map((b) => (
                <span key={b} className="anime-detail-meta-bit">
                  {b}
                </span>
              ))}
              {anime.rating && (
                <span className="anime-detail-meta-bit is-rating">
                  {anime.rating.replace(/\(.*\)/, "").trim()}
                </span>
              )}
            </div>

            {(anime.genres?.length ?? 0) > 0 && (
              <div className="anime-detail-genres">
                {(anime.genres ?? []).slice(0, 6).map((g) => (
                  <span key={g.mal_id}>{g.name}</span>
                ))}
              </div>
            )}

            {anime.synopsis && (
              <div className="anime-detail-synopsis">
                <p className={synopsisExpanded ? "" : "line-clamp-3"}>
                  {anime.synopsis}
                </p>
                {anime.synopsis.length > 220 && (
                  <button
                    type="button"
                    onClick={onToggleSynopsis}
                    className="anime-detail-readmore"
                  >
                    {synopsisExpanded ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}

            <div className="anime-detail-actions">
              <button
                type="button"
                onClick={onWatch}
                className="btn-primary !px-5 !py-2.5 text-sm"
              >
                <PlayIcon className="h-4 w-4" />
                {isMovie ? "Watch Movie" : "Watch Now"}
              </button>
              <button
                type="button"
                onClick={onToggleList}
                className={`btn-secondary !px-4 !py-2.5 text-sm ${
                  inList ? "!border-[#00e5bf]/35 !text-[#00e5bf]" : ""
                }`}
                aria-pressed={inList}
              >
                {inList ? "✓ In List" : "+ My List"}
              </button>
              {trailerId && (
                <button
                  type="button"
                  onClick={onTrailer}
                  className="btn-ghost !px-3 !py-2.5 text-sm"
                >
                  <FilmIcon className="h-4 w-4" /> Trailer
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

// ─── Episodes ───────────────────────────────────────────────────────────────

function EpisodesTab({
  episodes,
  fallbackCount,
  isMovie,
  poster,
  onPlay,
  onWatchMovie,
}: {
  episodes: JikanEpisode[];
  fallbackCount: number;
  isMovie: boolean;
  poster: string;
  onPlay: (ep: number) => void;
  onWatchMovie: () => void;
}) {
  if (isMovie) {
    return (
      <div className="anime-ep-movie">
        <div className="anime-ep-movie-icon">
          <FilmIcon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h3>Feature film</h3>
          <p>No episode list — stream the full movie.</p>
        </div>
        <button type="button" onClick={onWatchMovie} className="btn-primary shrink-0">
          <PlayIcon className="h-4 w-4" /> Watch
        </button>
      </div>
    );
  }

  if (episodes.length > 0) {
    return (
      <div className="anime-ep-list">
        {episodes.map((ep, i) => {
          const epNum = ep.mal_id || i + 1;
          return (
            <button
              key={`ep-${epNum}-${i}`}
              type="button"
              onClick={() => onPlay(epNum)}
              className="anime-ep-row"
            >
              <div className="anime-ep-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poster} alt="" aria-hidden />
                <span className="anime-ep-play">
                  <PlayIcon className="h-3 w-3" />
                </span>
                <span className="anime-ep-num">E{epNum}</span>
              </div>
              <div className="anime-ep-body">
                <div className="anime-ep-title">
                  {ep.title || `Episode ${epNum}`}
                </div>
                <div className="anime-ep-meta">
                  {ep.aired && (
                    <span>
                      {new Date(ep.aired).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {ep.filler && <span className="is-filler">Filler</span>}
                  {ep.recap && <span className="is-recap">Recap</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (fallbackCount > 0) {
    return (
      <div className="anime-ep-grid">
        {Array.from({ length: fallbackCount }, (_, i) => i + 1).map(
          (epNum) => (
            <button
              key={epNum}
              type="button"
              onClick={() => onPlay(epNum)}
              className="anime-ep-cell"
            >
              {epNum}
            </button>
          ),
        )}
      </div>
    );
  }

  return (
    <div className="anime-detail-empty">
      <p>No episode data available yet</p>
    </div>
  );
}

// ─── Characters ─────────────────────────────────────────────────────────────

function CharactersTab({
  main,
  supporting,
}: {
  main: JikanCharacter[];
  supporting: JikanCharacter[];
}) {
  if (main.length === 0 && supporting.length === 0) {
    return (
      <div className="anime-detail-empty">
        <p>No character data available</p>
      </div>
    );
  }

  return (
    <div className="anime-char-sections">
      {main.length > 0 && (
        <section>
          <p className="anime-section-label">Main · {main.length}</p>
          <div className="anime-char-grid">
            {main.map((c, i) => (
              <CharacterCard key={`main-${c.character.mal_id}-${i}`} c={c} />
            ))}
          </div>
        </section>
      )}
      {supporting.length > 0 && (
        <section>
          <p className="anime-section-label">Supporting · {supporting.length}</p>
          <div className="anime-char-grid">
            {supporting.map((c, i) => (
              <CharacterCard key={`sup-${c.character.mal_id}-${i}`} c={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CharacterCard({ c }: { c: JikanCharacter }) {
  const jp = c.voice_actors?.find((v) => v.language === "Japanese");
  const img =
    (c.character.images as any)?.webp?.image_url ||
    c.character.images?.jpg?.image_url ||
    "";

  return (
    <div className="anime-char-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={c.character.name} loading="lazy" />
      <div className="min-w-0">
        <div className="anime-char-name">{c.character.name}</div>
        <div className="anime-char-role">{c.role}</div>
        {jp && (
          <div className="anime-char-va">
            <MicIcon className="h-2.5 w-2.5 shrink-0" />
            {jp.person.name}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Related (franchise + recommendations) ──────────────────────────────────

function RelatedTab({
  relations,
  recommendations,
  loading,
  onOpen,
}: {
  relations: RelatedGroup[];
  recommendations: AnimeCard[];
  loading: boolean;
  onOpen: (a: AnimeCard) => void;
}) {
  const hasRelations = relations.some((g) => g.items.length > 0);
  const hasRecs = recommendations.length > 0;

  if (loading && !hasRelations && !hasRecs) {
    return (
      <div className="content-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[2/3] rounded-[0.9rem]" />
            <div className="skeleton mt-2 h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!hasRelations && !hasRecs) {
    return (
      <div className="anime-detail-empty">
        <p>No related titles yet</p>
        <span>Franchise links appear when available from MAL / AniList.</span>
      </div>
    );
  }

  return (
    <div className="anime-related-sections">
      {relations.map((group) =>
        group.items.length === 0 ? null : (
          <section key={group.relation}>
            <p className="anime-section-label">
              {group.relation} · {group.items.length}
            </p>
            <div className="content-grid">
              {group.items.map((item) => (
                <RelatedPoster
                  key={`${group.relation}-${item.mal_id}`}
                  item={item}
                  badge={group.relation}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        ),
      )}

      {hasRecs && (
        <section>
          <p className="anime-section-label">
            Recommended · {recommendations.length}
          </p>
          <div className="content-grid">
            {recommendations.map((item) => (
              <RelatedPoster
                key={`rec-${item.mal_id}`}
                item={item}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RelatedPoster({
  item,
  badge,
  onOpen,
}: {
  item: AnimeCard;
  badge?: string;
  onOpen: (a: AnimeCard) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const chip = typeChip(item.type);
  const rating = item.score ?? 0;
  const hasRating = item.score != null && item.score > 0;
  const title = item.title_english || item.title;

  const circleLen = 2 * Math.PI * 14;
  const pct = Math.min((rating / 10) * 100, 100);
  const dash = (pct / 100) * circleLen;
  const ringColor =
    rating >= 7 ? "#2dd4a8" : rating >= 5 ? "#f59e0b" : "#f45050";

  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, [item.image]);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group w-full cursor-pointer border-0 bg-transparent p-0 text-left"
      aria-label={`View ${title}`}
    >
      <div
        className="relative w-full overflow-hidden rounded-[0.9rem] bg-[#111118] transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:scale-[1.02]"
        style={{
          aspectRatio: "2/3",
          boxShadow:
            "0 10px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 z-[6] rounded-[0.9rem] opacity-0 transition-opacity group-hover:opacity-100"
          style={{ boxShadow: "inset 0 0 0 1.5px rgba(0,229,191,0.35)" }}
        />
        {item.image ? (
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
              onLoad={() => setLoaded(true)}
              className={`absolute inset-0 z-[2] h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.05] ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          </>
        ) : (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-gradient-to-br from-[#1a1a24] to-[#0e0e14] px-3 text-center text-xs font-semibold text-white/25">
            {title}
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[42%]"
          style={{
            background:
              "linear-gradient(to top, rgba(3,3,7,0.85) 0%, transparent 100%)",
          }}
        />

        {hasRating && (
          <div className="absolute right-2 top-2 z-10">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10"
              style={{
                background: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(10px)",
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
              <span className="relative text-[10px] font-bold tabular-nums text-white sm:text-[11px]">
                {rating.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        <span
          className="poster-type-badge absolute left-2 top-2 z-10"
          style={{
            display: "inline-flex",
            padding: "7px 12px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: "rgba(0,0,0,0.72)",
            border: `1px solid ${chip.color}60`,
            color: chip.color,
            backdropFilter: "blur(10px)",
          }}
        >
          {badge && badge.length <= 12 ? badge : chip.label}
        </span>
      </div>

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
              {item.year != null && <span className="text-white/20">·</span>}
              <span className="font-semibold tabular-nums text-amber-300/90">
                ★ {rating.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Info (fixed field mapping) ─────────────────────────────────────────────

function InfoTab({ anime }: { anime: JikanAnime }) {
  const rows = (
    [
      ["Format", anime.type],
      ["Status", anime.status],
      ["Episodes", anime.episodes?.toString()],
      ["Duration", anime.duration],
      ["Rating", anime.rating],
      [
        "Season",
        anime.season
          ? `${anime.season.charAt(0).toUpperCase()}${anime.season.slice(1)} ${anime.year || ""}`.trim()
          : anime.year?.toString(),
      ],
      ["Aired", anime.aired?.string],
      ["Source", anime.source],
      [
        "Studios",
        anime.studios?.map((s) => s.name).filter(Boolean).join(", "),
      ],
      [
        "Producers",
        anime.producers?.map((p) => p.name).filter(Boolean).join(", "),
      ],
      [
        "Licensors",
        anime.licensors?.map((l) => l.name).filter(Boolean).join(", "),
      ],
      ["Genres", anime.genres?.map((g) => g.name).join(", ")],
      ["Themes", anime.themes?.map((t) => t.name).join(", ")],
      [
        "Demographics",
        anime.demographics?.map((d) => d.name).join(", "),
      ],
      ["Japanese", anime.title_japanese],
      [
        "Popularity",
        anime.popularity != null ? `#${anime.popularity}` : undefined,
      ],
      ["Rank", anime.rank != null ? `#${anime.rank}` : undefined],
    ] as [string, string | undefined][]
  ).filter(
    ([, v]) => v != null && v !== "" && v !== "undefined" && v !== "Not available",
  ) as [string, string][];

  const openings = anime.theme?.openings || [];
  const endings = anime.theme?.endings || [];

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

      {anime.background && (
        <div className="anime-info-block">
          <p className="anime-section-label">Background</p>
          <p className="anime-info-prose">{anime.background}</p>
        </div>
      )}

      {openings.length > 0 && (
        <div className="anime-info-block">
          <p className="anime-section-label">Openings</p>
          <ul className="anime-info-themes">
            {openings.map((op, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {op.replace(/"/g, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {endings.length > 0 && (
        <div className="anime-info-block">
          <p className="anime-section-label">Endings</p>
          <ul className="anime-info-themes is-end">
            {endings.map((ed, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                {ed.replace(/"/g, "")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Trailer ────────────────────────────────────────────────────────────────

function TrailerModal({
  youtubeId,
  onClose,
}: {
  youtubeId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="relative aspect-video w-full max-w-5xl"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title="Trailer"
          allow="autoplay; encrypted-media; fullscreen"
          className="h-full w-full rounded-2xl border border-white/5 shadow-2xl"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-4 -top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white font-bold text-black shadow-xl transition-transform hover:scale-105"
        >
          ✕
        </button>
      </motion.div>
    </motion.div>
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
function FilmIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 8h4M3 12h4M3 16h4M17 8h4M17 12h4M17 16h4" />
    </svg>
  );
}
function ArrowLeft({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="8" y="1" width="8" height="12" rx="4" />
      <path d="M4 11a8 8 0 0 0 16 0M12 17v6M9 23h6" />
    </svg>
  );
}
