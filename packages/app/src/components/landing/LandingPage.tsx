"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import styles from "./LandingPage.module.css";

interface Stats {
  githubStars?: string;
  discordMembers?: string;
}

export default function LandingPage() {
  const [year] = useState(() => new Date().getFullYear());

  // Signal to the layout that we're showing the landing page (hide sidebar)
  useEffect(() => {
    document.documentElement.setAttribute("data-landing", "1");
    return () => document.documentElement.removeAttribute("data-landing");
  }, []);

  const changes = [
    {
      icon: "🏗️",
      accent: "#00e5bf",
      title: "Monorepo Architecture",
      desc: "11 packages with clear dependency boundaries. No more tangled 6-directory codebase — each concern is isolated, testable, and independently versioned.",
    },
    {
      icon: "⚡",
      accent: "#8b7cf0",
      title: "Unified Extraction Pipeline",
      desc: "Single fetch path for all providers with built-in caching. Flyx 2.0 duplicated extraction logic across 5 locations — 3.0 has one ExtractionPipeline used everywhere.",
    },
    {
      icon: "🛡️",
      accent: "#f062a0",
      title: "Type-Safe Error Hierarchy",
      desc: "One FlyxError base class with typed subclasses. Every error carries machine-readable codes, HTTP status, and retry flags. No more string-throwing.",
    },
    {
      icon: "🗄️",
      accent: "#00e5bf",
      title: "Proper DB Migrations",
      desc: "Tracked schema versions with transactional rollback. Flyx 2.0 ran CREATE TABLE IF NOT EXISTS on every request — a D1 anti-pattern we've eliminated.",
    },
    {
      icon: "🎯",
      accent: "#8b7cf0",
      title: "Decorator-Free Providers",
      desc: "No experimental decorators. Providers register via a simple safeRegister() call with built-in error isolation. Each provider is just 15–30 lines.",
    },
    {
      icon: "💾",
      accent: "#f062a0",
      title: "Single Cache System",
      desc: "One UnifiedCache with TTL, stale-while-revalidate, namespaces, and LRU eviction. Replaced 4 separate caching systems from 2.0.",
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGlow} />

      {/* ── Hero ──────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.logoWrap}>
          <div className={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#030307" aria-hidden>
              <path d="M8 5.5v13l11-6.5L8 5.5z" />
            </svg>
          </div>
          <div className={styles.logoText}>Flyx</div>
          <span className={styles.versionBadge}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#00e5bf", boxShadow: "0 0 6px #00e5bf" }} />
            v3.0
          </span>
        </div>

        <p className={styles.tagline}>
          <strong>Privacy-first streaming.</strong> No ads. No tracking. No bullshit.<br />
          Movies, TV, anime, manga, live TV, sports, and PPV events — all from free sources.
        </p>

        <div className={styles.ctaRow}>
          <Link href="/login" className={styles.btnPrimary}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            Sign In
          </Link>
          <a
            href="https://github.com/Vynx-Velvet/Flyx-main"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnSecondary}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <a
            href="https://discord.gg/flyx"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnGhost}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.82 19.82 0 005.993 3.03.078.078 0 00.084-.028 14.2 14.2 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.82 19.82 0 006.002-3.03.077.077 0 00.032-.057c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Discord
          </a>
        </div>

        <div className={styles.socialRow}>
          <a
            href="https://github.com/Vynx-Velvet/Flyx-main"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
          >
            <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Vynx-Velvet/Flyx-main
          </a>
        </div>

        <div className={styles.scrollHint}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* ── About ──────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>About</span>
          <h2 className={styles.sectionTitle}>What is Flyx 3.0?</h2>

          <p className={styles.sectionSub}>
            The pirate streaming ecosystem has optimized for extraction. Sites scrape freely
            available content, then layer it with advertisements, tracking scripts, malware-laden
            popups, and background cryptocurrency miners. They do not host the media. They do not
            license it. They insert themselves between the user and material that was already free,
            converting attention and device resources into revenue. The prevailing assumption is
            that this exploitation is the unavoidable price of free access.
          </p>

          <p className={styles.sectionSub}>
            Flyx rejects that assumption.
          </p>

          <p className={styles.sectionSub}>
            Flyx aggregates movies, TV shows, anime, manga, live TV (850+ channels), live sports,
            and PPV events exclusively from the same free, unlicensed sources used by those sites.
            It never draws from legitimate platforms. It never touches services that pay for
            distribution rights. The sources are the free streams already circulating on the open
            internet. The difference is that every layer of monetization and surveillance is stripped
            away before the content reaches the user.
          </p>

          <p className={styles.sectionSub}>
            No advertisements. No tracking. No data sold to brokers. No miners. No personal
            information collected.
          </p>

          <p className={styles.sectionSub}>
            Flyx hosts nothing. It locates streams that already exist and delivers them cleanly
            through the user's own infrastructure — local machine, Docker host, or Cloudflare
            account. The operator controls the instance, the data, and access. No third party
            observes viewing history or even that the application is running.
          </p>

          <p className={styles.sectionSub}>
            Version 3.0 is a complete architectural rebuild. The previous single Next.js application
            has been replaced by a Turborepo monorepo of eleven packages with strict dependency
            boundaries. Types, error handling, caching, provider logic, extraction, and the video
            player each live in their own package — independently testable, versioned, and deployable.
            A new provider requires roughly fifteen lines. The player is composed of React hooks rather
            than a multi-thousand-line monolith. Errors carry machine-readable codes. Caching is a
            single unified layer.
          </p>

          <p className={styles.sectionSub}>
            The project is fully self-hosted and open source. It asks for no payment, no personal
            data, and no attention. Its purpose is to demonstrate that free streaming does not require
            exploiting the people who use it.
          </p>

          <p className={styles.sectionSub}>
            The sources remain the same. The extraction of value from the user does not.
          </p>

          <div className={styles.linkCards}>
            <a
              href="https://github.com/Vynx-Velvet/Flyx-main"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkCard}
            >
              <div className={styles.linkCardIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#f0f0f5" }} aria-hidden>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div>
                <h4>GitHub Repository</h4>
                <p>Source code, issues, and contributions</p>
              </div>
              <svg className={styles.linkCardArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>

            <a
              href="https://discord.gg/flyx"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkCard}
            >
              <div className={styles.linkCardIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#8b7cf0" }} aria-hidden>
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.82 19.82 0 005.993 3.03.078.078 0 00.084-.028 14.2 14.2 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.82 19.82 0 006.002-3.03.077.077 0 00.032-.057c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
                </svg>
              </div>
              <div>
                <h4>Discord Community</h4>
                <p>Get help, share ideas, and connect</p>
              </div>
              <svg className={styles.linkCardArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── How It Works ──────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>Under the Hood</span>
          <h2 className={styles.sectionTitle}>How It Works</h2>

          <p className={styles.sectionSub}>
            Pirate sites make money by inserting themselves between you and content that was never
            theirs to sell. Flyx does the opposite: it <strong>removes every middleman</strong> between
            you and the stream. Nothing is hosted. Nothing is paywalled. Nothing is tracked. Here's
            how the pipeline cuts out the parasites.
          </p>

          <div className={styles.setupSteps}>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>1</div>
              <div>
                <h4>Provider Registry — No Single Point of Failure</h4>
                <p>
                  The <strong>@flyx/providers</strong> package maintains a registry of 12+ sources in
                  priority order, each as a lightweight class extending BaseProvider. When you search for
                  content, the registry iterates through matching providers automatically — if a pirate
                  site goes down or gets taken over, the next provider picks up without you noticing. Error
                  isolation means one broken source never crashes your instance. Unlike the sprawling sites
                  that embed 15 ad networks into every page, each provider is typically 15–30 lines
                  of focused, auditable code.
                </p>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>2</div>
              <div>
                <h4>Extraction Pipeline — One Path, No Snooping</h4>
                <p>
                  All providers feed into a <strong>single ExtractionPipeline</strong> in
                  <strong> @flyx/extractors.</strong> This is the only fetch path in the entire app —
                  API routes, player hooks, and admin tools all use it. Results hit the
                  <strong> UnifiedCache</strong> (TTL with stale-while-revalidate) in
                  <strong> @flyx/core,</strong> so repeated requests return instantly. In 2.0, this
                  logic was copy-pasted across 5 different files — a nightmare to audit. In 3.0, it's
                  one path, one cache, and you can read every line of it.
                </p>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>3</div>
              <div>
                <h4>Stream Proxy — You Are Invisible</h4>
                <p>
                  This is where Flyx earns the "privacy-first" claim. A dedicated proxy (Bun server on
                  :8787 for local/Docker, Cloudflare Worker for production) sits between your browser and
                  every upstream CDN. It <strong>injects Referer and Origin headers</strong> so streams
                  play correctly, <strong>rewrites M3U8 manifests</strong> for CORS, and — this is the
                  important part — <strong>completely shields your real IP address</strong> from every
                  content source. The upstream CDNs see the proxy, not you. Pirate sites want to know
                  who you are so they can sell that information. Flyx makes that impossible.
                </p>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>4</div>
              <div>
                <h4>Decomposed Player — No Bloat, No Malware</h4>
                <p>
                  The <strong>@flyx/player</strong> package provides composable React hooks for HLS.js
                  playback — quality switching, subtitle tracks, keyboard shortcuts, Chromecast, AirPlay,
                  stream URL copying. Each is its own hook, not a 5,000-line monolith like 2.0. The
                  <strong> custom FetchLoader</strong> routes every segment request through the proxy
                  layer. Your browser never talks directly to a CDN. No hidden iframes. No drive-by
                  crypto miners. Just a video player that plays video.
                </p>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>5</div>
              <div>
                <h4>Run It Anywhere — Not Their Server, Yours</h4>
                <p>
                  The <strong>@flyx/config</strong> package detects your deployment target — local dev,
                  Docker, Cloudflare, or Vercel — and selects the right database adapter (SQLite, D1, or
                  Postgres), proxy backend, and environment automatically. One command to start. Zero code
                  changes between platforms. Unlike the pirate ecosystem where you're at the mercy of
                  whatever server some operator in a jurisdiction you'll never visit decides to keep
                  online today, this is <strong>your infrastructure, your rules.</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── From Flyx 2.0 ─────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>History</span>
          <h2 className={styles.sectionTitle}>From Flyx 2.0</h2>
          <p className={styles.sectionSub}>
            Flyx 2.0 was the original streaming platform — a single Next.js app with 20+
            providers, a working video player, live TV, and a growing community. It proved
            the concept: free, private streaming was possible. But as the codebase grew
            past 30,000 lines with no architectural boundaries, every new feature became
            harder to ship. Provider logic leaked into the UI. Cache invalidation was
            guesswork. Errors were thrown as raw strings with no stack context.
          </p>
          <p className={styles.sectionSub}>
            Rather than keep patching the cracks, we chose to rebuild — not to add
            features, but to create a foundation that makes adding features <strong>easy.</strong>
            Everything that worked in 2.0 (streaming, providers, live TV, the player) was
            carried forward. Everything that held us back (the monolith, the error handling,
            the cache sprawl) was redesigned from scratch.
          </p>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── Why This Was Done ──────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>Motivation</span>
          <h2 className={styles.sectionTitle}>Why This Was Done</h2>
          <p className={styles.sectionSub}>
            Flyx 2.0 was a working streaming platform, but it was held together by
            duct tape and hope. As the project grew, the cracks started showing.
            Flyx 3.0 was born out of the need to fix these architectural problems at the root.
          </p>

          <div className={styles.changelogGrid}>
            {[
              {
                icon: "🔀",
                accent: "#f45050",
                title: "Tangled Codebase",
                desc: "Flyx 2.0 spread provider logic across 6 directories in a mix of JS and TS. Adding a single provider meant touching 5+ files. 3.0 isolates each provider to a single 15–30 line class.",
              },
              {
                icon: "💥",
                accent: "#f59e0b",
                title: "Brittle Error Handling",
                desc: "2.0 threw raw strings and had 5+ different error handling systems. Debugging production issues meant grepping for string literals. 3.0 has one typed error hierarchy with machine-readable codes.",
              },
              {
                icon: "🐌",
                accent: "#8b7cf0",
                title: "Performance Bottlenecks",
                desc: "Four separate cache systems with no coordination meant stale data, cache stampedes, and wasted memory. 3.0's UnifiedCache deduplicates and coordinates all caching through a single layer.",
              },
              {
                icon: "🔧",
                accent: "#00e5bf",
                title: "Untestable Design",
                desc: "Components were 5,000+ lines with no separation of concerns. You couldn't test a provider without booting the entire app. 3.0's package boundaries make every module independently testable.",
              },
              {
                icon: "🧩",
                accent: "#f062a0",
                title: "Missing Pieces",
                desc: "2.0 had no manga support, no proper database, and no admin dashboard. Each feature was bolted on as an afterthought. 3.0 was designed from the ground up to accommodate manga, live TV, sync, and more.",
              },
              {
                icon: "🏠",
                accent: "#2dd4a8",
                title: "Self-Host First",
                desc: "Flyx 2.0 was hard to self-host — fragile config, no Docker support, and Cloudflare lock-in. 3.0 runs anywhere: local dev with SQLite, Docker with persistent volumes, or Cloudflare with D1 and Workers.",
              },
            ].map((c) => (
              <div key={c.title} className={styles.changeCard}>
                <div className={styles.changeIcon} style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}25` }}>
                  {c.icon}
                </div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── 2.0 → 3.0 Changes ────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>What's New</span>
          <h2 className={styles.sectionTitle}>Flyx 2.0 → 3.0</h2>
          <p className={styles.sectionSub}>
            Flyx 3.0 is a <strong>ground-up architectural refactor</strong> of the 2.0 codebase.
            Every system was redesigned for reliability, maintainability, and performance.
          </p>

          <div className={styles.changelogGrid}>
            {changes.map((c) => (
              <div key={c.title} className={styles.changeCard}>
                <div className={styles.changeIcon} style={{ background: `${c.accent}15`, border: `1px solid ${c.accent}25` }}>
                  {c.icon}
                </div>
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── Setup Guide ─────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>Self-Host</span>
          <h2 className={styles.sectionTitle}>Setup &amp; Configuration</h2>
          <p className={styles.sectionSub}>
            Get your own Flyx instance running in minutes. Requires Node.js 20+ and npm.
          </p>

          <div className={styles.setupSteps}>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>1</div>
              <div>
                <h4>Clone the repository</h4>
                <p>Get the source code from GitHub.</p>
                <code className={styles.code}>git clone https://github.com/Vynx-Velvet/Flyx-main.git</code>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>2</div>
              <div>
                <h4>Install dependencies</h4>
                <p>Install all packages in the Turborepo monorepo.</p>
                <code className={styles.code}>cd Flyx-main && npm install</code>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>3</div>
              <div>
                <h4>Configure environment</h4>
                <p>
                  Copy the example env file and fill in your values. At minimum, you need
                  a TMDB API key and a JWT secret.
                </p>
                <code className={styles.code}>cp .env.example .env</code>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>4</div>
              <div>
                <h4>Start the development server</h4>
                <p>Launch the Next.js dev server with hot reload across all packages.</p>
                <code className={styles.code}>npm run dev</code>
              </div>
            </div>
            <div className={styles.setupStep}>
              <div className={styles.stepNum}>5</div>
              <div>
                <h4>Create your first account</h4>
                <p>
                  The first account is always created as admin. You'll need the
                  HOST_KEY from your .env to authorize the request.
                </p>
                <code className={styles.code}>{`curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -H "x-host-key: YOUR_HOST_KEY" -d '{"username":"admin","password":"your-password"}'`}</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── Configuration Reference ────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionLabel}>Reference</span>
          <h2 className={styles.sectionTitle}>Environment Variables</h2>
          <p className={styles.sectionSub}>
            All configuration is done through environment variables. Copy .env.example to .env
            and fill in the values for your deployment.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table className={styles.configTable}>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className={styles.configVar}>TMDB_API_KEY</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredRequired}`}>Required</span></td>
                  <td className={styles.configDesc}>TMDB API key for content metadata, posters, and search</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>JWT_SECRET</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredRequired}`}>Required</span></td>
                  <td className={styles.configDesc}>Secret key for signing auth tokens (min 32 characters)</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>HOST_KEY</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredOptional}`}>Optional</span></td>
                  <td className={styles.configDesc}>Secret key for creating new accounts. Required to enable user registration.</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>DATABASE_URL</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredOptional}`}>Optional</span></td>
                  <td className={styles.configDesc}>Database connection string. Defaults to local SQLite.</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>ENABLE_LANDING_PAGE</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredOptional}`}>Optional</span></td>
                  <td className={styles.configDesc}>Show the landing page for unauthenticated visitors. Default: true.</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>CLOUDFLARE_ACCOUNT_ID</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredOptional}`}>Optional</span></td>
                  <td className={styles.configDesc}>Cloudflare account ID for Workers deployment</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>CLOUDFLARE_API_TOKEN</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredOptional}`}>Optional</span></td>
                  <td className={styles.configDesc}>Cloudflare API token for Workers and D1 access</td>
                </tr>
                <tr>
                  <td><span className={styles.configVar}>STRIPE_SECRET_KEY</span></td>
                  <td><span className={`${styles.configRequired} ${styles.configRequiredOptional}`}>Optional</span></td>
                  <td className={styles.configDesc}>Stripe secret for token purchases (monetization)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerLogo}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#030307" aria-hidden>
                <path d="M8 5.5v13l11-6.5L8 5.5z" />
              </svg>
            </div>
            <div>
              <div className={styles.footerName}>Flyx 3.0</div>
              <div className={styles.footerTag}>Privacy-first streaming</div>
            </div>
          </div>

          <nav className={styles.footerLinks}>
            <a href="https://github.com/Vynx-Velvet/Flyx-main" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>GitHub</a>
            <a href="https://discord.gg/flyx" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>Discord</a>
            <Link href="/login" className={styles.footerLink}>Sign In</Link>
          </nav>

          <span className={styles.footerBadge}>MIT License &copy; {year}</span>
        </div>
      </footer>
    </div>
  );
}
