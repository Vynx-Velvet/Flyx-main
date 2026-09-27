"use client";

/**
 * Settings → Security → "Remote access addresses" (admins only).
 *
 * Extra names other devices use to reach this Flyx server (Tailscale,
 * DuckDNS, a reverse-proxy domain…). Anything else that isn't an IP,
 * localhost, a .local name or a bare computer name is refused by the Host
 * check in middleware.ts. Backed by /api/settings/allowed-hosts.
 */

import { useCallback, useEffect, useState } from "react";
import styles from "@/app/settings/SettingsPage.module.css";
import { isAllowedHost, normalizeHostEntry } from "@/lib/request-origin";
import { waitForServerReady } from "@/lib/utils/wait-for-server";

interface HostsState {
  available: boolean;
  hosts: string[];
  active: string[];
  autoRestart: boolean;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((h) => b.includes(h));

const noticeBase: React.CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: "0.75rem",
  fontSize: "0.8125rem",
};
const errorStyle: React.CSSProperties = {
  ...noticeBase,
  color: "rgba(244,80,80,0.9)",
  background: "rgba(244,80,80,0.08)",
  border: "1px solid rgba(244,80,80,0.15)",
};
const okStyle: React.CSSProperties = {
  ...noticeBase,
  color: "rgba(0,229,191,0.9)",
  background: "rgba(0,229,191,0.08)",
  border: "1px solid rgba(0,229,191,0.15)",
};
const warnStyle: React.CSSProperties = {
  ...noticeBase,
  color: "rgba(250,204,21,0.95)",
  background: "rgba(250,204,21,0.08)",
  border: "1px solid rgba(250,204,21,0.18)",
};

export default function RemoteAccessSettings() {
  const [state, setState] = useState<HostsState | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/allowed-hosts", { cache: "no-store" });
      if (res.status === 403) return; // not an admin — the card stays hidden
      const data = await res.json();
      if (res.ok && data.ok) {
        setState(data);
        setHosts(data.hosts);
      } else {
        setError(data.error ?? "Couldn't load remote access addresses");
      }
    } catch {
      setError("Network error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function addDraft() {
    setError("");
    setMessage("");
    const added: string[] = [];
    for (const entry of draft.split(/[\s,]+/).filter(Boolean)) {
      const host = normalizeHostEntry(entry);
      if (!host || host === "*") {
        setError(`"${entry}" is not a valid address`);
        return;
      }
      if (isAllowedHost(host)) {
        setMessage(`${host} already works without being added here.`);
        continue;
      }
      if (!hosts.includes(host) && !added.includes(host)) added.push(host);
    }
    setHosts((prev) => [...prev, ...added]);
    setDraft("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/settings/allowed-hosts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hosts }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Couldn't save");
        return;
      }
      if (data.autoRestart) {
        setMessage("Saved. Flyx is restarting to apply it…");
        await waitForServerReady();
        setMessage("Saved and applied.");
      } else {
        setMessage("Saved. Restart Flyx to apply it.");
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!state) {
    return error ? <div style={errorStyle}>{error}</div> : null;
  }

  const dirty = !sameList(hosts, state.hosts);
  const pendingRestart = !sameList(state.hosts, state.active);

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIconWrapper}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Remote access addresses</h2>
          <p className={styles.cardSubtitle}>
            Names other devices may use to reach Flyx, like a Tailscale name or your own domain
          </p>
        </div>
      </div>

      <div className={styles.settingsList}>
        {!state.available ? (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Not available on this server</span>
              <span className={styles.settingDesc}>
                Set FLYX_ALLOWED_HOSTS in the server&apos;s environment instead.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Always allowed</span>
                <span className={styles.settingDesc}>
                  IP addresses, localhost, .local names and plain computer names work without being
                  listed. Add anything else people type to reach Flyx; other addresses are blocked
                  to protect against malicious websites.
                </span>
              </div>
            </div>

            {hosts.length === 0 && (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingDesc}>No extra addresses yet.</span>
                </div>
              </div>
            )}

            {hosts.map((host) => (
              <div key={host} className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    <code>{host}</code>
                  </span>
                </div>
                <button
                  className={styles.dangerBtn}
                  onClick={() => setHosts((prev) => prev.filter((h) => h !== host))}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            ))}

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Add an address</span>
                <span className={styles.settingDesc}>
                  Paste it however you have it — https://mypc.tail1234.ts.net:3891/ works.
                </span>
              </div>
              <input
                type="text"
                className={styles.textInput}
                value={draft}
                placeholder="mypc.tail1234.ts.net"
                spellCheck={false}
                autoCapitalize="none"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addDraft();
                }}
              />
              <button className={styles.actionBtn} onClick={addDraft} disabled={!draft.trim()}>
                Add
              </button>
            </div>

            {pendingRestart && !dirty && !saving && !state.autoRestart && (
              <div style={warnStyle}>
                Saved, but this server is still using the previous list until Flyx restarts (
                <code>flyx stop</code> then <code>flyx start</code>, or restart the container). If
                it still shows after a restart, FLYX_ALLOWED_HOSTS is set in the server&apos;s own
                environment (for example docker-compose), which takes priority.
              </div>
            )}
            {error && <div style={errorStyle}>{error}</div>}
            {message && <div style={okStyle}>{message}</div>}

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Save changes</span>
                <span className={styles.settingDesc}>
                  {state.autoRestart
                    ? "Flyx restarts for a moment to apply them."
                    : "Takes effect after Flyx restarts."}
                </span>
              </div>
              <button className={styles.actionBtn} onClick={save} disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
