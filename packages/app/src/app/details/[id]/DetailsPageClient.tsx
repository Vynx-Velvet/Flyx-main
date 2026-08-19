"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import ContentCard from "@/components/ContentCard";
import ContentRail from "@/components/ui/ContentRail";
import { useWatchlist } from "@/hooks/useWatchlist";
import { ErrorState, PageLoader } from "@/components/ui/EmptyState";
import styles from "./DetailsPage.module.css";
import DownloadMenu from "@/components/downloads/DownloadMenu";

const IMG = "https://image.tmdb.org/t/p";

interface Genre {
  id: number;
  name: string;
}
interface CastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
}
interface CrewMember {
  id: number;
  name: string;
  job?: string;
}
interface Video {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  name?: string;
}
interface Season {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
  poster_path?: string | null;
}
interface Episode {
  id: number;
  name: string;
  overview?: string;
  episode_number: number;
  season_number: number;
  still_path?: string | null;
  air_date?: string;
  runtime?: number;
  vote_average?: number;
}
interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}
interface Details {
  id: number;
  title?: string;
  name?: string;
  tagline?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  genres?: Genre[];
  credits?: { cast?: CastMember[]; crew?: CrewMember[] };
  videos?: { results?: Video[] };
  recommendations?: { results?: MediaItem[] };
  similar?: { results?: MediaItem[] };
  seasons?: Season[];
  created_by?: { name: string }[];
  production_companies?: { name: string }[];
}

function formatRuntime(mins?: number) {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DetailsPageClient({
  id,
  mediaType,
  initialSeason,
}: {
  id: string;
  mediaType: "movie" | "tv";
  initialSeason?: number;
}) {
  const router = useRouter();
  const { addItem, removeItem, isInWatchlist } = useWatchlist();
  const [details, setDetails] = useState<Details | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(
    initialSeason && initialSeason > 0 ? initialSeason : 1,
  );
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [epsLoading, setEpsLoading] = useState(false);

  const title = details?.title ?? details?.name ?? "Untitled";
  const year = (details?.release_date ?? details?.first_air_date)?.slice(0, 4);
  const runtime =
    formatRuntime(details?.runtime) ||
    formatRuntime(details?.episode_run_time?.[0]);
  const inList = isInWatchlist(id, mediaType);

  // Keep browser tab in sync once client data is ready
  useEffect(() => {
    if (!details) return;
    const name = details.title ?? details.name;
    if (name) document.title = `${name} | Flyx`;
  }, [details]);

  const trailer = useMemo(() => {
    const vids = details?.videos?.results ?? [];
    const yt = vids.filter((v) => v.site === "YouTube");
    return (
      yt.find((v) => v.type === "Trailer" && v.official) ||
      yt.find((v) => v.type === "Trailer") ||
      yt.find((v) => v.type === "Teaser") ||
      yt[0] ||
      null
    );
  }, [details]);

  const director = useMemo(() => {
    if (mediaType === "movie") {
      return details?.credits?.crew?.find((c) => c.job === "Director")?.name;
    }
    return details?.created_by?.map((c) => c.name).join(", ");
  }, [details, mediaType]);

  const cast = useMemo(
    () => (details?.credits?.cast ?? []).slice(0, 14),
    [details],
  );

  const recommended = useMemo(() => {
    const recs = details?.recommendations?.results ?? [];
    if (recs.length > 0) return recs;
    return details?.similar?.results ?? [];
  }, [details]);

  const similar = useMemo(() => {
    const sim = details?.similar?.results ?? [];
    const recIds = new Set(
      (details?.recommendations?.results ?? []).map((r) => r.id),
    );
    const filtered = sim.filter((s) => !recIds.has(s.id));
    return filtered.length > 0 ? filtered : sim;
  }, [details]);

  const seasons = useMemo(() => {
    return (details?.seasons ?? [])
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number);
  }, [details]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        const path = `/${mediaType}/${id}?append_to_response=credits,videos,recommendations,similar`;
        const res = await fetch(`/api/tmdb?path=${encodeURIComponent(path)}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setDetails(data);
        setStatus("ready");
        const first =
          (data.seasons as Season[] | undefined)?.find(
            (s) => s.season_number > 0,
          )?.season_number ?? 1;
        if (!initialSeason) setSelectedSeason(first);
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, mediaType, initialSeason]);

  useEffect(() => {
    if (mediaType !== "tv" || !id || !selectedSeason) return;
    let cancelled = false;
    setEpsLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/tmdb?path=${encodeURIComponent(`/${mediaType}/${id}/season/${selectedSeason}`)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setEpisodes((data.episodes as Episode[]) ?? []);
      } catch {
        if (!cancelled) setEpisodes([]);
      } finally {
        if (!cancelled) setEpsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, mediaType, selectedSeason]);

  const playHref = useCallback(
    (season?: number, episode?: number) => {
      const q = new URLSearchParams({ tmdbId: id, mediaType });
      if (mediaType === "tv") {
        q.set("season", String(season ?? selectedSeason ?? 1));
        q.set("episode", String(episode ?? 1));
      }
      return `/watch?${q.toString()}`;
    },
    [id, mediaType, selectedSeason],
  );

  const toggleWatchlist = useCallback(() => {
    if (!details) return;
    if (inList) {
      removeItem(id, mediaType);
    } else {
      addItem({
        contentId: id,
        mediaType,
        title,
        posterPath: details.poster_path
          ? `${IMG}/w500${details.poster_path}`
          : undefined,
        rating: details.vote_average,
        year,
      });
    }
  }, [details, inList, id, mediaType, title, year, addItem, removeItem]);

  if (status === "loading") {
    return <PageLoader message="Loading title…" />;
  }

  if (status === "error" || !details) {
    return (
      <main className={styles.page}>
        <div className="content-container py-16">
          <ErrorState
            title="Couldn't load this title"
            description="It may have been removed, or TMDB is temporarily unavailable."
            onRetry={() => window.location.reload()}
          />
          <div className="mt-5 flex justify-center">
            <Link href="/browse" className="btn-secondary">
              Back to Browse
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          {details.backdrop_path && (
            <img
              src={`${IMG}/w1280${details.backdrop_path}`}
              alt=""
              fetchPriority="high"
            />
          )}
          <div className={styles.heroOverlay} />
        </div>

        <div className={styles.heroBody}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.back()}
          >
            ← Back
          </button>

          <div className={styles.heroRow}>
            {details.poster_path && (
              <div className={styles.poster}>
                <img
                  src={`${IMG}/w500${details.poster_path}`}
                  alt={title}
                />
              </div>
            )}

            <div className={styles.heroInfo}>
              <div className={styles.metaRow}>
                <span className="badge">
                  {mediaType === "tv" ? "Series" : "Movie"}
                </span>
                {year && <span className="meta-chip">{year}</span>}
                {runtime && <span className="meta-chip">{runtime}</span>}
                {details.status && (
                  <span className="meta-chip">{details.status}</span>
                )}
                {mediaType === "tv" && details.number_of_seasons != null && (
                  <span className="meta-chip">
                    {details.number_of_seasons} season
                    {details.number_of_seasons !== 1 ? "s" : ""}
                  </span>
                )}
                {details.vote_average != null && details.vote_average > 0 && (
                  <span className="rating-badge">
                    ★ {details.vote_average.toFixed(1)}
                    {details.vote_count != null && details.vote_count > 0 && (
                      <span className="rating-badge-source">
                        (
                        {details.vote_count > 1000
                          ? `${(details.vote_count / 1000).toFixed(1)}k`
                          : details.vote_count}
                        )
                      </span>
                    )}
                    <span className="rating-badge-source">TMDB</span>
                  </span>
                )}
              </div>

              <h1 className={styles.title}>{title}</h1>

              {details.tagline && (
                <p className={styles.tagline}>“{details.tagline}”</p>
              )}

              {(details.genres?.length ?? 0) > 0 && (
                <div className={styles.genres}>
                  {details.genres!.map((g) => (
                    <span key={g.id} className={styles.genre}>
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {details.overview && (
                <div>
                  <p
                    className={`${styles.overview} ${
                      synopsisOpen ? "" : styles.overviewClamp
                    }`}
                  >
                    {details.overview}
                  </p>
                  {details.overview.length > 200 && (
                    <button
                      type="button"
                      className={styles.readMore}
                      onClick={() => setSynopsisOpen((v) => !v)}
                    >
                      {synopsisOpen ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}

              {director && (
                <p className={styles.credit}>
                  <strong>
                    {mediaType === "movie" ? "Director" : "Creators"}:
                  </strong>{" "}
                  {director}
                </p>
              )}

              <div className={styles.actions}>
                <Link href={playHref()} className="btn-primary !px-5 !py-2.5 text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5.5v13l11-6.5L8 5.5z" />
                  </svg>
                  {mediaType === "tv" ? `Play S${selectedSeason} E1` : "Play"}
                </Link>
                <button
                  type="button"
                  onClick={toggleWatchlist}
                  className={`btn-secondary !px-4 !py-2.5 text-sm ${
                    inList ? "!border-[#00e5bf]/35 !text-[#00e5bf]" : ""
                  }`}
                >
                  {inList ? "✓ In List" : "+ My List"}
                </button>
                <DownloadMenu
                  item={{
                    kind: "video",
                    tmdbId: Number(id),
                    mediaType,
                    season: mediaType === "tv" ? selectedSeason : undefined,
                    episode: mediaType === "tv" ? 1 : undefined,
                    title,
                    durationSec:
                      mediaType === "movie"
                        ? details.runtime
                          ? details.runtime * 60
                          : undefined
                        : details.episode_run_time?.[0]
                          ? details.episode_run_time[0] * 60
                          : undefined,
                  }}
                  label="Download"
                  className="btn-secondary !px-4 !py-2.5 text-sm"
                />
                {trailer && (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    className="btn-ghost !px-3 !py-2.5 text-sm"
                  >
                    Trailer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div className={styles.body}>
        {/* Episodes */}
        {mediaType === "tv" && seasons.length > 0 && (
          <section>
            <div className="section-head">
              <h2>Episodes</h2>
            </div>

            <div className={styles.seasonPills}>
              {seasons.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSeason(s.season_number)}
                  className={`${styles.seasonPill} ${
                    selectedSeason === s.season_number
                      ? styles.seasonPillActive
                      : ""
                  }`}
                >
                  {s.name?.startsWith("Season")
                    ? s.name
                    : `Season ${s.season_number}`}
                  <span className={styles.seasonCount}>{s.episode_count}</span>
                </button>
              ))}
            </div>

            {epsLoading ? (
              <div className={styles.epGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-24 rounded-xl" />
                ))}
              </div>
            ) : episodes.length === 0 ? (
              <p className={styles.emptyNote}>
                No episodes found for this season.
              </p>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 0.75rem" }}>
                  <DownloadMenu
                    items={episodes.map((ep) => ({
                      kind: "video",
                      tmdbId: Number(id),
                      mediaType,
                      season: ep.season_number,
                      episode: ep.episode_number,
                      title,
                      durationSec: ep.runtime ? ep.runtime * 60 : undefined,
                    }))}
                    menuAlign="right"
                    label={`Download Season ${selectedSeason} (${episodes.length})`}
                    className="btn-secondary !px-4 !py-2 text-sm"
                  />
                </div>
                <div className={styles.epGrid}>
                  {episodes.map((ep) => (
                    <div key={ep.id} className={styles.epCard}>
                      <Link
                        href={playHref(ep.season_number, ep.episode_number)}
                        style={{
                          display: "flex",
                          flex: 1,
                          minWidth: 0,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <div className={styles.epStill}>
                          {ep.still_path ? (
                            <img
                              src={`${IMG}/w300${ep.still_path}`}
                              alt=""
                              loading="lazy"
                            />
                          ) : details.backdrop_path ? (
                            <img
                              src={`${IMG}/w300${details.backdrop_path}`}
                              alt=""
                              loading="lazy"
                              style={{ opacity: 0.45 }}
                            />
                          ) : null}
                          <span className={styles.epBadge}>
                            E{ep.episode_number}
                          </span>
                          <div className={styles.epPlay}>
                            <span className={styles.epPlayIcon}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="#030307" aria-hidden>
                                <path d="M8 5.5v13l11-6.5L8 5.5z" />
                              </svg>
                            </span>
                          </div>
                        </div>
                        <div className={styles.epBody}>
                          <p className={styles.epTitle}>
                            {ep.name || `Episode ${ep.episode_number}`}
                          </p>
                          {ep.overview && (
                            <p className={styles.epDesc}>{ep.overview}</p>
                          )}
                          <div className={styles.epMeta}>
                            {[
                              formatDate(ep.air_date),
                              ep.runtime ? `${ep.runtime}m` : null,
                              ep.vote_average && ep.vote_average > 0
                                ? `★ ${ep.vote_average.toFixed(1)}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      </Link>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "0 0.6rem",
                        }}
                      >
                        <DownloadMenu
                          item={{
                            kind: "video",
                            tmdbId: Number(id),
                            mediaType,
                            season: ep.season_number,
                            episode: ep.episode_number,
                            title,
                            durationSec: ep.runtime ? ep.runtime * 60 : undefined,
                          }}
                          menuAlign="right"
                          label="⬇"
                          queuedLabel="✓"
                          title={`Download S${ep.season_number} E${ep.episode_number}`}
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: 8,
                            color: "rgba(255,255,255,0.8)",
                            fontSize: "0.8rem",
                            padding: "0.3rem 0.5rem",
                            cursor: "pointer",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* Cast */}
        {cast.length > 0 && (
          <section>
            <div className="section-head">
              <h2>Cast</h2>
            </div>
            <div className={styles.castRail}>
              {cast.map((person) => (
                <div key={person.id} className={styles.castCard}>
                  <div className={styles.castImg}>
                    {person.profile_path ? (
                      <img
                        src={`${IMG}/w185${person.profile_path}`}
                        alt=""
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.castPlaceholder}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className={styles.castMeta}>
                    <p className={styles.castName}>{person.name}</p>
                    {person.character && (
                      <p className={styles.castRole}>{person.character}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommended */}
        {recommended.length > 0 && (
          <ContentRail
            title="Recommended"
            subtitle="Because you viewed this"
            index={0}
          >
            {recommended.slice(0, 14).map((item, i) => (
              <ContentCard
                key={`drec-${item.id}-${i}`}
                tmdbId={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType={mediaType}
                posterUrl={
                  item.poster_path
                    ? `${IMG}/w500${item.poster_path}`
                    : undefined
                }
                rating={item.vote_average}
                year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
              />
            ))}
          </ContentRail>
        )}

        {/* Similar */}
        {similar.length > 0 &&
          (recommended.length === 0 ||
            similar.some(
              (s) => !recommended.slice(0, 8).some((r) => r.id === s.id),
            )) && (
            <ContentRail
              title="More Like This"
              subtitle="Similar titles"
              index={1}
            >
              {similar.slice(0, 14).map((item, i) => (
                <ContentCard
                  key={`dsim-${item.id}-${i}`}
                  tmdbId={item.id}
                  title={item.title ?? item.name ?? "Untitled"}
                  mediaType={mediaType}
                  posterUrl={
                    item.poster_path
                      ? `${IMG}/w500${item.poster_path}`
                      : undefined
                  }
                  rating={item.vote_average}
                  year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
                />
              ))}
            </ContentRail>
          )}

        {/* Facts */}
        <section className={styles.facts}>
          <h2 className={styles.factsTitle}>Details</h2>
          <dl className={styles.factsGrid}>
            {(
              [
                ["Type", mediaType === "tv" ? "TV Series" : "Movie"],
                ["Status", details.status],
                [
                  "Release",
                  formatDate(details.release_date ?? details.first_air_date),
                ],
                ["Runtime", runtime],
                mediaType === "tv"
                  ? ["Episodes", details.number_of_episodes?.toString()]
                  : null,
                mediaType === "tv"
                  ? ["Seasons", details.number_of_seasons?.toString()]
                  : null,
                ["Genres", details.genres?.map((g) => g.name).join(", ")],
                [
                  "Studios",
                  details.production_companies
                    ?.slice(0, 4)
                    .map((c) => c.name)
                    .join(", "),
                ],
                [mediaType === "movie" ? "Director" : "Creators", director],
              ] as ([string, string | undefined | null] | null)[]
            )
              .filter(Boolean)
              .map((row) => {
                const [label, value] = row as [string, string | undefined | null];
                if (!value) return null;
                return (
                  <div key={label}>
                    <dt className={styles.factLabel}>{label}</dt>
                    <dd className={styles.factValue}>{value}</dd>
                  </div>
                );
              })}
          </dl>
        </section>
      </div>

      {/* Trailer modal */}
      {trailerOpen && trailer && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setTrailerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Trailer"
        >
          <div
            className={styles.modalFrame}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
              title={trailer.name || "Trailer"}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setTrailerOpen(false)}
              aria-label="Close trailer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
