"use client";

/**
 * useMediaSession — publish now-playing metadata to the system media
 * session (Windows SMTC, read by VRChat companions like MagicChatbox)
 * and to the window title (Electron follows document.title).
 *
 * Gated by the `showNowPlaying` player preference (read once at mount,
 * same pattern as VideoPlayer's `useRef(getPlayerPreferences())`).
 *
 * Optional `videoRef` enables position state and play/pause/seek media
 * keys wired to the video element driving playback.
 */

import { useEffect, useRef, type RefObject } from "react";
import { getPlayerPreferences } from "@/lib/utils/player-preferences";
import { buildNowPlaying, type BuildNowPlayingInput } from "@/lib/utils/now-playing";

export interface UseMediaSessionOptions extends BuildNowPlayingInput {
  /** Video element driving playback — enables position state + media-key actions. */
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Optional poster/backdrop URL for MediaMetadata artwork. */
  artwork?: string;
}

const ACTION_KEYS = ["play", "pause", "seekto", "seekbackward", "seekforward"] as const;

function getMediaSession(): MediaSession | null {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return null;
  return navigator.mediaSession;
}

function safeSetActionHandler(
  ms: MediaSession,
  key: string,
  handler: MediaSessionActionHandler | null,
) {
  try {
    ms.setActionHandler(key as MediaSessionAction, handler);
  } catch {
    /* unsupported action key — best-effort */
  }
}

export function useMediaSession({ videoRef, artwork, ...meta }: UseMediaSessionOptions): void {
  // Mount-time read — toggling the setting applies on the next play session,
  // same semantics as the other player preferences.
  const enabledRef = useRef(getPlayerPreferences().showNowPlaying);

  // Effect 1: MediaMetadata + document.title
  useEffect(() => {
    if (!enabledRef.current) return;
    const ms = getMediaSession();
    const { mediaTitle, documentTitle, episodeLabel } = buildNowPlaying(meta);
    if (!mediaTitle || !documentTitle) return; // placeholder title — publish nothing

    const previousTitle = document.title;
    document.title = documentTitle;

    if (ms) {
      try {
        ms.metadata = new MediaMetadata({
          title: mediaTitle,
          artist: "Flyx",
          album: episodeLabel ?? undefined,
          // `src` only — image dimensions/type are unknown, Chromium sniffs.
          artwork: artwork ? [{ src: artwork }] : [],
        });
      } catch {
        /* metadata is best-effort */
      }
    }

    return () => {
      // Restore only if we still own the title — never clobber a title
      // Next.js applied for the new route during client navigation.
      if (document.title === documentTitle) document.title = previousTitle;
      if (ms) {
        try {
          ms.metadata = null;
        } catch {
          /* ignore */
        }
        for (const key of ACTION_KEYS) safeSetActionHandler(ms, key, null);
      }
    };
    // Scalar deps only — the caller may pass a fresh object literal every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title, meta.mediaType, meta.season, meta.episode, meta.year, meta.malId, meta.isAnime, artwork]);

  // Effect 2: position state + media-key actions against the video element
  useEffect(() => {
    if (!enabledRef.current) return;
    const video = videoRef?.current;
    if (!video) return;
    const ms = getMediaSession();
    if (!ms) return;

    const updatePosition = () => {
      const dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) return; // live/unknown duration — skip
      const pos = Math.min(Math.max(0, video.currentTime), dur);
      try {
        ms.setPositionState({ duration: dur, playbackRate: video.playbackRate || 1, position: pos });
      } catch {
        /* position is best-effort */
      }
    };
    const onPlay = () => {
      try {
        ms.playbackState = "playing";
      } catch {
        /* ignore */
      }
    };
    const onPause = () => {
      try {
        ms.playbackState = "paused";
      } catch {
        /* ignore */
      }
    };

    safeSetActionHandler(ms, "play", () => {
      void video.play().catch(() => {});
    });
    safeSetActionHandler(ms, "pause", () => video.pause());
    safeSetActionHandler(ms, "seekto", (d) => {
      const t = d.seekTime ?? video.currentTime;
      if (Number.isFinite(t)) {
        const max = Number.isFinite(video.duration) ? video.duration : t;
        video.currentTime = Math.min(Math.max(0, t), max);
      }
    });
    safeSetActionHandler(ms, "seekbackward", (d) => {
      video.currentTime = Math.max(0, video.currentTime - (d.seekOffset ?? 10));
    });
    safeSetActionHandler(ms, "seekforward", (d) => {
      const next = video.currentTime + (d.seekOffset ?? 10);
      video.currentTime = Number.isFinite(video.duration) ? Math.min(next, video.duration) : next;
    });

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", updatePosition); // ~4Hz — plenty for SMTC progress
    video.addEventListener("durationchange", updatePosition);
    video.addEventListener("loadedmetadata", updatePosition);
    updatePosition(); // prime before the first event

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", updatePosition);
      video.removeEventListener("durationchange", updatePosition);
      video.removeEventListener("loadedmetadata", updatePosition);
      for (const key of ACTION_KEYS) safeSetActionHandler(ms, key, null);
    };
  }, [videoRef]);
}
