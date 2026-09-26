"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCommandPaletteOptional } from "@/components/search/CommandPalette";
import { NowViewing } from "@/components/layout/NowViewing";

interface NetworkSummary {
  url: string | null;
  ip?: string;
  port?: number;
  hostname?: string | null;
}

export default function DesktopHeader() {
  const pathname = usePathname();
  const palette = useCommandPaletteOptional();
  const [network, setNetwork] = useState<NetworkSummary | null>(null);
  const [isLanding, setIsLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/network", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled) setNetwork(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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

  const networkReady = network?.hostname === "0.0.0.0" && network.url;

  return (
    <header className="desktop-header">
      <NowViewing variant="desktop" />
      <button type="button" className="desktop-global-search" onClick={palette?.openPalette}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>Search movies, shows, anime, and manga</span>
        <kbd>Ctrl K</kbd>
      </button>
      <nav className="desktop-header-actions" aria-label="Quick actions">
        <Link href="/settings" className={networkReady ? "network-ready" : undefined}>
          <span className="desktop-status-dot" />
          <span>
            <small>{networkReady ? "Connect devices" : "Local only"}</small>
            <strong>{networkReady ? `${network.ip}:${network.port}` : "Network settings"}</strong>
          </span>
        </Link>
        <Link href="/watchlist" className="desktop-icon-link" aria-label="Open watchlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />
          </svg>
        </Link>
      </nav>
    </header>
  );
}
