import Link from "next/link";
import ContentCard from "@/components/ContentCard";
import ContentRail from "@/components/ui/ContentRail";
import ContinueWatching from "@/components/ContinueWatching";
import HomeSearchBar from "@/components/search/HomeSearchBar";
import { tmdbBackdrop, tmdbFetch, tmdbPoster } from "@/lib/tmdb-server";

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

interface TMDBList {
  results?: TMDBItem[];
}

export default async function HomePageContent() {
  const [trending, popular, topRated, tvTrending, upcoming] = await Promise.all([
    tmdbFetch<TMDBList>("/trending/movie/week"),
    tmdbFetch<TMDBList>("/movie/popular"),
    tmdbFetch<TMDBList>("/movie/top_rated"),
    tmdbFetch<TMDBList>("/trending/tv/week"),
    tmdbFetch<TMDBList>("/movie/now_playing"),
  ]);

  const hero: TMDBItem | undefined = trending?.results?.[0];
  const trendingMovies = trending?.results ?? [];
  const popularMovies = popular?.results ?? [];
  const topRatedMovies = topRated?.results ?? [];
  const trendingTV = tvTrending?.results ?? [];
  const nowPlaying = upcoming?.results ?? [];

  const heroYear =
    hero?.release_date?.slice(0, 4) ?? hero?.first_air_date?.slice(0, 4);
  const heroType = hero?.title ? "movie" : "tv";

  return (
    <main className="min-h-screen">
      {hero ? (
        <section className="home-hero">
          {hero.backdrop_path && (
            <>
              <img
                src={tmdbBackdrop(hero.backdrop_path, "w1280")}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  animation: "ken-burns 40s ease-out forwards",
                  transformOrigin: "center 22%",
                  filter: "saturate(1.1) contrast(1.04)",
                }}
                fetchPriority="high"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,229,191,0.05) 0%, transparent 45%, rgba(139,124,240,0.07) 100%)",
                  mixBlendMode: "soft-light",
                }}
              />
            </>
          )}
          <div className="hero-vignette" />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(0,229,191,0.28), rgba(139,124,240,0.28), transparent)",
            }}
          />

          <div className="home-hero-inner">
            <div className="home-hero-row">
              <div
                className="home-hero-copy space-y-4"
                style={{ animation: "slide-up 0.55s var(--ease-out) both" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-[#00e5bf]"
                      style={{ boxShadow: "0 0 8px #00e5bf" }}
                    />
                    Featured
                  </span>
                  <span className="meta-chip uppercase tracking-wider">
                    {heroType === "movie" ? "Movie" : "TV Series"}
                  </span>
                  {heroYear && <span className="meta-chip">{heroYear}</span>}
                  {hero.vote_average != null && hero.vote_average > 0 && (
                    <span className="rating-badge">
                      ★ {hero.vote_average.toFixed(1)}
                      <span className="rating-badge-source">TMDB</span>
                    </span>
                  )}
                </div>

                <h1 className="hero-title text-[2.35rem] leading-[1.05] sm:text-5xl md:text-6xl xl:text-[3.75rem]">
                  {hero.title ?? hero.name}
                </h1>

                {hero.overview && (
                  <p className="line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/55 md:text-base md:leading-relaxed xl:max-w-3xl">
                    {hero.overview}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href={`/watch?tmdbId=${hero.id}&mediaType=${heroType}`}
                    className="btn-primary !px-6 !py-3 text-sm md:text-[0.9375rem]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13l11-6.5L8 5.5z" />
                    </svg>
                    Watch Now
                  </Link>
                  <Link
                    href={`/details/${hero.id}?type=${heroType}`}
                    className="btn-secondary !px-5 !py-3 text-sm md:text-[0.9375rem]"
                  >
                    More Info
                  </Link>
                  <Link
                    href="/browse"
                    className="btn-ghost hidden sm:inline-flex !py-3 text-sm"
                  >
                    Browse catalog
                  </Link>
                </div>
              </div>

              {hero.poster_path && (
                <div
                  className="home-hero-poster"
                  style={{ animation: "scale-in 0.65s var(--ease-out) 0.08s both" }}
                >
                  <div
                    className="w-full overflow-hidden rounded-2xl"
                    style={{
                      aspectRatio: "2/3",
                      boxShadow:
                        "0 24px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12)",
                    }}
                  >
                    <img
                      src={tmdbPoster(hero.poster_path, "w500")}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="home-hero items-center justify-center">
          <div className="page-glow" />
          <div
            className="relative space-y-4 px-6 text-center"
            style={{ animation: "slide-up 0.55s var(--ease-out) both" }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
                boxShadow: "0 12px 36px rgba(0,229,191,0.3)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#030307" aria-hidden>
                <path d="M8 5.5v13l11-6.5L8 5.5z" />
              </svg>
            </div>
            <h1 className="gradient-text text-3xl font-bold md:text-4xl">Flyx</h1>
            <p className="mx-auto max-w-md text-sm text-white/40">
              Privacy-first streaming. Movies, TV, anime, and live sports.
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              <Link href="/browse" className="btn-primary !px-5 !py-2.5 text-sm">
                Start Browsing
              </Link>
              <Link href="/livetv" className="btn-secondary !px-5 !py-2.5 text-sm">
                Live TV
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="home-main">
        <section className="section" style={{ animationDelay: "0.03s" }}>
          <HomeSearchBar />
        </section>

        <ContinueWatching />

        {trendingMovies.length > 0 && (
          <ContentRail
            title="Trending Movies"
            subtitle="What's hot this week"
            href="/browse?type=movie"
            index={0}
          >
            {trendingMovies.slice(0, 14).map((item, i) => (
              <ContentCard
                key={`tm-${item.id}-${i}`}
                tmdbId={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType="movie"
                posterUrl={tmdbPoster(item.poster_path, "w342")}
                rating={item.vote_average}
                year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
                rank={i < 10 ? i + 1 : undefined}
              />
            ))}
          </ContentRail>
        )}

        {trendingTV.length > 0 && (
          <ContentRail
            title="Trending TV"
            subtitle="Series everyone is watching"
            href="/browse?type=tv"
            index={1}
          >
            {trendingTV.slice(0, 14).map((item, i) => (
              <ContentCard
                key={`ttv-${item.id}-${i}`}
                tmdbId={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType="tv"
                posterUrl={tmdbPoster(item.poster_path, "w342")}
                rating={item.vote_average}
                year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
              />
            ))}
          </ContentRail>
        )}

        {nowPlaying.length > 0 && (
          <ContentRail
            title="Now Playing"
            subtitle="In theaters and streaming"
            href="/browse?type=movie"
            index={2}
          >
            {nowPlaying.slice(0, 14).map((item, i) => (
              <ContentCard
                key={`np-${item.id}-${i}`}
                tmdbId={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType="movie"
                posterUrl={tmdbPoster(item.poster_path, "w342")}
                rating={item.vote_average}
                year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
              />
            ))}
          </ContentRail>
        )}

        {popularMovies.length > 0 && (
          <ContentRail
            title="Popular Now"
            subtitle="Crowd favorites"
            href="/browse?type=movie"
            index={3}
          >
            {popularMovies.slice(0, 14).map((item, i) => (
              <ContentCard
                key={`pop-${item.id}-${i}`}
                tmdbId={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType="movie"
                posterUrl={tmdbPoster(item.poster_path, "w342")}
                rating={item.vote_average}
                year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
              />
            ))}
          </ContentRail>
        )}

        {topRatedMovies.length > 0 && (
          <ContentRail
            title="Top Rated"
            subtitle="Critically acclaimed"
            href="/browse?type=movie"
            index={4}
          >
            {topRatedMovies.slice(0, 14).map((item, i) => (
              <ContentCard
                key={`tr-${item.id}-${i}`}
                tmdbId={item.id}
                title={item.title ?? item.name ?? "Untitled"}
                mediaType="movie"
                posterUrl={tmdbPoster(item.poster_path, "w342")}
                rating={item.vote_average}
                year={(item.release_date ?? item.first_air_date)?.slice(0, 4)}
              />
            ))}
          </ContentRail>
        )}

        <section className="section home-quick-links">
          {[
            {
              href: "/browse?type=movie",
              label: "Movies",
              desc: "Browse films",
              accent: "#00e5bf",
              icon: "M2 4h20v16H2zM7 4v16M17 4v16M2 12h20",
            },
            {
              href: "/browse?type=tv",
              label: "TV Shows",
              desc: "Binge series",
              accent: "#8b7cf0",
              icon: "M2 7h20v14H2zM8 3l4 4 4-4",
            },
            {
              href: "/anime",
              label: "Anime",
              desc: "Sub & dub",
              accent: "#f062a0",
              icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
            },
            {
              href: "/livetv",
              label: "Live TV",
              desc: "Sports & news",
              accent: "#f87171",
              icon: "M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 010-8.5M12 14a2 2 0 100-4 2 2 0 000 4z",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="home-quick-card spotlight-card group no-underline"
              style={{
                backgroundImage: `linear-gradient(135deg, ${item.accent}18, transparent 70%)`,
              }}
            >
              <div
                className="home-quick-icon"
                style={{
                  background: `${item.accent}18`,
                  border: `1px solid ${item.accent}30`,
                  color: item.accent,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d={item.icon} />
                </svg>
              </div>
              <div className="home-quick-copy">
                <p className="home-quick-label">{item.label}</p>
                <p className="home-quick-desc">{item.desc}</p>
              </div>
            </Link>
          ))}
        </section>

        <footer className="home-footer">
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <span className="home-footer-mark" aria-hidden>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#030307">
                  <path d="M8 5.5v13l11-6.5L8 5.5z" />
                </svg>
              </span>
              <div>
                <p className="home-footer-name">Flyx 3.0</p>
                <p className="home-footer-tag">Privacy-first streaming</p>
              </div>
            </div>

            <nav className="home-footer-nav" aria-label="Footer">
              {[
                { label: "Movies", href: "/browse?type=movie" },
                { label: "TV", href: "/browse?type=tv" },
                { label: "Anime", href: "/anime" },
                { label: "Live TV", href: "/livetv" },
                { label: "Watchlist", href: "/watchlist" },
                { label: "Settings", href: "/settings" },
              ].map((l, i, arr) => (
                <span key={l.href} className="home-footer-nav-item">
                  <Link href={l.href} className="home-footer-link">
                    {l.label}
                  </Link>
                  {i < arr.length - 1 && (
                    <span className="home-footer-dot" aria-hidden>
                      ·
                    </span>
                  )}
                </span>
              ))}
            </nav>

            <p className="home-footer-badge">No ads · No tracking</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
