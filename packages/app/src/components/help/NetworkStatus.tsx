"use client";

import { useEffect, useState } from "react";
import styles from "./NetworkStatus.module.css";

interface NetworkInfo {
  url: string | null;
  ip?: string;
  port?: number;
  reason?: string;
}

export default function NetworkStatus() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchNetworkInfo() {
      try {
        const res = await fetch("/api/network");
        if (!res.ok) throw new Error("Failed to fetch");
        const data: NetworkInfo = await res.json();
        if (!cancelled) {
          setInfo(data);
          if (!data.url) setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    fetchNetworkInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy() {
    if (!info?.url) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select text manually for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = info.url;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* copy failed — user can type manually */
      }
      document.body.removeChild(textArea);
    }
  }

  // Loading state
  if (!info && !error) {
    return (
      <div className={styles.card}>
        <div className={styles.inner}>
          <div className={styles.iconWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Finding your network address…</h3>
            <p className={styles.subtitle}>
              Make sure you&apos;re connected to Wi‑Fi
            </p>
          </div>
        </div>
        <div className={styles.loadingBar}>
          <div className={styles.loadingFill} />
        </div>
      </div>
    );
  }

  // Error / no LAN IP found
  if (error || !info?.url) {
    return (
      <div className={`${styles.card} ${styles.cardWarning}`}>
        <div className={styles.inner}>
          <div className={`${styles.iconWrap} ${styles.iconWarning}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 className={styles.title}>Couldn&apos;t detect your network</h3>
            <p className={styles.subtitle}>
              Don&apos;t worry — here&apos;s how to find your address manually
            </p>
          </div>
        </div>
        <div className={styles.manualSteps}>
          <p>
            <strong>On Windows:</strong> Open the Start menu, type{" "}
            <code>cmd</code>, press Enter, type <code>ipconfig</code>, and look for
            &quot;IPv4 Address&quot;. It usually starts with{" "}
            <code>192.168.</code> or <code>10.0.</code>.
          </p>
          <p>
            Add <code>:3891</code> to the end. For example:{" "}
            <code>http://192.168.1.42:3891</code>
          </p>
        </div>
      </div>
    );
  }

  // Success — show the URL
  return (
    <div className={`${styles.card} ${styles.cardSuccess}`}>
      <div className={styles.inner}>
        <div className={styles.iconWrap}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div>
          <h3 className={styles.title}>Your Flyx address</h3>
          <p className={styles.subtitle}>
            Open this on any device connected to the same Wi‑Fi
          </p>
        </div>
      </div>

      <div className={styles.urlRow}>
        <div className={styles.urlPill}>
          <span className={styles.urlDot} />
          <code className={styles.urlText}>{info.url}</code>
        </div>
        <button
          type="button"
          className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
          onClick={handleCopy}
          aria-label={copied ? "Copied!" : "Copy address"}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <p className={styles.statusNote}>
        <span className={styles.statusDot} />
        Flyx is running and ready for connections
      </p>
    </div>
  );
}
