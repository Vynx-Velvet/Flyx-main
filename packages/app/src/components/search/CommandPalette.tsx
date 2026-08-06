"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { isModKey, useIsApple } from "@/hooks/useIsApple";

/* ── Types ───────────────────────────────────────────────────────── */

type ActionId = string;

interface QuickAction {
  id: ActionId;
  label: string;
  hint?: string;
  href: string;
  group: "Navigate" | "Library" | "Search";
  keywords?: string;
  icon: "home" | "movie" | "tv" | "anime" | "live" | "search" | "list" | "settings";
}

interface SearchHit {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  year?: string;
  poster?: string;
  rating?: number;
}

interface CommandPaletteContextValue {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

/** Safe hook when provider may be absent */
export function useCommandPaletteOptional() {
  return useContext(CommandPaletteContext);
}

/* ── Quick actions ───────────────────────────────────────────────── */

const ACTIONS: QuickAction[] = [
  {
    id: "nav-home",
    label: "Home",
    hint: "Go to home",
    href: "/",
    group: "Navigate",
    keywords: "main start",
    icon: "home",
  },
  {
    id: "nav-movies",
    label: "Movies",
    hint: "Browse movies",
    href: "/browse?type=movie",
    group: "Navigate",
    keywords: "film cinema",
    icon: "movie",
  },
  {
    id: "nav-tv",
    label: "TV Shows",
    hint: "Browse series",
    href: "/browse?type=tv",
    group: "Navigate",
    keywords: "series television",
    icon: "tv",
  },
  {
    id: "nav-anime",
    label: "Anime",
    hint: "Browse anime",
    href: "/anime",
    group: "Navigate",
    keywords: "mal jikan",
    icon: "anime",
  },
  {
    id: "nav-live",
    label: "Live TV",
    hint: "Sports & live",
    href: "/livetv",
    group: "Navigate",
    keywords: "sports stream",
    icon: "live",
  },
  {
    id: "nav-search",
    label: "Full search page",
    hint: "Open search",
    href: "/search",
    group: "Search",
    keywords: "find query",
    icon: "search",
  },
  {
    id: "nav-watchlist",
    label: "Watchlist",
    hint: "Saved titles",
    href: "/watchlist",
    group: "Library",
    keywords: "saved favorites",
    icon: "list",
  },
  {
    id: "nav-settings",
    label: "Settings",
    hint: "Preferences",
    href: "/settings",
    group: "Library",
    keywords: "config preferences",
    icon: "settings",
  },
];

/* ── Icons ───────────────────────────────────────────────────────── */

function ActionIcon({ name }: { name: QuickAction["icon"] }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5L12 3l9 7.5M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
        </svg>
      );
    case "movie":
      return (
        <svg {...common}>
          <path d="M2 4h20v16H2zM7 4v16M17 4v16M2 12h20" />
        </svg>
      );
    case "tv":
      return (
        <svg {...common}>
          <path d="M2 7h20v14H2zM8 3l4 4 4-4" />
        </svg>
      );
    case "anime":
      return (
        <svg {...common}>
          <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
        </svg>
      );
    case "live":
      return (
        <svg {...common}>
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2a6 6 0 010-8.5M12 14a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      );
  }
}

/* ── Provider + palette ──────────────────────────────────────────── */

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openPalette, closePalette, togglePalette }),
    [open, openPalette, closePalette, togglePalette],
  );

  // Global hotkey: Ctrl/⌘+K opens the Vercel-style command menu (not /search)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Prefer physical key so layouts still hit "K"
      const isK =
        e.code === "KeyK" || e.key?.toLowerCase() === "k";
      if (!isK || !isModKey(e) || e.altKey || e.shiftKey) return;
      // Don't steal when user is mid-composition (IME)
      if (e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {mounted &&
        open &&
        createPortal(
          <CommandPaletteModal onClose={closePalette} />,
          document.body,
        )}
    </CommandPaletteContext.Provider>
  );
}

/* ── Modal ───────────────────────────────────────────────────────── */

function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const isApple = useIsApple();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Focus input on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, []);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced TMDB multi-search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const path = `/search/multi?query=${encodeURIComponent(q)}&include_adult=false&page=1`;
        const res = await fetch(
          `/api/tmdb?path=${encodeURIComponent(path)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;

        const mapped: SearchHit[] = (data.results || [])
          .filter(
            (r: any) =>
              (r.media_type === "movie" || r.media_type === "tv") && r.id,
          )
          .slice(0, 8)
          .map((r: any) => ({
            id: r.id as number,
            title: (r.title || r.name || "Untitled") as string,
            mediaType: (r.media_type === "tv" ? "tv" : "movie") as
              | "movie"
              | "tv",
            year: (r.release_date || r.first_air_date || "").slice(0, 4) || undefined,
            poster: r.poster_path
              ? `https://image.tmdb.org/t/p/w92${r.poster_path}`
              : undefined,
            rating: r.vote_average as number | undefined,
          }));

        setHits(mapped);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) => {
      const hay = `${a.label} ${a.hint || ""} ${a.keywords || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  // Flat list for keyboard nav: actions then search hits
  type FlatItem =
    | { kind: "action"; action: QuickAction }
    | { kind: "hit"; hit: SearchHit };

  // Display order === keyboard order: Navigate → Library → Search → Titles
  const { groups, flatItems } = useMemo(() => {
    const map = new Map<string, QuickAction[]>();
    for (const a of filteredActions) {
      const list = map.get(a.group) || [];
      list.push(a);
      map.set(a.group, list);
    }
    if (query.trim().length >= 1) {
      const full: QuickAction = {
        id: "search-full",
        label: `Search “${query.trim()}” on full page`,
        hint: "Open search results",
        href: `/search?q=${encodeURIComponent(query.trim())}`,
        group: "Search",
        icon: "search",
      };
      const list = map.get("Search") || [];
      list.push(full);
      map.set("Search", list);
    }

    const order = ["Navigate", "Library", "Search"] as const;
    const ordered = new Map<string, QuickAction[]>();
    for (const g of order) {
      if (map.has(g)) ordered.set(g, map.get(g)!);
    }

    const flat: FlatItem[] = [];
    for (const actions of ordered.values()) {
      for (const action of actions) {
        flat.push({ kind: "action", action });
      }
    }
    for (const hit of hits) {
      flat.push({ kind: "hit", hit });
    }

    return { groups: ordered, flatItems: flat };
  }, [filteredActions, hits, query]);

  // Reset active when list changes
  useEffect(() => {
    setActive(0);
  }, [query, flatItems.length]);

  const runItem = useCallback(
    (item: FlatItem) => {
      onClose();
      if (item.kind === "action") {
        router.push(item.action.href);
        return;
      }
      router.push(`/details/${item.hit.id}?type=${item.hit.mediaType}`);
    },
    [onClose, router],
  );

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[active];
      if (item) runItem(item);
      else if (query.trim()) {
        onClose();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (e.key === "Tab") {
      // Keep focus inside the palette
      e.preventDefault();
      if (e.shiftKey) {
        setActive((i) => Math.max(i - 1, 0));
      } else {
        setActive((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
      }
    }
  };

  // Keep active row visible
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-cmd-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let runningIndex = -1;

  return (
    <div
      className="cmdk-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmdk-panel">
        {/* Search header */}
        <div className="cmdk-header">
          <svg
            className="cmdk-search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search titles or jump to…"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="cmdk-list"
          />
          <button type="button" className="cmdk-esc" onClick={onClose}>
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="cmdk-body" ref={listRef} id="cmdk-list" role="listbox">
          {flatItems.length === 0 && !searching && (
            <div className="cmdk-empty">
              No matching actions
              {query.trim().length >= 2 ? " or titles" : ""}.
            </div>
          )}

          {[...groups.entries()].map(([group, actions]) => (
            <div key={group} className="cmdk-group">
              <div className="cmdk-group-label">{group}</div>
              {actions.map((action) => {
                runningIndex += 1;
                const idx = runningIndex;
                const isActive = idx === active;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-cmd-index={idx}
                    className={`cmdk-item ${isActive ? "cmdk-item-active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runItem({ kind: "action", action })}
                  >
                    <span className="cmdk-item-icon">
                      <ActionIcon name={action.icon} />
                    </span>
                    <span className="cmdk-item-text">
                      <span className="cmdk-item-label">{action.label}</span>
                      {action.hint && (
                        <span className="cmdk-item-hint">{action.hint}</span>
                      )}
                    </span>
                    <span className="cmdk-item-meta">↵</span>
                  </button>
                );
              })}
            </div>
          ))}

          {(hits.length > 0 || searching) && (
            <div className="cmdk-group">
              <div className="cmdk-group-label">
                {searching ? "Searching…" : "Titles"}
              </div>
              {hits.map((hit) => {
                runningIndex += 1;
                const idx = runningIndex;
                const isActive = idx === active;
                return (
                  <button
                    key={`${hit.mediaType}-${hit.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-cmd-index={idx}
                    className={`cmdk-item ${isActive ? "cmdk-item-active" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runItem({ kind: "hit", hit })}
                  >
                    <span className="cmdk-item-poster">
                      {hit.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={hit.poster} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="cmdk-item-poster-fallback">
                          {hit.mediaType === "tv" ? "TV" : "M"}
                        </span>
                      )}
                    </span>
                    <span className="cmdk-item-text">
                      <span className="cmdk-item-label">{hit.title}</span>
                      <span className="cmdk-item-hint">
                        {hit.mediaType === "tv" ? "Series" : "Movie"}
                        {hit.year ? ` · ${hit.year}` : ""}
                        {hit.rating != null && hit.rating > 0
                          ? ` · ★ ${hit.rating.toFixed(1)}`
                          : ""}
                      </span>
                    </span>
                    <span className="cmdk-item-meta">Open</span>
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="cmdk-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            navigate
          </span>
          <span>
            <kbd>↵</kbd>
            open
          </span>
          <span>
            <kbd>esc</kbd>
            close
          </span>
          <span className="cmdk-footer-mod">
            <kbd>{isApple ? "⌘" : "Ctrl"}</kbd>
            <kbd>K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  );
}
