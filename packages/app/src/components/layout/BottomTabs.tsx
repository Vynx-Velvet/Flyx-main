"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCommandPaletteOptional } from "@/components/search/CommandPalette";

const TABS = [
  {
    href: "/",
    label: "Home",
    match: (p: string) => p === "/",
    icon: "M3 10.5L12 3l9 7.5M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5",
  },
  {
    href: "/browse",
    label: "Browse",
    match: (p: string) => p.startsWith("/browse"),
    icon: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  },
  {
    href: "/search",
    label: "Search",
    match: (p: string) => p.startsWith("/search"),
    commandPalette: true,
    icon: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5",
  },
  {
    href: "/livetv",
    label: "Live",
    match: (p: string) => p.startsWith("/livetv"),
    icon: "M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 010-8.5M12 14a2 2 0 100-4 2 2 0 000 4zM16.2 7.8a6 6 0 010 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19",
  },
  {
    href: "/anime",
    label: "Anime",
    match: (p: string) => p.startsWith("/anime"),
    icon: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
  },
  {
    href: "/manga",
    label: "Manga",
    match: (p: string) => p.startsWith("/manga"),
    icon: "M4 6h16M4 12h16M4 18h16",
  },
  {
    href: "/downloads",
    label: "Downloads",
    match: (p: string) => p.startsWith("/downloads"),
    icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  },
  {
    href: "/help",
    label: "Help",
    match: (p: string) => p.startsWith("/help"),
    icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01",
  },
];

export default function BottomTabs() {
  const pathname = usePathname();
  const palette = useCommandPaletteOptional();

  // isLanding must be state-based to avoid SSR hydration mismatch
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

  // Player only — do not hide on /watchlist
  if (
    pathname === "/watch" ||
    pathname.startsWith("/watch/") ||
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/setup" ||
    isLanding
  ) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.55rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className="mx-auto flex h-[66px] max-w-lg items-center justify-around rounded-[24px] border px-1.5"
        style={{
          background:
            "linear-gradient(180deg, rgba(14,14,22,0.94) 0%, rgba(6,6,12,0.96) 100%)",
          backdropFilter: "blur(32px) saturate(1.5)",
          WebkitBackdropFilter: "blur(32px) saturate(1.5)",
          borderColor: "rgba(255,255,255,0.1)",
          boxShadow:
            "0 -8px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,229,191,0.04), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const className = `relative flex min-w-[48px] flex-col items-center gap-0.5 rounded-2xl px-1.5 py-1.5 text-[10px] font-semibold tracking-wide no-underline transition-all duration-250 active:scale-95 ${
            active ? "text-[#00e5bf]" : "text-white/35 hover:text-white/55"
          }`;

          const content = (
            <>
              {active && (
                <span
                  className="absolute -top-0.5 h-[3px] w-8 rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #00e5bf, #8b7cf0)",
                    boxShadow: "0 0 14px rgba(0,229,191,0.65)",
                  }}
                  aria-hidden
                />
              )}
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-250"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, rgba(0,229,191,0.18), rgba(139,124,240,0.12))",
                        boxShadow:
                          "0 0 16px rgba(0,229,191,0.2), inset 0 0 0 1px rgba(0,229,191,0.15)",
                      }
                    : undefined
                }
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={
                    active
                      ? "drop-shadow-[0_0_6px_rgba(0,229,191,0.6)]"
                      : undefined
                  }
                  aria-hidden
                >
                  <path d={tab.icon} />
                </svg>
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
                className={className}
                aria-label="Open search and quick actions"
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={className}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
