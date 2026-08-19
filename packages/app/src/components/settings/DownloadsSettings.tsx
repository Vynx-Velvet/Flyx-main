"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/app/settings/SettingsPage.module.css";

export default function DownloadsSettings() {
  const [dir, setDir] = useState("");
  const [defaultDir, setDefaultDir] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings/downloads")
      .then((r) => r.json())
      .then((d) => {
        setDir(d.dir || "");
        setDefaultDir(d.defaultDir || "");
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir }),
      });
      const data = await res.json();
      if (res.ok && data.ok) setMessage("Saved");
      else setMessage(data.error ?? "Failed to save");
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div
          className={styles.cardIconWrapper}
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Downloads</h2>
          <p className={styles.cardSubtitle}>
            Save movies, episodes, and manga chapters to this device
          </p>
        </div>
      </div>

      <div className={styles.settingsList}>
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Download folder</span>
            <span className={styles.settingDesc}>
              Files are written here by the Flyx server. Leave blank for the default
              {defaultDir ? ` (${defaultDir})` : ""}.
            </span>
          </div>
          <input
            type="text"
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            placeholder={defaultDir || "Downloads folder"}
            style={{
              padding: "0.4rem 0.6rem",
              fontSize: "0.8rem",
              fontFamily: "monospace",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "white",
              width: "min(260px, 40vw)",
            }}
          />
          <button className={styles.actionBtn} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Manage downloads</span>
            <span className={styles.settingDesc}>
              View progress, cancel, and clear finished downloads.
            </span>
          </div>
          <Link href="/downloads" className={styles.actionBtn}>
            Open Downloads
          </Link>
        </div>

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
      </div>
    </div>
  );
}
