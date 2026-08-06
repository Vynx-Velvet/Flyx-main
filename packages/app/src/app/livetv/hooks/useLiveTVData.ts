/**
 * LiveTV Data Hook — DLHD provider.
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// TYPES
// ============================================================================

export type Provider = "dlhd";

export type ContentCategory = "all" | "live-tv" | "live-sports";

export interface LiveEvent {
  id: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  time: string;
  isoTime?: string;
  isLive: boolean;
  source: Provider;
  poster?: string;
  viewers?: string;
  channels: Array<{
    name: string;
    channelId: string;
    href: string;
  }>;
  startsAt?: number;
  endsAt?: number;
  startsIn?: string;
}

export interface TVChannel {
  id: string;
  name: string;
  category: string;
  country: string;
  countryName?: string;
  logo?: string;
  viewers?: number;
  source: Provider;
  channelId: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

export interface ProviderInfo {
  id: Provider;
  label: string;
  categories: ContentCategory[];
  eventCount: number;
  channelCount: number;
  liveCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROVIDER_LABELS: Record<Provider, string> = {
  dlhd: "DLHD",
};

const PROVIDER_CATEGORY_MAP: Record<Provider, ContentCategory[]> = {
  dlhd: ["live-tv", "live-sports"],
};

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  all: "All",
  "live-tv": "Live TV",
  "live-sports": "Sports",
};

const CATEGORY_ICONS_MAP: Record<ContentCategory, string> = {
  all: "\u{1F4FA}",
  "live-tv": "\u{1F4E1}",
  "live-sports": "\u{26BD}",
};

const SPORT_ICONS: Record<string, string> = {
  soccer: "\u{26BD}", football: "\u{26BD}", basketball: "\u{1F3C0}", tennis: "\u{1F3BE}",
  cricket: "\u{1F3CF}", hockey: "\u{1F3D2}", baseball: "\u{26BE}", golf: "\u{26F3}",
  rugby: "\u{1F3C9}", motorsport: "\u{1F3CE}", f1: "\u{1F3CE}", boxing: "\u{1F94A}",
  mma: "\u{1F94A}", ufc: "\u{1F94A}", wwe: "\u{1F93C}", volleyball: "\u{1F3D0}",
  "am. football": "\u{1F3C8}", nfl: "\u{1F3C8}", nba: "\u{1F3C0}", nhl: "\u{1F3D2}",
};

const CATEGORY_ICONS: Record<string, string> = {
  sports: "\u{26BD}", entertainment: "\u{1F3AC}", news: "\u{1F4F0}", movies: "\u{1F3A5}",
  kids: "\u{1F9B8}", documentary: "\u{1F30D}", music: "\u{1F3B5}", general: "\u{1F4FA}",
};

// ============================================================================
// HELPERS
// ============================================================================

function getSportIcon(sport: string): string {
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "\u{1F4FA}";
}

function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[category.toLowerCase()] || "\u{1F4FA}";
}

function formatLocalTime(isoTime?: string, fallbackTime?: string): string {
  if (isoTime) {
    try {
      const date = new Date(isoTime);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
        });
      }
    } catch { /* */ }
  }
  return fallbackTime || "";
}

// ============================================================================
// HOOK
// ============================================================================

export function useLiveTVData() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [selectedProvider, setSelectedProvider] = useState<Provider | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory>("all");

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [channels, setChannels] = useState<TVChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [eventsRes, channelsRes] = await Promise.allSettled([
        fetch("/api/livetv/schedule").then((r) => r.json()),
        fetch("/api/livetv/dlhd-channels").then((r) => r.json()),
      ]);

      const newEvents: LiveEvent[] = [];
      if (eventsRes.status === "fulfilled" && eventsRes.value.success && eventsRes.value.schedule?.categories) {
        for (const category of eventsRes.value.schedule.categories) {
          for (const event of category.events || []) {
            newEvents.push({
              id: `dlhd-${event.id}`,
              title: event.title,
              sport: event.sport,
              league: event.league,
              teams: event.teams,
              time: formatLocalTime(event.isoTime, event.time),
              isoTime: event.isoTime,
              isLive: event.isLive,
              source: "dlhd",
              channels: event.channels || [],
            });
          }
        }
      }

      const newChannels: TVChannel[] = [];
      if (channelsRes.status === "fulfilled" && channelsRes.value.success && channelsRes.value.channels) {
        for (const ch of channelsRes.value.channels) {
          newChannels.push({
            id: ch.id,
            name: ch.name,
            category: ch.category || "general",
            country: ch.country || "",
            countryName: ch.countryInfo?.name,
            source: "dlhd",
            channelId: ch.id,
          });
        }
      }

      setEvents(newEvents);
      setChannels(newChannels);

      if (newEvents.length === 0 && newChannels.length === 0) {
        setError("No content available. The schedule may be temporarily unavailable.");
      }
    } catch (err) {
      setError("Failed to load content. Please try again.");
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filtered data ──

  const filteredEvents = useMemo(() => {
    let result = events;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(query) ||
        e.sport?.toLowerCase().includes(query) ||
        e.teams?.home.toLowerCase().includes(query) ||
        e.teams?.away.toLowerCase().includes(query)
      );
    }
    return result;
  }, [events, searchQuery]);

  const filteredChannels = useMemo(() => {
    let result = channels;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query) ||
        c.country.toLowerCase().includes(query)
      );
    }
    if (selectedCountry !== "all") {
      result = result.filter((c) => c.country === selectedCountry);
    }
    return result;
  }, [channels, searchQuery, selectedCountry]);

  const currentlyLive = useMemo(() => {
    return filteredEvents.filter((e) => e.isLive);
  }, [filteredEvents]);

  const upcoming = useMemo(() => {
    return filteredEvents.filter((e) => !e.isLive && e.startsAt);
  }, [filteredEvents]);

  const sportCategories = useMemo(() => {
    const sportMap = new Map<string, number>();
    events.forEach((e) => {
      if (e.sport) {
        const sport = e.sport.toLowerCase();
        sportMap.set(sport, (sportMap.get(sport) || 0) + 1);
      }
    });
    return Array.from(sportMap.entries())
      .map(([sport, count]) => ({
        id: sport,
        name: sport.charAt(0).toUpperCase() + sport.slice(1).replace(/-/g, " "),
        icon: getSportIcon(sport),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const channelCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    channels.forEach((c) => {
      catMap.set(c.category, (catMap.get(c.category) || 0) + 1);
    });
    return Array.from(catMap.entries())
      .map(([cat, count]) => ({
        id: cat,
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        icon: getCategoryIcon(cat),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [channels]);

  const availableCountries = useMemo(() => {
    const countryMap = new Map<string, { name: string; count: number }>();
    channels.forEach((c) => {
      if (c.country) {
        const existing = countryMap.get(c.country);
        if (existing) {
          existing.count++;
        } else {
          countryMap.set(c.country, {
            name: c.countryName || c.country.toUpperCase(),
            count: 1,
          });
        }
      }
    });
    return Array.from(countryMap.entries())
      .map(([code, info]) => ({ code, ...info }))
      .sort((a, b) => b.count - a.count);
  }, [channels]);

  const providers = useMemo((): ProviderInfo[] => {
    return [{
      id: "dlhd",
      label: PROVIDER_LABELS["dlhd"],
      categories: PROVIDER_CATEGORY_MAP["dlhd"],
      eventCount: events.length,
      channelCount: channels.length,
      liveCount: events.filter((e) => e.isLive).length,
    }];
  }, [events, channels]);

  const categories = useMemo(() => {
    const cats: ContentCategory[] = ["all", "live-tv", "live-sports"];
    return cats.map((id) => ({
      id,
      label: CATEGORY_LABELS[id],
      icon: CATEGORY_ICONS_MAP[id],
      providerCount: 1,
      eventCount: events.length,
      channelCount: channels.length,
    }));
  }, [events, channels]);

  const handleCategoryChange = useCallback((category: ContentCategory) => {
    setSelectedCategory(category);
    setSelectedProvider("all");
  }, []);

  const totalLive = currentlyLive.length;
  const totalEvents = filteredEvents.length;
  const totalChannels = filteredChannels.length;

  return {
    events: filteredEvents,
    channels: filteredChannels,
    allEvents: events,
    allChannels: channels,
    currentlyLive,
    upcoming,
    sportCategories,
    channelCategories,
    selectedProvider,
    setSelectedProvider,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    providers,
    categories,
    selectedCountry,
    setSelectedCountry,
    availableCountries,
    viewMode,
    setViewMode,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    totalLive,
    totalEvents,
    totalChannels,
    dlhdEvents: events,
    dlhdChannels: channels,
    eventsByProvider: { dlhd: events },
    channelsByProvider: { dlhd: channels },
    refresh: fetchAll,
  };
}

export type DLHDChannel = TVChannel;
