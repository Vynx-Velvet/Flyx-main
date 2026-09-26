/**
 * Live TV — page (v2).
 *
 * One column, three modes:
 *   Live now  — big cards for what's on air + "Starting soon" rows
 *   Sports    — every scheduled event as rows, grouped by sport, with chips
 *   Channels  — 850 channels as tiles with category chips + country select
 * Search runs across events and channels at once.
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveTVData, type LiveEvent, type TVChannel } from './hooks/useLiveTVData';
import { VideoPlayer } from './components/VideoPlayer';
import { ExtensionGate } from '@/components/ExtensionGate';
import { LiveNowStrip } from './components/LiveNowStrip';
import { EventList } from './components/EventList';
import { ChannelGrid } from './components/ChannelGrid';
import { FilterChips } from './components/FilterChips';
import styles from './LiveTVPage.module.css';

type Mode = 'live' | 'sports' | 'channels';

export default function LiveTVRefactored() {
  const {
    events,
    channels,
    currentlyLive,
    upcoming,
    eventAvailability,
    sportCategories,
    channelCategories,
    availableCountries,
    selectedCountry,
    setSelectedCountry,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    totalLive,
    refresh,
  } = useLiveTVData();

  const [mode, setMode] = useState<Mode>('live');
  const modeRowRef = useRef<HTMLDivElement>(null);
  const goToMode = useCallback((m: Mode) => {
    setMode(m);
    // Land at the top of the section, not wherever the link was.
    window.requestAnimationFrame(() => {
      const top = (modeRowRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 84;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  }, []);
  const [sport, setSport] = useState('all');
  const [channelCategory, setChannelCategory] = useState('all');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!loading) setUpdatedAt(new Date());
  }, [loading, events.length, channels.length]);

  // Player
  const [selectedEvent, setSelectedEvent] = useState<LiveEvent | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<TVChannel | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const playEvent = useCallback((event: LiveEvent) => {
    setSelectedEvent(event);
    setSelectedChannel(null);
    setIsPlayerOpen(true);
  }, []);
  const playChannel = useCallback((channel: TVChannel) => {
    setSelectedChannel(channel);
    setSelectedEvent(null);
    setIsPlayerOpen(true);
  }, []);
  const closePlayer = useCallback(() => {
    setIsPlayerOpen(false);
    setSelectedEvent(null);
    setSelectedChannel(null);
  }, []);

  const sportEvents = useMemo(
    () => (sport === 'all' ? events : events.filter((e) => e.sport?.toLowerCase() === sport)),
    [events, sport],
  );
  const searching = searchQuery.trim().length > 0;
  const sportChips = useMemo(
    () => sportCategories.map((c) => ({ id: c.id, label: c.name, icon: c.icon, count: c.count })),
    [sportCategories],
  );
  const channelChips = useMemo(
    () => channelCategories.map((c) => ({ id: c.id, label: c.name, icon: c.icon, count: c.count })),
    [channelCategories],
  );

  const modes: Array<{ id: Mode; label: string; count: number }> = [
    { id: 'live', label: 'Live now', count: totalLive },
    { id: 'sports', label: 'Sports', count: events.length },
    { id: 'channels', label: 'Channels', count: channels.length },
  ];

  const updatedLabel = updatedAt
    ? `Updated ${updatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';

  return (
    <ExtensionGate>
      <main className={`livetv-page min-h-screen ${styles.page}`}>
        <div className="page-glow" />
        <div className="content-container relative py-5 md:py-8">
          {/* ── Header ── */}
          <div className="page-header mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Live</p>
              <h1>Live TV</h1>
              <p className="subtitle">
                <span className={styles.subtitleLive}>
                  <span className={styles.liveDot} />
                  {totalLive} live now
                </span>
                {' · '}
                {events.length} events today · {channels.length} channels
              </p>
            </div>
            <div className={styles.tools}>
              <label className={styles.search}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  placeholder="Search teams, leagues, channels…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search live TV"
                />
                {searchQuery && (
                  <button type="button" className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Clear search">
                    ✕
                  </button>
                )}
              </label>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={refresh}
                disabled={loading}
                title="Refresh schedule"
                aria-label="Refresh schedule"
              >
                <svg className={loading ? styles.spinning : ''} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <button type="button" className={styles.loadMoreBtn} onClick={refresh}>
                Retry
              </button>
            </div>
          )}

          {/* ── Search results (across everything) ── */}
          {searching ? (
            <>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>
                    Events <small>{events.length}</small>
                  </h2>
                </div>
                <EventList
                  events={events}
                  onPlay={playEvent}
                  availabilityOf={eventAvailability}
                  groupBy="time"
                  emptyTitle="No events match"
                  emptyHint="Try a team, league or sport name."
                />
              </section>
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>
                    Channels <small>{channels.length}</small>
                  </h2>
                </div>
                <ChannelGrid
                  channels={channels}
                  categories={channelChips}
                  countries={availableCountries}
                  category={channelCategory}
                  onCategoryChange={setChannelCategory}
                  country={selectedCountry}
                  onCountryChange={setSelectedCountry}
                  onPlay={playChannel}
                  loading={loading && channels.length === 0}
                />
              </section>
            </>
          ) : (
            <>
              {/* ── Mode switcher ── */}
              <div className={styles.modeRow} ref={modeRowRef}>
                <div className="segmented" role="tablist" aria-label="Live TV section">
                  {modes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="tab"
                      data-active={mode === m.id ? 'true' : 'false'}
                      aria-selected={mode === m.id}
                      onClick={() => setMode(m.id)}
                      data-tv-focusable="true"
                    >
                      {m.label}
                      <span className={styles.modeCount}>{m.count}</span>
                    </button>
                  ))}
                </div>
                {updatedLabel && <span className={styles.updated}>{updatedLabel}</span>}
              </div>

              {mode === 'live' && (
                <>
                  <section className={styles.section}>
                    <div className={styles.sectionHead}>
                      <h2 className={styles.sectionTitle}>
                        <span className={styles.liveDot} />
                        On air <small>{currentlyLive.length}</small>
                      </h2>
                      <span className={styles.sectionHint}>Tap a card to watch</span>
                    </div>
                    {loading && events.length === 0 ? (
                      <div className={styles.skeletonRows}>
                        <div className={styles.skeleton} />
                        <div className={styles.skeleton} />
                      </div>
                    ) : currentlyLive.length ? (
                      <LiveNowStrip events={currentlyLive} onPlay={playEvent} availabilityOf={eventAvailability} />
                    ) : (
                      <div className={styles.empty}>
                        <strong>Nothing on air right now</strong>
                        The next events are listed below, or browse channels.
                      </div>
                    )}
                  </section>

                  <section className={styles.section}>
                    <div className={styles.sectionHead}>
                      <h2 className={styles.sectionTitle}>
                        Up next <small>{upcoming.length}</small>
                      </h2>
                      <button type="button" className={styles.sectionHint} onClick={() => goToMode('sports')} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#e1ff98' }}>
                        See all sports →
                      </button>
                    </div>
                    <EventList
                      events={upcoming.slice(0, 40)}
                      onPlay={playEvent}
                      availabilityOf={eventAvailability}
                      groupBy="time"
                      emptyTitle="No upcoming events"
                      emptyHint="The schedule refreshes throughout the day."
                    />
                  </section>
                </>
              )}

              {mode === 'sports' && (
                <section className={styles.section}>
                  <FilterChips
                    items={sportChips}
                    value={sport}
                    onChange={setSport}
                    allLabel="All sports"
                    allCount={events.length}
                    ariaLabel="Sport"
                  />
                  {loading && events.length === 0 ? (
                    <div className={styles.skeletonRows}>
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className={styles.skeleton} />
                      ))}
                    </div>
                  ) : (
                    <EventList
                      events={sportEvents}
                      onPlay={playEvent}
                      availabilityOf={eventAvailability}
                      groupBy={sport === 'all' ? 'sport' : 'time'}
                      emptyTitle="No events for this sport today"
                    />
                  )}
                </section>
              )}

              {mode === 'channels' && (
                <section className={styles.section}>
                  <ChannelGrid
                    channels={channels}
                    categories={channelChips}
                    countries={availableCountries}
                    category={channelCategory}
                    onCategoryChange={setChannelCategory}
                    country={selectedCountry}
                    onCountryChange={setSelectedCountry}
                    onPlay={playChannel}
                    loading={loading && channels.length === 0}
                  />
                </section>
              )}
            </>
          )}
        </div>

        <VideoPlayer event={selectedEvent} channel={selectedChannel} isOpen={isPlayerOpen} onClose={closePlayer} />
      </main>
    </ExtensionGate>
  );
}
