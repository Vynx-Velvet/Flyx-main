"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCommandPaletteOptional } from "@/components/search/CommandPalette";

const PRIMARY_TABS = [
  {
    href: "/",
    label: "Home",
    match: (path: string) => path === "/",
    icon: "M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5",
  },
  {
    href: "/browse",
    label: "Explore",
    match: (path: string) => path.startsWith("/browse") || path.startsWith("/details"),
    icon: "M4 5.5h16M4 12h10M4 18.5h13",
  },
  {
    href: "/search",
    label: "Search",
    match: (path: string) => path.startsWith("/search"),
    commandPalette: true,
    icon: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-3.5-3.5",
  },
  {
    href: "/watchlist",
    label: "Saved",
    match: (path: string) => path.startsWith("/watchlist"),
    icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z",
  },
];

const MORE_LINKS = [
  {
    href: "/anime",
    label: "Anime",
    description: "Series and films",
    icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 10h.01M15 10h.01M9 15c2 1.5 4 1.5 6 0",
  },
  {
    href: "/manga",
    label: "Manga",
    description: "Read by chapter",
    icon: "M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2V5Zm16 0a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2V5Z",
  },
  {
    href: "/livetv",
    label: "Live TV",
    description: "Sports and channels",
    icon: "M8 6a7 7 0 0 0 0 12m8-12a7 7 0 0 1 0 12m-4-3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  },
  {
    href: "/downloads",
    label: "Downloads",
    description: "Watch offline",
    icon: "M12 3v12m0 0 5-5m-5 5-5-5M4 19h16",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Playback and account",
    icon: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.05a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.9.31l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.05 14H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.33-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.31l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05a1.7 1.7 0 0 0-1.55 1Z",
  },
  {
    href: "/help",
    label: "Help",
    description: "Guides and support",
    icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3-13a3 3 0 0 1 5.8 1c0 2-2.8 2.4-2.8 4m0 3h.01",
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

export default function BottomTabs() {
  const pathname = usePathname();
  const palette = useCommandPaletteOptional();
  const [moreOpen, setMoreOpen] = useState(false);
  const [isLanding, setIsLanding] = useState(false);

  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (pathname !== "/") {
      setIsLanding(false);
      return;
    }
    const root = document.documentElement;
    const sync = () => setIsLanding(root.getAttribute("data-landing") === "1");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-landing"] });
    return () => observer.disconnect();
  }, [pathname]);

  const hidden =
    pathname === "/watch" ||
    pathname.startsWith("/watch/") ||
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/setup" ||
    isLanding;

  if (hidden) return null;

  const moreActive = MORE_LINKS.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {moreOpen && (
        <div className="mobile-more-layer" role="presentation">
          <button
            className="mobile-more-backdrop"
            type="button"
            onClick={() => setMoreOpen(false)}
            aria-label="Close menu"
          />
          <section
            className="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
          >
            <div className="mobile-more-handle" aria-hidden />
            <div className="mobile-more-head">
              <div>
                <span>Navigate</span>
                <h2>More from Flyx</h2>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu">
                ×
              </button>
            </div>
            <div className="mobile-more-grid">
              {MORE_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={pathname.startsWith(item.href) ? "active" : undefined}
                >
                  <span className="mobile-more-icon">
                    <Icon path={item.icon} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      <nav className="mobile-tabs" aria-label="Primary navigation">
        <div className="mobile-tabs-inner">
          {PRIMARY_TABS.map((tab) => {
            const active = tab.match(pathname);
            const content = (
              <>
                <span className="mobile-tab-icon">
                  <Icon path={tab.icon} />
                </span>
                <span>{tab.label}</span>
              </>
            );
            if (tab.commandPalette && palette?.openPalette) {
              return (
                <button
                  key={tab.href}
                  type="button"
                  onClick={palette.openPalette}
                  className={active ? "active" : undefined}
                  aria-label="Open search"
                >
                  {content}
                </button>
              );
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {content}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={moreActive || moreOpen ? "active" : undefined}
            aria-expanded={moreOpen}
          >
            <span className="mobile-tab-icon">
              <Icon path="M5 12h.01M12 12h.01M19 12h.01" />
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
