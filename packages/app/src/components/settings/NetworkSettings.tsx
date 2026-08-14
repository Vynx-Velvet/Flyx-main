"use client";

import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import styles from "@/app/settings/SettingsPage.module.css";

interface NetworkInfo {
  url: string | null;
  ip?: string;
  port?: number;
  reason?: string;
  urls?: { url: string; address: string }[];
  desktop?: boolean;
  hostname?: string | null;
}

/** Minimal typed surface of the Electron preload bridge (absent on web). */
interface FlyxDesktopBridge {
  isDesktop: boolean;
  onServerReady: (cb: () => void) => void;
}

function getBridge(): FlyxDesktopBridge | null {
  return (window as unknown as { flyxDesktop?: FlyxDesktopBridge }).flyxDesktop ?? null;
}

/** Wait until the server is healthy again (desktop restarts it on mode change). */
function waitForServerReady(timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(iv);
      clearTimeout(timer);
      resolve();
    };

    const bridge = getBridge();
    if (bridge) bridge.onServerReady(finish);

    // Poll /api/health as fallback (also covers non-desktop hosts)
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/health");
        if (r.ok) finish();
      } catch {
        /* server still down */
      }
    }, 1000);
    const timer = setTimeout(finish, timeoutMs);
  });
}

export default function NetworkSettings() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/network");
      if (res.ok) setInfo(await res.json());
    } catch {
      /* server may be mid-restart */
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  // Generate QR codes for each LAN URL (client-side only)
  useEffect(() => {
    if (!info?.urls) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const entry of info.urls ?? []) {
        try {
          map[entry.url] = await QRCode.toDataURL(entry.url, { width: 96, margin: 1 });
        } catch {
          /* qr generation failed — row renders without code */
        }
        if (cancelled) return;
      }
      if (!cancelled) setQrCodes(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [info?.urls]);

  const isLAN = info?.hostname === "0.0.0.0";
  const desktop = info?.desktop === true;

  async function handleToggle(mode: "localhost" | "network") {
    setSwitching(true);
    setError("");
    try {
      const res = await fetch("/api/settings/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to change network mode");
        return;
      }
      // The server must re-bind — desktop restarts automatically
      setRestarting(true);
      await waitForServerReady();
      setRestarting(false);
      await fetchInfo();
    } catch {
      setError("Network error");
    } finally {
      setSwitching(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div
          className={styles.cardIconWrapper}
          style={{ background: "linear-gradient(135deg, #0ea5e9, #2563eb)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Network Sharing</h2>
          <p className={styles.cardSubtitle}>
            Watch on phones, tablets, and TVs on your home network
          </p>
        </div>
      </div>

      <div className={styles.settingsList}>
        {/* Mode toggle — desktop only (rebinding needs a managed restart) */}
        {desktop && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Share on this network</span>
              <span className={styles.settingDesc}>
                {isLAN
                  ? "Other devices on your Wi-Fi can open Flyx."
                  : "Only this computer can open Flyx."}
              </span>
            </div>
            <button
              className={`${styles.toggle} ${isLAN ? styles.on : ""}`}
              onClick={() => handleToggle(isLAN ? "localhost" : "network")}
              disabled={switching || restarting}
              aria-label="Toggle network sharing"
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        )}

        {restarting && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Restarting Flyx…</span>
              <span className={styles.settingDesc}>
                The server is re-binding to the new network mode. This takes a moment.
              </span>
            </div>
          </div>
        )}

        {/* LAN URLs + QR codes */}
        {!isLAN && !restarting && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Not reachable from other devices</span>
              <span className={styles.settingDesc}>
                Switch on &quot;Share on this network&quot; above to let other devices connect.
              </span>
            </div>
          </div>
        )}

        {isLAN &&
          (info?.urls ?? []).map((entry) => (
            <div key={entry.url} className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>On your network</span>
                <span className={styles.settingDesc}>
                  Open this address on any device connected to the same Wi-Fi
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                <code
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    color: "#38bdf8",
                    background: "rgba(56,189,248,0.08)",
                    padding: "0.3rem 0.6rem",
                    borderRadius: 6,
                    userSelect: "all",
                  }}
                >
                  {entry.url}
                </code>
                <button
                  className={styles.actionBtn}
                  onClick={() => handleCopy(entry.url)}
                  style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}
                >
                  {copied === entry.url ? "Copied!" : "Copy"}
                </button>
                {qrCodes[entry.url] && (
                  <img
                    src={qrCodes[entry.url]}
                    alt={`QR code for ${entry.url}`}
                    width={96}
                    height={96}
                    style={{ borderRadius: 8, background: "white", padding: 4 }}
                  />
                )}
              </div>
            </div>
          ))}

        {isLAN && (info?.urls ?? []).length === 0 && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>No network detected</span>
              <span className={styles.settingDesc}>
                Connect this computer to Wi-Fi to share Flyx with other devices.
              </span>
            </div>
          </div>
        )}

        {!desktop && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Managed by the server owner</span>
              <span className={styles.settingDesc}>
                Network mode is configured by the person running this Flyx server.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              fontSize: "0.8125rem",
              color: "rgba(244,80,80,0.9)",
              background: "rgba(244,80,80,0.08)",
              border: "1px solid rgba(244,80,80,0.15)",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
