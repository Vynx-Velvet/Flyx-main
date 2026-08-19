"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "@/app/settings/SettingsPage.module.css";

interface UpdateInfo {
  available: boolean;
  current: string;
  latest?: string;
  tag?: string;
  notes?: string;
  url?: string;
  asset?: string;
  dev?: boolean;
  error?: string | null;
}

interface UpdateStatus {
  phase: "downloading" | "installing" | "error" | "done";
  percent?: number;
  message?: string;
  asset?: string;
  path?: string;
}

interface FlyxDesktopBridge {
  isDesktop: boolean;
  getVersion: () => Promise<string>;
  checkUpdates: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<{ ok: boolean; message?: string }>;
  onUpdateStatus: (cb: (s: UpdateStatus) => void) => () => void;
}

function getBridge(): FlyxDesktopBridge | null {
  return (window as unknown as { flyxDesktop?: FlyxDesktopBridge }).flyxDesktop ?? null;
}

export default function UpdatesSettings() {
  const [version, setVersion] = useState("");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState("");

  const bridge = getBridge();

  useEffect(() => {
    if (!bridge) return;
    bridge.getVersion().then(setVersion).catch(() => {});
    const off = bridge.onUpdateStatus((s) => {
      setStatus(s);
      if (s.phase === "error" && s.message) setError(s.message);
    });
    return off;
  }, [bridge]);

  const handleCheck = useCallback(async () => {
    if (!bridge) return;
    setChecking(true);
    setError("");
    setInfo(null);
    setStatus(null);
    try {
      const result = await bridge.checkUpdates();
      setInfo(result);
      if (result.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to check for updates");
    } finally {
      setChecking(false);
    }
  }, [bridge]);

  const handleDownload = useCallback(async () => {
    if (!bridge) return;
    setError("");
    setStatus({ phase: "downloading", percent: 0 });
    try {
      const result = await bridge.downloadUpdate();
      if (!result.ok && result.message) setError(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }, [bridge]);

  const downloading =
    status?.phase === "downloading" || status?.phase === "installing";

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div
          className={styles.cardIconWrapper}
          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Updates</h2>
          <p className={styles.cardSubtitle}>
            Pull the latest Flyx build straight from GitHub — works for portable and installed versions
          </p>
        </div>
      </div>

      <div className={styles.settingsList}>
        {!bridge && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Desktop app required</span>
              <span className={styles.settingDesc}>
                Updates are managed from the Flyx desktop app. Web deployments pull updates by redeploying.
              </span>
            </div>
          </div>
        )}

        {bridge && (
          <>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Current version</span>
                <span className={styles.settingDesc}>Installed Flyx build</span>
              </div>
              <code
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  color: "#fbbf24",
                }}
              >
                {version ? `v${version}` : "…"}
              </code>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Check for updates</span>
                <span className={styles.settingDesc}>
                  Query the latest GitHub release for your platform
                </span>
              </div>
              <button className={styles.actionBtn} onClick={handleCheck} disabled={checking || downloading}>
                {checking ? "Checking…" : "Check now"}
              </button>
            </div>

            {info?.dev && (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Development build</span>
                  <span className={styles.settingDesc}>
                    Updates are only available in packaged builds.
                  </span>
                </div>
              </div>
            )}

            {info && !info.dev && (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    {info.available
                      ? `Flyx ${info.latest} is available`
                      : "You're up to date"}
                  </span>
                  <span className={styles.settingDesc}>
                    {info.available
                      ? `You have ${info.current}. New version: ${info.tag}`
                      : `Flyx ${info.current} is the latest release.`}
                  </span>
                </div>
                {info.available && (
                  <button className={styles.actionBtn} onClick={handleDownload} disabled={downloading}>
                    {downloading ? "Working…" : "Download & Install"}
                  </button>
                )}
              </div>
            )}

            {downloading && (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    {status?.phase === "downloading" ? "Downloading…" : "Installing…"}
                  </span>
                  <span className={styles.settingDesc}>
                    {status?.phase === "downloading" && status.percent !== undefined
                      ? `${status.percent}%`
                      : "Preparing to launch the new build"}
                  </span>
                </div>
                {status?.phase === "downloading" && status.percent !== undefined && (
                  <div
                    style={{
                      width: 120,
                      height: 6,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${status.percent}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #2ee6c5, #9b8cff)",
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {status?.phase === "done" && (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Update ready</span>
                  <span className={styles.settingDesc}>
                    {status.path ? `Downloaded to ${status.path}` : "Launching…"}
                  </span>
                </div>
              </div>
            )}

            {info?.available && info.notes && (
              <div className={styles.settingItem} style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Release notes</span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    color: "rgba(255,255,255,0.6)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 220,
                    overflow: "auto",
                    fontFamily: "inherit",
                  }}
                >
                  {info.notes.slice(0, 2000)}
                </pre>
                {info.url && (
                  <a
                    href={info.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#00e5bf", fontSize: "0.8rem", marginTop: "0.5rem" }}
                  >
                    View full release →
                  </a>
                )}
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
          </>
        )}
      </div>
    </div>
  );
}
