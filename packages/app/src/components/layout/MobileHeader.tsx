"use client";

import Link from "next/link";
import { NowViewing } from "@/components/layout/NowViewing";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCommandPaletteOptional } from "@/components/search/CommandPalette";

export default function MobileHeader() {
  const pathname = usePathname();
  const palette = useCommandPaletteOptional();
  const [isLanding, setIsLanding] = useState(false);

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

  return (
    <header className="mobile-header">
      <Link href="/" className="mobile-header-brand" aria-label="Flyx home">
        <img src="/favicon.svg" alt="" aria-hidden />
      </Link>
      <div className="mobile-header-context">
        <span>Flyx</span>
        <NowViewing variant="mobile" />
      </div>
      <button
        type="button"
        className="mobile-header-action"
        onClick={palette?.openPalette}
        aria-label="Search movies, shows, anime, and manga"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </header>
  );
}
