"use client";

import { useState, useEffect } from "react";
import NetworkStatus from "@/components/help/NetworkStatus";
import { useIsApple } from "@/hooks/useIsApple";
import styles from "./HelpPage.module.css";

type HelpTab =
  | "welcome"
  | "network"
  | "player"
  | "features"
  | "settings"
  | "troubleshooting";

export default function HelpPageClient() {
  const [activeTab, setActiveTab] = useState<HelpTab>("welcome");
  const isApple = useIsApple();

  const tabs: { id: HelpTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "welcome",
      label: "Welcome",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5L12 3l9 7.5M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
        </svg>
      ),
    },
    {
      id: "network",
      label: "Watch on TV",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
    {
      id: "player",
      label: "Player",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ),
    },
    {
      id: "features",
      label: "Features",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
    {
      id: "troubleshooting",
      label: "Help",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Help &amp; Guides</h1>
        <p className={styles.subtitle}>
          Everything you need to get the most out of Flyx
        </p>
      </div>

      <div className={styles.helpLayout}>
        {/* Tab navigation */}
        <nav className={styles.tabNav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className={styles.content}>
          {activeTab === "welcome" && <WelcomeGuide />}
          {activeTab === "network" && <NetworkGuide />}
          {activeTab === "player" && <PlayerGuide isApple={isApple} />}
          {activeTab === "features" && <FeaturesGuide />}
          {activeTab === "settings" && <SettingsGuide />}
          {activeTab === "troubleshooting" && <TroubleshootingGuide />}
        </div>
      </div>
    </div>
  );
}

// ── Welcome ────────────────────────────────────────────────────────

function WelcomeGuide() {
  const isApple = useIsApple();

  return (
    <div className={styles.guideSection}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #00e5bf, #00c4a0)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 5.5v13l11-6.5L8 5.5z" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Welcome to Flyx!</h2>
            <p className={styles.cardSubtitle}>
              Your personal streaming hub — free, private, and open source
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <p>
            Flyx brings together movies, TV shows, anime, manga, and live TV from
            across the web — all in one beautiful app. No ads. No tracking. No
            subscriptions. Just pick something and press play.
          </p>

          <div className={styles.featureGrid}>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🎬</span>
              <strong>Movies &amp; TV</strong>
              <span>Thousands of titles across every genre</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🌸</span>
              <strong>Anime</strong>
              <span>Subbed &amp; dubbed, from classics to seasonal</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📚</span>
              <strong>Manga</strong>
              <span>Read your favorite series chapter by chapter</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>📡</span>
              <strong>Live TV</strong>
              <span>850+ live channels — news, sports, entertainment</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🏟️</span>
              <strong>Live Sports</strong>
              <span>PPV events and sports from around the world</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureIcon}>🔒</span>
              <strong>100% Private</strong>
              <span>Your data stays on your computer, always</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #8b7cf0, #6d5fd9)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Quick Start</h2>
            <p className={styles.cardSubtitle}>
              Already set up? Here&apos;s how to jump right in
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ol className={styles.stepList}>
            <li>
              <strong>Browse</strong> — Click <em>Movies</em>, <em>TV Shows</em>,{" "}
              <em>Anime</em>, or <em>Live TV</em> in the sidebar to explore
              what&apos;s available.
            </li>
            <li>
              <strong>Search</strong> — Press{" "}
              <kbd className={styles.kbd}>{isApple ? "⌘K" : "Ctrl+K"}</kbd> or
              click <em>Search</em> to find any movie or show by name.
            </li>
            <li>
              <strong>Watch</strong> — Click any title, then hit <em>Watch Now</em>.
              Flyx finds the best stream automatically.
            </li>
            <li>
              <strong>Save for later</strong> — Use the bookmark icon to add things
              to your <em>Watchlist</em>. Flyx remembers where you left off.
            </li>
            <li>
              <strong>Stream to your TV</strong> — Open the{" "}
              <em>Watch on TV</em> tab above to learn how to watch on the big screen.
            </li>
          </ol>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #f09840, #e06030)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Your Privacy</h2>
            <p className={styles.cardSubtitle}>
              How Flyx keeps your data safe
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Everything is stored on your computer.</strong> Your
              watchlist, progress, and settings never leave your device.
            </li>
            <li>
              <strong>No accounts with Flyx.</strong> The app runs entirely on your
              machine. There&apos;s no Flyx server that collects your data.
            </li>
            <li>
              <strong>No ads, no trackers.</strong> The code is open source — anyone
              can verify there&apos;s nothing shady going on.
            </li>
            <li>
              <strong>Your TMDB key is yours.</strong> The free account you created
              during setup is between you and TMDB. Flyx just uses it to look up
              posters and descriptions.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Watch on TV / Network ──────────────────────────────────────────

function NetworkGuide() {
  return (
    <div className={styles.guideSection}>
      <NetworkStatus />

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>How to watch on your TV</h2>
            <p className={styles.cardSubtitle}>
              It&apos;s like having your own private Netflix server at home
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ol className={styles.stepList}>
            <li>
              <strong>Make sure Flyx is running</strong> on your computer. Keep the
              app open — it works in the background.
            </li>
            <li>
              <strong>Connect to the same Wi-Fi.</strong> Your TV, phone, tablet, or
              other computer must be on the same home network as the computer
              running Flyx.
            </li>
            <li>
              <strong>Open a web browser</strong> on your TV or other device (Chrome,
              Safari, Edge — any browser works).
            </li>
            <li>
              <strong>Type the address</strong> shown in the green box above into the
              browser&apos;s address bar. It looks like{" "}
              <code>http://192.168.1.42:3891</code>.
            </li>
            <li>
              <strong>That&apos;s it!</strong> The full Flyx app will load on your
              TV or device. Browse, search, and play just like on your computer.
            </li>
          </ol>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Tips for the best experience</h2>
            <p className={styles.cardSubtitle}>
              A few things to keep in mind
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Smart TVs:</strong> Most smart TVs have a built-in web
              browser. On Samsung, it&apos;s called &quot;Internet.&quot; On LG,
              it&apos;s the &quot;Web Browser&quot; app. On Android TV / Google TV,
              you can install Chrome.
            </li>
            <li>
              <strong>Game consoles:</strong> PlayStation and Xbox both have web
              browsers that work with Flyx. On PS5, it&apos;s hidden — search the
              web for &quot;PS5 browser&quot; to learn how to access it.
            </li>
            <li>
              <strong>Streaming sticks:</strong> Fire TV Stick, Roku, and
              Chromecast can all use Flyx by opening their built-in browser or
              casting from your phone.
            </li>
            <li>
              <strong>Phones &amp; tablets:</strong> Flyx works great on mobile
              browsers. The app automatically adapts to smaller screens with
              touch-friendly controls.
            </li>
            <li>
              <strong>Use the player cast button:</strong> When watching on your
              computer, click the Cast icon in the player to send the video
              directly to a Chromecast or AirPlay device.
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Connection troubleshooting</h2>
            <p className={styles.cardSubtitle}>
              If you can&apos;t connect from another device
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Same Wi-Fi?</strong> Double-check that both devices are on the
              exact same network. &quot;Guest Wi-Fi&quot; is usually a separate
              network and won&apos;t work.
            </li>
            <li>
              <strong>Windows Firewall?</strong> The first time you run Flyx,
              Windows may ask if you want to allow it on the network. Click{" "}
              <em>Allow</em> or <em>Allow access</em>. If you missed it, search
              &quot;Windows Firewall&quot; in the Start menu and make sure Flyx is
              allowed.
            </li>
            <li>
              <strong>VPN?</strong> If you&apos;re using a VPN, try turning it off
              temporarily — some VPNs block local network connections.
            </li>
            <li>
              <strong>Antivirus?</strong> Some antivirus software blocks local
              servers. Try adding Flyx as an exception, or temporarily disable the
              firewall feature to test.
            </li>
            <li>
              <strong>Wrong address?</strong> The address changes if your
              computer&apos;s IP changes (after a restart, for example). Check this
              page again for the current address.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Player ──────────────────────────────────────────────────────────

function PlayerGuide({ isApple }: { isApple: boolean }) {
  const mod = isApple ? "⌘" : "Ctrl";

  return (
    <div className={styles.guideSection}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #ec4899, #db2777)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Desktop keyboard shortcuts</h2>
            <p className={styles.cardSubtitle}>
              Mouse-free control while you&apos;re watching
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.shortcutGroup}>
            <h3>Playback</h3>
            <ShortcutRow action="Play / pause" keys={["Space", "K"]} />
            <ShortcutRow action="Seek back / forward 10s" keys={["←", "→"]} />
            <ShortcutRow action="Seek 30 seconds" keys={["Shift", "← / →"]} />
            <ShortcutRow
              action="Double-click sides to skip 10s"
              keys={["Click L / R"]}
            />
            <ShortcutRow action="Jump to 0%–90%" keys={["0", "…", "9"]} />
            <ShortcutRow action="Next episode" keys={["N"]} />
          </div>

          <div className={styles.shortcutGroup}>
            <h3>Audio &amp; display</h3>
            <ShortcutRow action="Volume up / down" keys={["↑", "↓"]} />
            <ShortcutRow action="Mute" keys={["M"]} />
            <ShortcutRow action="Fullscreen" keys={["F"]} />
            <ShortcutRow
              action="Playback speed"
              keys={[",", ".", "1× menu"]}
            />
          </div>

          <div className={styles.shortcutGroup}>
            <h3>Casting</h3>
            <ShortcutRow
              action="Cast to TV (player button)"
              keys={["Cast icon"]}
            />
            <ShortcutRow
              action={isApple ? "AirPlay (Safari / Mac)" : "Browser cast menu"}
              keys={
                isApple
                  ? ["AirPlay icon"]
                  : [`${mod}`, "menu → Cast"]
              }
            />
          </div>

          <p className={styles.tip}>
            💡 <strong>Tip:</strong> Double-click the left or right side of the video
            to skip 10 seconds. Double-click the center for fullscreen. Open this
            guide anytime from the player&apos;s controls menu.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Phone &amp; tablet controls</h2>
            <p className={styles.cardSubtitle}>
              Touch gestures and mobile controls
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.shortcutGroup}>
            <h3>Touch controls</h3>
            <ShortcutRow action="Show / hide controls" keys={["Tap video"]} />
            <ShortcutRow action="Play / pause" keys={["Center button"]} />
            <ShortcutRow action="Skip ±10 seconds" keys={["−10s", "+10s"]} />
            <ShortcutRow action="Scrub timeline" keys={["Drag bar"]} />
          </div>

          <div className={styles.shortcutGroup}>
            <h3>More options</h3>
            <ShortcutRow
              action="Switch video sources"
              keys={["Servers button"]}
            />
            <ShortcutRow
              action="Change playback speed"
              keys={["Settings button"]}
            />
            <ShortcutRow action="Fullscreen" keys={["Expand icon"]} />
            <ShortcutRow
              action={isApple ? "AirPlay to Apple TV" : "Cast to Chromecast / TV"}
              keys={["Cast icon"]}
            />
          </div>

          <p className={styles.tip}>
            💡{" "}
            <strong>Tip:</strong>{" "}
            {isApple
              ? "AirPlay needs the same Wi‑Fi as your Apple TV. Tap Cast, then pick your device."
              : "Casting works best in Chrome. If the device picker is empty, try Chrome menu (⋮) → Cast… or use screen mirroring."}
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #06b6d4, #0891b2)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Player features explained</h2>
            <p className={styles.cardSubtitle}>
              What all those buttons actually do
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Servers:</strong> If a video doesn&apos;t load or buffers a
              lot, click <em>Servers</em> and try a different one. Flyx searches
              multiple sources for each title — different servers may have different
              quality or speeds.
            </li>
            <li>
              <strong>Speed:</strong> Want to binge faster? Click the speed button
              to watch at 1.25×, 1.5×, or 2×. This doesn&apos;t change the pitch —
              voices stay normal.
            </li>
            <li>
              <strong>Subtitles:</strong> Click the subtitle icon to turn on
              captions or pick a different language. You can customize how they look
              in Settings → Subtitles.
            </li>
            <li>
              <strong>Next episode:</strong> When you&apos;re close to the end of an
              episode, an &quot;Up Next&quot; button appears. You can set how early
              it shows up in Settings → Playback.
            </li>
            <li>
              <strong>Auto-play:</strong> Turn on auto-play in Settings → Playback
              and Flyx will automatically start the next episode when one ends.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Features ────────────────────────────────────────────────────────

function FeaturesGuide() {
  return (
    <div className={styles.guideSection}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #f97316, #ea580c)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Finding content</h2>
            <p className={styles.cardSubtitle}>
              All the ways to discover what to watch
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Home:</strong> The home screen shows trending movies &amp; TV, new
              releases, and your &quot;Continue Watching&quot; list. Scroll down to
              browse categories.
            </li>
            <li>
              <strong>Browse:</strong> Click <em>Movies</em> or <em>TV Shows</em> in
              the sidebar to browse by genre, year, rating, and more. Use the
              filters at the top to narrow things down.
            </li>
            <li>
              <strong>Search:</strong> Press{" "}
              <kbd className={styles.kbd}>Ctrl+K</kbd> (or{" "}
              <kbd className={styles.kbd}>⌘K</kbd> on Mac) to open the quick search
              bar. Type any movie or show name and results appear instantly.
            </li>
            <li>
              <strong>Details:</strong> Click any poster to see full details —
              description, cast, rating, similar titles, and available streams.
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #e11d48, #be123c)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Watchlist &amp; Continue Watching</h2>
            <p className={styles.cardSubtitle}>
              Never lose your place or forget what to watch
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Add to Watchlist:</strong> Click the bookmark icon on any
              movie or show poster. Find everything you&apos;ve saved under{" "}
              <em>Watchlist</em> in the sidebar.
            </li>
            <li>
              <strong>Continue Watching:</strong> Flyx automatically remembers where
              you stopped. The &quot;Continue Watching&quot; section on the home
              screen lets you pick up right where you left off.
            </li>
            <li>
              <strong>Progress tracking:</strong> For TV shows, Flyx tracks which
              episode and season you&apos;re on. No more forgetting what you watched
              last.
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #a855f7, #9333ea)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Anime &amp; Manga</h2>
            <p className={styles.cardSubtitle}>
              Dedicated sections for anime and manga fans
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Anime:</strong> Click <em>Anime</em> in the sidebar to browse
              by popularity, season, or genre. Each show lets you pick between subbed
              and dubbed versions.
            </li>
            <li>
              <strong>Manga reader:</strong> Click <em>Manga</em> to browse and read
              manga chapter by chapter. The reader saves your progress so you can
              pick up where you left off.
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 010-8.5M12 14a2 2 0 100-4 2 2 0 000 4zM16.2 7.8a6 6 0 010 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Live TV &amp; Sports</h2>
            <p className={styles.cardSubtitle}>
              850+ channels and live sports events
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Live TV:</strong> Click <em>Live TV</em> in the sidebar to
              browse 850+ channels organized by category — news, sports,
              entertainment, kids, and more.
            </li>
            <li>
              <strong>Channel guide:</strong> The category sidebar on the left lets
              you jump between genres. Click any channel to start watching live.
            </li>
            <li>
              <strong>Sports &amp; PPV:</strong> Major sports events and pay-per-view
              events appear in the Live TV section when they&apos;re airing.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────

function SettingsGuide() {
  return (
    <div className={styles.guideSection}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Settings overview</h2>
            <p className={styles.cardSubtitle}>
              What each settings section controls
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.settingGroup}>
            <h3>🔄 Sync</h3>
            <p>
              Cross-device sync lets you access your watchlist and progress from
              multiple devices. When enabled, you can pick up watching on your phone
              right where you left off on your computer.
            </p>
          </div>

          <div className={styles.settingGroup}>
            <h3>📡 Providers</h3>
            <p>
              Flyx searches multiple streaming sources for each title. In Provider
              settings, you can enable or disable specific sources and reorder them
              by preference. If a particular source never works well for you, turn
              it off here.
            </p>
          </div>

          <div className={styles.settingGroup}>
            <h3>▶️ Playback</h3>
            <p>
              Control auto-play behavior — whether the next episode starts
              automatically, how long the countdown is, and when the &quot;Up
              Next&quot; prompt appears.
            </p>
          </div>

          <div className={styles.settingGroup}>
            <h3>💬 Subtitles</h3>
            <p>
              Choose your preferred subtitle language, font size, background
              opacity, and on-screen position. A live preview shows how subtitles
              will look as you adjust settings.
            </p>
          </div>

          <div className={styles.settingGroup}>
            <h3>🔒 Security</h3>
            <p>
              Manage your account, change your password, and control who can access
              your Flyx server (if you&apos;ve set up shared accounts).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Troubleshooting ─────────────────────────────────────────────────

function TroubleshootingGuide() {
  return (
    <div className={styles.guideSection}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #f43f5e, #e11d48)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Common issues &amp; fixes</h2>
            <p className={styles.cardSubtitle}>
              Solutions for the most frequent problems
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.issueGroup}>
            <h3>🎥 Video won&apos;t play or keeps buffering</h3>
            <ol>
              <li>
                Click the <strong>Servers</strong> button in the player and try a
                different source. Different servers have different speeds and
                availability.
              </li>
              <li>
                Check your internet connection — try loading a website in another
                tab to make sure you&apos;re online.
              </li>
              <li>
                If you&apos;re on Wi-Fi, try moving closer to your router or
                switching to a wired connection.
              </li>
              <li>
                Some servers may be temporarily down. Try again in a few minutes,
                or try a different movie/show to verify the app is working.
              </li>
            </ol>
          </div>

          <div className={styles.issueGroup}>
            <h3>📱 Can&apos;t connect from my phone / TV</h3>
            <ol>
              <li>
                Make sure Flyx is <strong>running and open</strong> on your
                computer.
              </li>
              <li>
                Both devices must be on the <strong>same Wi-Fi network</strong>.
                Guest networks usually won&apos;t work.
              </li>
              <li>
                Check the{" "}
                <button
                  className={styles.inlineLink}
                  onClick={() => {
                    const event = new CustomEvent("flyx:help:tab", {
                      detail: "network",
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  Watch on TV
                </button>{" "}
                tab for detailed connection steps.
              </li>
              <li>
                If you see &quot;Connection refused&quot; or &quot;Site can&apos;t
                be reached,&quot; Windows Firewall may be blocking Flyx. Allow it
                in Windows Firewall settings.
              </li>
            </ol>
          </div>

          <div className={styles.issueGroup}>
            <h3>🔑 Content won&apos;t load / No posters or descriptions</h3>
            <ol>
              <li>
                This usually means your TMDB key isn&apos;t working. TMDB is the
                service that provides posters, descriptions, and search results.
              </li>
              <li>
                Go to{" "}
                <a
                  href="https://www.themoviedb.org/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  themoviedb.org/settings/api
                </a>{" "}
                and check that your API key is still valid.
              </li>
              <li>
                If you need to update your key, close Flyx, delete the file at{" "}
                <code>%APPDATA%\flyx\flyx-data\.env</code>, and reopen Flyx to run
                the setup wizard again.
              </li>
            </ol>
          </div>

          <div className={styles.issueGroup}>
            <h3>🐢 The app feels slow</h3>
            <ol>
              <li>
                Flyx is a web app that runs on your computer. Close unused browser
                tabs and apps to free up resources.
              </li>
              <li>
                If you&apos;re streaming to multiple devices at once, your
                computer&apos;s CPU and network may be the bottleneck. Try reducing
                the number of simultaneous streams.
              </li>
              <li>
                Restart Flyx — this clears temporary caches and often fixes
                performance issues.
              </li>
            </ol>
          </div>

          <div className={styles.issueGroup}>
            <h3>🖥️ The app window is blank or white</h3>
            <ol>
              <li>
                Wait a few seconds — Flyx starts a local server that takes a moment
                to initialize.
              </li>
              <li>
                Close and reopen Flyx. If the problem persists, try restarting your
                computer.
              </li>
              <li>
                Check your antivirus — some security software blocks local web
                servers. Add Flyx as an allowed application.
              </li>
            </ol>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div
            className={styles.cardIcon}
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <h2 className={styles.cardTitle}>Still need help?</h2>
            <p className={styles.cardSubtitle}>
              We&apos;re here for you
            </p>
          </div>
        </div>

        <div className={styles.cardBody}>
          <ul className={styles.bulletList}>
            <li>
              <strong>Discord:</strong> Join the{" "}
              <a href="https://discord.gg/flyx" target="_blank" rel="noopener noreferrer">
                Flyx Discord server
              </a>{" "}
              — the fastest way to get help from the community and developers.
            </li>
            <li>
              <strong>GitHub:</strong> Found a bug? Report it at{" "}
              <a
                href="https://github.com/Vynx-Velvet/Flyx-main"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/Vynx-Velvet/Flyx-main
              </a>
              .
            </li>
            <li>
              <strong>Setup issues?</strong> If you need to re-run the setup wizard,
              close Flyx, delete the <code>flyx-data</code> folder in your user
              directory, and reopen the app.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Reusable components ─────────────────────────────────────────────

function ShortcutRow({ action, keys }: { action: string; keys: string[] }) {
  return (
    <div className={styles.shortcutRow}>
      <span className={styles.shortcutAction}>{action}</span>
      <span className={styles.shortcutKeys}>
        {keys.map((k, i) => (
          <span key={i}>
            {i > 0 && <span className={styles.keyPlus}>+</span>}
            <kbd className={styles.kbd}>{k}</kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

