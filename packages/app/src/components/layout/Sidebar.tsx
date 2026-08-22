"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCommandPaletteOptional } from "@/components/search/CommandPalette";
import { useIsApple } from "@/hooks/useIsApple";
import { useAuth } from "@/hooks/useAuth";
import styles from "./Sidebar.module.css";

type Accent = "default" | "movies" | "tv" | "anime" | "live" | "secondary";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  accent?: Accent;
  /** Opens command palette instead of navigating */
  commandPalette?: boolean;
  /** How to decide active state */
  match: (pathname: string, type: string | null) => boolean;
}

const DISCOVER: NavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: "M3 10.5L12 3l9 7.5M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5",
    match: (p) => p === "/",
  },
  {
    href: "/browse?type=movie",
    label: "Movies",
    accent: "movies",
    icon: "M2 4h20v16H2zM7 4v16M17 4v16M2 12h20",
    match: (p, type) => {
      const onBrowse = p === "/browse" || p.startsWith("/browse/");
      const onDetails = p.startsWith("/details/");
      if (!onBrowse && !onDetails) return false;
      // On browse, default to Movies when type is missing; details only when type=movie
      if (onBrowse) return type !== "tv";
      return type === "movie";
    },
  },
  {
    href: "/browse?type=tv",
    label: "TV Shows",
    accent: "tv",
    icon: "M2 7h20v14H2zM8 3l4 4 4-4",
    match: (p, type) => {
      const onBrowse = p === "/browse" || p.startsWith("/browse/");
      const onDetails = p.startsWith("/details/");
      if (!onBrowse && !onDetails) return false;
      return type === "tv";
    },
  },
  {
    href: "/anime",
    label: "Anime",
    accent: "anime",
    icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    match: (p) => p === "/anime" || p.startsWith("/anime/"),
  },
  {
    href: "/manga",
    label: "Manga",
    accent: "anime",
    icon: "M4 6h16M4 12h16M4 18h16M4 4v16",
    match: (p) => p === "/manga" || p.startsWith("/manga/"),
  },
  {
    href: "/livetv",
    label: "Live TV",
    accent: "live",
    icon: "M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 010-8.5M12 14a2 2 0 100-4 2 2 0 000 4zM16.2 7.8a6 6 0 010 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19",
    match: (p) => p === "/livetv" || p.startsWith("/livetv/"),
  },
  {
    href: "/search",
    label: "Search",
    icon: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
    commandPalette: true,
    match: (p) => p === "/search" || p.startsWith("/search/"),
  },
];

const LIBRARY: NavItem[] = [
  {
    href: "/watchlist",
    label: "Watchlist",
    accent: "secondary",
    icon: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
    match: (p) => p === "/watchlist" || p.startsWith("/watchlist/"),
  },
  {
    href: "/downloads",
    label: "Downloads",
    accent: "secondary",
    icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
    match: (p) => p === "/downloads" || p.startsWith("/downloads/"),
  },
  {
    href: "/settings",
    label: "Settings",
    accent: "secondary",
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    match: (p) => p === "/settings" || p.startsWith("/settings/"),
  },
  {
    href: "/help",
    label: "Help",
    accent: "secondary",
    icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01",
    match: (p) => p === "/help" || p.startsWith("/help/"),
  },
];

/** Details pages highlight Movies or TV by type query */
function browseTypeFromPath(pathname: string, searchType: string | null): string | null {
  if (pathname === "/browse" || pathname.startsWith("/browse/")) {
    return searchType === "tv" ? "tv" : "movie";
  }
  // On details page, type query is movie|tv
  if (pathname.startsWith("/details/")) {
    return searchType === "tv" ? "tv" : searchType === "movie" ? "movie" : null;
  }
  return searchType;
}

function accentClass(accent: Accent | undefined, active: boolean): string {
  if (!active) return "";
  switch (accent) {
    case "movies":
      return styles.itemActiveMovies;
    case "tv":
      return styles.itemActiveTv;
    case "anime":
      return styles.itemActiveAnime;
    case "live":
      return styles.itemActiveLive;
    case "secondary":
      return styles.itemActiveSecondary;
    default:
      return styles.itemActive;
  }
}

function railClass(accent: Accent | undefined): string {
  switch (accent) {
    case "movies":
      return `${styles.rail} ${styles.railMovies}`;
    case "tv":
      return `${styles.rail} ${styles.railTv}`;
    case "anime":
      return `${styles.rail} ${styles.railAnime}`;
    case "live":
      return `${styles.rail} ${styles.railLive}`;
    default:
      return styles.rail;
  }
}

function activeDotClass(accent: Accent | undefined): string {
  switch (accent) {
    case "tv":
      return `${styles.activeDot} ${styles.activeDotTv}`;
    case "anime":
      return `${styles.activeDot} ${styles.activeDotAnime}`;
    case "live":
      return styles.liveDot;
    default:
      return styles.activeDot;
  }
}

function NavLink({
  item,
  active,
  collapsed,
  onCommandPalette,
  kbdLabel,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onCommandPalette?: () => void;
  kbdLabel?: string;
}) {
  const className = [
    styles.item,
    collapsed ? styles.itemCollapsed : "",
    active ? styles.itemActive : "",
    accentClass(item.accent, active),
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {active && <span className={railClass(item.accent)} aria-hidden />}

      <span className={styles.iconWrap}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d={item.icon} />
        </svg>
      </span>

      {!collapsed && (
        <>
          <span className={styles.label}>{item.label}</span>
          {item.commandPalette && kbdLabel && (
            <span className={styles.navKbd} aria-hidden>
              {kbdLabel}
            </span>
          )}
          {active && item.accent === "live" && <span className={styles.liveDot} aria-hidden />}
          {active && item.accent !== "live" && (
            <span className={activeDotClass(item.accent)} aria-hidden />
          )}
        </>
      )}
    </>
  );

  if (item.commandPalette && onCommandPalette) {
    return (
      <button
        type="button"
        onClick={onCommandPalette}
        title={collapsed ? `${item.label} (${kbdLabel || "⌘K"})` : undefined}
        className={className}
        aria-label="Open search and quick actions"
      >
        {inner}
      </button>
    );
  }

  const onNavClick = () => {
    // Immediate Movies/TV highlight before Next finishes the soft nav
    if (item.accent === "movies") {
      window.dispatchEvent(new CustomEvent("flyx:navigate", { detail: { type: "movie" } }));
    } else if (item.accent === "tv") {
      window.dispatchEvent(new CustomEvent("flyx:navigate", { detail: { type: "tv" } }));
    }
  };

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={className}
      aria-current={active ? "page" : undefined}
      onClick={onNavClick}
    >
      {inner}
    </Link>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const palette = useCommandPaletteOptional();
  const isApple = useIsApple();
  const { user } = useAuth();
  const kbdLabel = isApple ? "⌘K" : "Ctrl K";

  // Keep Movies/TV highlight in sync with ?type= even on soft navigations.
  // Next useSearchParams + live window.location cover Link, router.push, and back/forward.
  const paramType = searchParams.get("type");
  const [liveType, setLiveType] = useState<string | null>(paramType);

  useEffect(() => {
    setLiveType(paramType);
  }, [paramType, pathname, searchParams]);

  useEffect(() => {
    const syncFromLocation = () => {
      try {
        setLiveType(new URLSearchParams(window.location.search).get("type"));
      } catch {
        /* ignore */
      }
    };
    const onFlyxNav = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string | null }>).detail;
      if (detail && "type" in detail) {
        setLiveType(detail.type ?? null);
        return;
      }
      syncFromLocation();
    };
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener("flyx:navigate", onFlyxNav as EventListener);
    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("flyx:navigate", onFlyxNav as EventListener);
    };
  }, []);

  const rawType = liveType ?? paramType;
  const mediaType = browseTypeFromPath(pathname, rawType);

  useEffect(() => {
    const stored = localStorage.getItem("flyx-sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  useEffect(() => {
    document.querySelector(".app-shell")?.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem("flyx-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Hide on player, admin, login, and landing page
  const isPlayer =
    pathname === "/watch" ||
    pathname.startsWith("/watch/") ||
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/setup";

  // isLanding must be state-based to avoid SSR hydration mismatch.
  // The login page sets data-landing via useEffect (client-only).
  const [isLanding, setIsLanding] = useState(false);
  useEffect(() => {
    if (pathname !== "/") return;
    const el = document.documentElement;
    const check = () => setIsLanding(el.getAttribute("data-landing") === "1");
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ["data-landing"] });
    return () => observer.disconnect();
  }, [pathname]);

  if (isPlayer || isLanding) {
    return null;
  }

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}
      aria-label="Main navigation"
    >
      <div className={styles.orbTop} aria-hidden />
      <div className={styles.orbMid} aria-hidden />
      <div className={styles.orbBottom} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <Link href="/" className={`${styles.brand} ${collapsed ? styles.brandCollapsed : ""}`}>
        <span className={styles.logoMark}>
          <img src="/favicon.svg" alt="" aria-hidden />
        </span>
        {!collapsed && (
          <>
            <span className={styles.logoText}>Flyx</span>
            <span className={styles.logoBadge}>3.0</span>
          </>
        )}
      </Link>

      <nav className={styles.nav}>
        {!collapsed && <p className={styles.sectionLabel}>Discover</p>}

        {DISCOVER.map((item) => {
          // For browse items, pass resolved media type so Movies/TV toggle correctly
          const typeForMatch =
            item.accent === "movies" || item.accent === "tv" ? mediaType : rawType;
          const active = item.match(pathname, typeForMatch);
          return (
            <NavLink
              key={item.href}
              item={item}
              active={active}
              collapsed={collapsed}
              onCommandPalette={palette?.openPalette}
              kbdLabel={kbdLabel}
            />
          );
        })}

        <div className={styles.divider} />

        {!collapsed && (
          <p className={`${styles.sectionLabel} ${styles.sectionLabelMuted}`}>Library</p>
        )}

        {LIBRARY.map((item) => {
          const active = item.match(pathname, rawType);
          return <NavLink key={item.href} item={item} active={active} collapsed={collapsed} />;
        })}
      </nav>

      <div className={styles.footer}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnCollapsed : ""}`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`${styles.collapseIcon} ${collapsed ? styles.collapseIconFlipped : ""}`}
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>

        {!collapsed && user && (
          <div className={styles.accountRow}>
            <span className={styles.accountAvatar} aria-hidden>
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span className={styles.accountName}>{user.username}</span>
          </div>
        )}

        {!collapsed && (
          <div className={styles.status}>
            <span className={styles.statusDot} aria-hidden />
            <span className={styles.statusText}>Streaming ready</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * useSearchParams requires Suspense in Next.js app router.
 * Without it, Movies/TV active state can stick after client navigations.
 */
export default function Sidebar() {
  return (
    <Suspense fallback={null}>
      <SidebarInner />
    </Suspense>
  );
}
