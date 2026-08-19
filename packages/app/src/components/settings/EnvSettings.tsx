"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "@/app/settings/SettingsPage.module.css";

interface EnvVar {
  key: string;
  value: string;
  secret: boolean;
  locked: boolean;
}

interface FlyxDesktopBridge {
  isDesktop: boolean;
  onServerReady: (cb: () => void) => void;
}

function getBridge(): FlyxDesktopBridge | null {
  return (window as unknown as { flyxDesktop?: FlyxDesktopBridge }).flyxDesktop ?? null;
}

/** Wait until the server is healthy again (desktop restarts on .env change). */
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

const inputStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  fontSize: "0.8rem",
  fontFamily: "monospace",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  color: "white",
  minWidth: 0,
};

export default function EnvSettings() {
  const [rows, setRows] = useState<EnvVar[]>([]);
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [desktop, setDesktop] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const fetchEnv = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/env");
      const data = await res.json();
      if (res.ok && data.ok) {
        const env: EnvVar[] = data.env ?? [];
        setRows(env);
        const orig: Record<string, string> = {};
        for (const v of env) orig[v.key] = v.value;
        setOriginal(orig);
        setDesktop(true);
      } else {
        setError(data.error ?? "Failed to load environment variables");
        setDesktop(false);
      }
    } catch {
      setError("Network error");
      setDesktop(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnv();
  }, [fetchEnv]);

  function updateValue(key: string, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    const key = newKey.trim();
    if (!key) return;
    if (rows.some((r) => r.key === key)) {
      setError(`"${key}" already exists`);
      return;
    }
    setRows((prev) => [...prev, { key, value: newValue, secret: false, locked: false }]);
    setNewKey("");
    setNewValue("");
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const set: Record<string, string> = {};
      const remove: string[] = [];

      const nowKeys = new Set(rows.map((r) => r.key));
      for (const key of Object.keys(original)) {
        if (!nowKeys.has(key)) remove.push(key);
      }

      for (const row of rows) {
        if (row.locked) continue;
        const existed = Object.prototype.hasOwnProperty.call(original, row.key);
        if (existed) {
          if (row.secret) {
            // Masked field — only send when the user typed a new value.
            if (row.value.trim() !== "") set[row.key] = row.value;
          } else if (row.value !== original[row.key]) {
            set[row.key] = row.value;
          }
        } else {
          // Newly added row — send (skip blank to avoid empty vars).
          if (row.value.trim() !== "") set[row.key] = row.value;
        }
      }

      if (Object.keys(set).length === 0 && remove.length === 0) {
        setMessage("No changes to save");
        return;
      }

      const res = await fetch("/api/settings/env", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set, remove }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to save environment variables");
        return;
      }

      // The desktop main process restarts the server on .env change.
      setRestarting(true);
      await waitForServerReady();
      setRestarting(false);
      setMessage("Saved — server restarted with the new values");
      await fetchEnv();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div
          className={styles.cardIconWrapper}
          style={{ background: "linear-gradient(135deg, #8b7cf0, #6366f1)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 17V7l8 5 8-5v10" />
            <line x1="4" y1="7" x2="20" y2="7" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Environment Variables</h2>
          <p className={styles.cardSubtitle}>
            Update the TMDB API key and other server settings — changes restart the server
          </p>
        </div>
      </div>

      <div className={styles.settingsList}>
        {!desktop && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Managed by the server owner</span>
              <span className={styles.settingDesc}>
                Environment variables can only be edited on the desktop app.
              </span>
            </div>
          </div>
        )}

        {desktop && (
          <>
            {rows.map((row) => (
              <div key={row.key} className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    <code style={{ fontFamily: "monospace", color: "#a5b4fc" }}>{row.key}</code>
                    {row.locked ? " 🔒" : ""}
                  </span>
                  <span className={styles.settingDesc}>
                    {row.locked
                      ? "Managed by Flyx"
                      : row.secret
                        ? row.value.trim()
                          ? "Will be updated on save"
                          : "Set (enter a new value to change)"
                        : ""}
                  </span>
                </div>
                <input
                  type={row.secret ? "password" : "text"}
                  value={row.value}
                  disabled={row.locked}
                  placeholder={row.secret ? "••••••••" : "value"}
                  onChange={(e) => updateValue(row.key, e.target.value)}
                  style={{
                    ...inputStyle,
                    width: "min(260px, 40vw)",
                    opacity: row.locked ? 0.4 : 1,
                  }}
                />
                <button
                  className={styles.dangerBtn}
                  onClick={() => removeRow(row.key)}
                  disabled={row.locked}
                  title={row.locked ? "Managed by Flyx" : "Remove"}
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add variable */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={newKey}
                  placeholder="VAR_NAME"
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  style={{ ...inputStyle, width: 160 }}
                />
                <input
                  type="text"
                  value={newValue}
                  placeholder="value"
                  onChange={(e) => setNewValue(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <button className={styles.actionBtn} onClick={addRow} disabled={!newKey.trim()}>
                + Add
              </button>
            </div>

            {restarting && (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Restarting Flyx…</span>
                  <span className={styles.settingDesc}>
                    The server is picking up the new values. This takes a moment.
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

            {message && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  fontSize: "0.8125rem",
                  color: "rgba(0,229,191,0.9)",
                  background: "rgba(0,229,191,0.08)",
                  border: "1px solid rgba(0,229,191,0.15)",
                }}
              >
                {message}
              </div>
            )}

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Save changes</span>
                <span className={styles.settingDesc}>
                  Unchanged secret values are left as-is. Locked values cannot be edited.
                </span>
              </div>
              <button className={styles.actionBtn} onClick={handleSave} disabled={saving || restarting}>
                {saving ? "Saving…" : "Save & Restart"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
