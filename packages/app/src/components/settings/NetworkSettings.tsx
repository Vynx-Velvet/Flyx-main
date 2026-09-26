"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import styles from "@/app/settings/SettingsPage.module.css";

interface NetworkAddress {
  url: string;
  address: string;
  interface: string;
  recommended: boolean;
}

interface NetworkInfo {
  url: string | null;
  ip?: string;
  port?: number;
  reason?: string;
  urls?: NetworkAddress[];
  desktop?: boolean;
  hostname?: string | null;
  computerName?: string | null;
}

interface FlyxDesktopBridge {
  isDesktop: boolean;
  onServerReady: (callback: () => void) => void;
}

function getBridge(): FlyxDesktopBridge | null {
  return (window as unknown as { flyxDesktop?: FlyxDesktopBridge }).flyxDesktop ?? null;
}

function waitForServerReady(timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(pollInterval);
      clearTimeout(timeout);
      resolve();
    };

    getBridge()?.onServerReady(finish);
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/health");
        if (response.ok) finish();
      } catch {
        return;
      }
    }, 1000);
    const timeout = setTimeout(finish, timeoutMs);
  });
}

export default function NetworkSettings() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const fetchInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/network", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not inspect this computer's network");
      setInfo(await response.json());
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not inspect this network");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInfo();
  }, [fetchInfo]);

  const addresses = useMemo(() => info?.urls ?? [], [info?.urls]);
  const primaryAddress = addresses.find((address) => address.recommended) ?? addresses[0];
  const networkSharing = info?.hostname === "0.0.0.0";
  const desktop = info?.desktop === true;

  useEffect(() => {
    if (!primaryAddress?.url) {
      setQrCode("");
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(primaryAddress.url, {
      width: 220,
      margin: 2,
      color: { dark: "#08090b", light: "#ffffff" },
    }).then((value) => {
      if (!cancelled) setQrCode(value);
    });
    return () => {
      cancelled = true;
    };
  }, [primaryAddress?.url]);

  async function changeMode(mode: "localhost" | "network") {
    setSwitching(true);
    setError("");
    try {
      const response = await fetch("/api/settings/network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Failed to change network sharing");
      }
      setRestarting(true);
      await waitForServerReady();
      await fetchInfo();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to change network sharing");
    } finally {
      setRestarting(false);
      setSwitching(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(null), 1800);
    } catch {
      setError("Clipboard access is unavailable. Select the address and copy it manually.");
    }
  }

  return (
    <section className={styles.connectionPanel}>
      <div className={styles.connectionHeader}>
        <div>
          <span className={styles.connectionEyebrow}>Connect another device</span>
          <h2>Open Flyx anywhere on your home network</h2>
          <p>Use the address below on a phone, tablet, smart TV, or another computer.</p>
        </div>
        <div className={`${styles.networkStatus} ${networkSharing ? styles.networkOnline : ""}`}>
          <span />
          {restarting ? "Restarting server" : networkSharing ? "Network sharing on" : "Local only"}
        </div>
      </div>

      {loading ? (
        <div className={styles.connectionLoading}>
          Finding this computer&apos;s network address…
        </div>
      ) : primaryAddress ? (
        <div className={styles.connectionHero}>
          <div className={styles.connectionAddressArea}>
            <div className={styles.computerIdentity}>
              <span>This computer</span>
              <strong>{info?.computerName || "Flyx host"}</strong>
              <small>{primaryAddress.interface || "Local network"}</small>
            </div>

            <div className={styles.ipBlock}>
              <span>PC network IP</span>
              <button
                type="button"
                onClick={() => copy(primaryAddress.address)}
                title="Copy IP address"
              >
                {primaryAddress.address}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <small>
                {copiedValue === primaryAddress.address ? "IP copied" : "Tap to copy only the IP"}
              </small>
            </div>

            <div className={styles.urlBlock}>
              <span>Type this full address on the other device</span>
              <code>{primaryAddress.url}</code>
              <button type="button" onClick={() => copy(primaryAddress.url)}>
                {copiedValue === primaryAddress.url ? "Copied" : "Copy full address"}
              </button>
            </div>
          </div>

          <div className={styles.qrArea}>
            {qrCode ? (
              <img src={qrCode} alt={`QR code that opens ${primaryAddress.url}`} />
            ) : (
              <div />
            )}
            <strong>Scan to open Flyx</strong>
            <span>Use the camera on your phone or tablet</span>
          </div>
        </div>
      ) : (
        <div className={styles.connectionEmpty}>
          <strong>No usable network address found</strong>
          <span>Connect this computer to Wi‑Fi or Ethernet, then refresh.</span>
        </div>
      )}

      <div className={styles.connectionSteps}>
        <div>
          <span>1</span>
          <p>
            <strong>Keep Flyx open</strong>The desktop app hosts your private server.
          </p>
        </div>
        <div>
          <span>2</span>
          <p>
            <strong>Use the same Wi‑Fi</strong>Guest networks usually block device-to-device access.
          </p>
        </div>
        <div>
          <span>3</span>
          <p>
            <strong>Open the address</strong>Type the full URL in the other device&apos;s browser.
          </p>
        </div>
      </div>

      <div className={styles.connectionControls}>
        <div>
          <strong>Allow other devices to connect</strong>
          <span>
            {desktop
              ? "Flyx will restart its server when this changes."
              : "This can only be changed from the desktop host."}
          </span>
        </div>
        {desktop ? (
          <button
            type="button"
            className={`${styles.largeToggle} ${networkSharing ? styles.largeToggleOn : ""}`}
            onClick={() => void changeMode(networkSharing ? "localhost" : "network")}
            disabled={switching || restarting}
            aria-pressed={networkSharing}
          >
            <span />
            {networkSharing ? "Sharing on" : "Turn sharing on"}
          </button>
        ) : (
          <span className={styles.hostOnlyBadge}>Desktop host only</span>
        )}
      </div>

      {addresses.length > 1 && (
        <details className={styles.otherAddresses}>
          <summary>
            Show {addresses.length - 1} other detected address{addresses.length > 2 ? "es" : ""}
          </summary>
          <div>
            {addresses.slice(1).map((address) => (
              <button type="button" key={address.url} onClick={() => copy(address.url)}>
                <span>{address.interface}</span>
                <code>{address.url}</code>
                <small>{copiedValue === address.url ? "Copied" : "Copy"}</small>
              </button>
            ))}
          </div>
        </details>
      )}

      <div className={styles.connectionFooter}>
        <p>
          Windows Firewall may ask for permission the first time. Choose{" "}
          <strong>Private networks</strong>.
        </p>
        <button type="button" onClick={() => void fetchInfo()} disabled={loading || restarting}>
          Refresh addresses
        </button>
      </div>

      {error && <div className={styles.connectionError}>{error}</div>}
    </section>
  );
}
