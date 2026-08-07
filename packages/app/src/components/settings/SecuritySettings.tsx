"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import styles from "@/app/settings/SettingsPage.module.css";

interface Account {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function SecuritySettings() {
  const { user, refresh: refreshAuth } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [hostKeyCopied, setHostKeyCopied] = useState(false);
  const [landingEnabled, setLandingEnabled] = useState(true);
  const [savingLanding, setSavingLanding] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.host_key) setHostKey(data.settings.host_key);
        const landing = data.settings?.landing_page;
        setLandingEnabled(landing !== "false");
      })
      .catch(() => {});
  }, [fetchAccounts]);

  const handleCreate = async () => {
    if (!newUser || !newPass || !hostKey) return;
    if (newUser.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }
    if (newPass.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-host-key": hostKey,
        },
        body: JSON.stringify({ username: newUser, password: newPass }),
      });

      if (res.ok) {
        setNewUser("");
        setNewPass("");
        setHostKey("");
        setShowCreate(false);
        setMessage("Account created!");
        fetchAccounts();
      } else {
        const data = await res.json();
        setMessage(data.error ?? "Failed to create account");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setCreating(false);
    }
  };

  // ── Password change ──────────────────────────────────────
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Reset password for another user (admin)
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetNewPw, setResetNewPw] = useState("");

  const handleChangeOwnPassword = async () => {
    if (!newPw) {
      setMessage("Please enter a new password.");
      return;
    }
    if (newPw.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }
    // Non-admin must provide current password
    if (!user?.isAdmin && !currentPw) {
      setMessage("Current password is required.");
      return;
    }
    setChangingPw(true);
    setMessage("");
    try {
      const body: Record<string, string> = { newPassword: newPw };
      if (!user?.isAdmin) body.currentPassword = currentPw;
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Password changed!");
        setCurrentPw("");
        setNewPw("");
        setShowChangePw(false);
      } else {
        setMessage(data.error ?? "Failed to change password");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setChangingPw(false);
    }
  };

  const handleResetUserPassword = async (userId: string) => {
    if (!resetNewPw || resetNewPw.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }
    setChangingPw(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword: resetNewPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Password reset successfully.");
        setResetUserId(null);
        setResetNewPw("");
      } else {
        setMessage(data.error ?? "Failed to reset password");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setChangingPw(false);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete account "${account.username}"? This cannot be undone.`)) return;

    try {
      const res = await fetch("/api/auth/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id }),
      });

      if (res.ok) {
        setMessage(`Account "${account.username}" deleted.`);
        fetchAccounts();
        // If we deleted our own account somehow, refresh auth
        if (account.id === user?.id) refreshAuth();
      } else {
        const data = await res.json();
        setMessage(data.error ?? "Failed to delete account");
      }
    } catch {
      setMessage("Network error");
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div
          className={styles.cardIconWrapper}
          style={{ background: "linear-gradient(135deg, #f45050, #dc2626)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Accounts &amp; Security</h2>
          <p className={styles.cardSubtitle}>
            Manage who has access to your Flyx instance
          </p>
        </div>
      </div>

      <div className={styles.settingsList}>
        {/* Current account */}
        {user && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Signed in as</span>
              <span className={styles.settingDesc}>
                <strong>{user.username}</strong>
                {user.isAdmin ? " (admin)" : ""} — {accounts.length} total account{accounts.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Host key — for creating accounts from other devices */}
        {user?.isAdmin && hostKey && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Host Key</span>
              <span className={styles.settingDesc}>
                Share this with people you trust so they can create an account.
                They&apos;ll need it on the <strong>Create Account</strong> tab of the login page.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <code style={{
                fontSize: "0.7rem", fontFamily: "monospace", color: "#f59e0b",
                background: "rgba(245,158,11,0.08)", padding: "0.25rem 0.5rem",
                borderRadius: 6, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                userSelect: "all",
              }}>
                {hostKey}
              </code>
              <button
                className={styles.actionBtn}
                onClick={() => {
                  navigator.clipboard.writeText(hostKey).then(() => {
                    setHostKeyCopied(true);
                    setTimeout(() => setHostKeyCopied(false), 2000);
                  });
                }}
                style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}
              >
                {hostKeyCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Account list + Create button (admin only) */}
        {user?.isAdmin && (
          <>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>All Accounts</span>
                <span className={styles.settingDesc}>
                  {accounts.length === 0
                    ? "No accounts yet."
                    : `${accounts.length} account${accounts.length !== 1 ? "s" : ""} on this instance`}
                </span>
              </div>
            </div>

            {accounts.map((a) => (
              <div key={a.id} className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>
                    {a.username}
                    {a.isAdmin ? " ⭐" : ""}
                  </span>
                  <span className={styles.settingDesc}>
                    Created {new Date(a.createdAt).toLocaleDateString()}
                    {a.isAdmin ? " · Admin" : ""}
                  </span>
                </div>
                {a.id !== user.id && (
                  <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                    {resetUserId === a.id ? (
                      <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="New password"
                          value={resetNewPw}
                          onChange={(e) => setResetNewPw(e.target.value)}
                          style={{
                            width: 130, padding: "0.3rem 0.5rem", fontSize: "0.7rem",
                            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 6, color: "white",
                          }}
                        />
                        <button
                          className={styles.actionBtn}
                          onClick={() => handleResetUserPassword(a.id)}
                          disabled={changingPw}
                          style={{ fontSize: "0.675rem", padding: "0.3rem 0.5rem" }}
                        >
                          Save
                        </button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => { setResetUserId(null); setResetNewPw(""); }}
                          style={{ fontSize: "0.675rem", padding: "0.3rem 0.5rem" }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className={styles.actionBtn}
                          onClick={() => { setResetUserId(a.id); setResetNewPw(""); }}
                          title="Reset password"
                          style={{ fontSize: "0.675rem", padding: "0.3rem 0.5rem" }}
                        >
                          Reset PW
                        </button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() => handleDelete(a)}
                          title="Delete account"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Create new account */}
            {!showCreate ? (
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <span className={styles.settingLabel}>Create Account</span>
                  <span className={styles.settingDesc}>
                    Add a new user for family or friends
                  </span>
                </div>
                <button
                  className={styles.actionBtn}
                  onClick={() => setShowCreate(true)}
                >
                  + New
                </button>
              </div>
            ) : (
              <div style={{ padding: "0.5rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Username (min 3 chars)"
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  className={styles.select}
                  style={{ width: "100%", padding: "0.5rem 0.75rem" }}
                />
                <input
                  type="text"
                  placeholder="Password (min 8 chars)"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  className={styles.select}
                  style={{ width: "100%", padding: "0.5rem 0.75rem" }}
                />
                <input
                  type="text"
                  placeholder="Host key (from your .env file)"
                  value={hostKey}
                  onChange={(e) => setHostKey(e.target.value)}
                  className={styles.select}
                  style={{ width: "100%", padding: "0.5rem 0.75rem" }}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className={styles.actionBtn}
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => setShowCreate(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Landing Page Toggle */}
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Landing Page (Require Login)</span>
            <span className={styles.settingDesc}>
              When enabled, visitors see a welcome page and must sign in.
              When disabled, browsing is public but personal features require login.
            </span>
          </div>
          <button
            className={`${styles.toggle} ${landingEnabled ? styles.on : ""}`}
            onClick={async () => {
              if (!user?.isAdmin) return;
              setSavingLanding(true);
              const newVal = String(!landingEnabled);
              await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: "landing_page", value: newVal }),
              });
              setLandingEnabled(!landingEnabled);
              setSavingLanding(false);
            }}
            disabled={savingLanding || !user?.isAdmin}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        {/* Change own password */}
        {user && (
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <span className={styles.settingLabel}>Your Password</span>
              <span className={styles.settingDesc}>
                {user?.isAdmin
                  ? "Set a password to sign in from your phone, TV, or tablet. No old password needed."
                  : "Change the password you use to sign in."}
              </span>
            </div>
            <button
              className={styles.actionBtn}
              onClick={() => setShowChangePw(!showChangePw)}
            >
              {showChangePw ? "Cancel" : "Change"}
            </button>
          </div>
        )}

        {showChangePw && (
          <div style={{ padding: "0.5rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {!user?.isAdmin && (
              <input
                type="password"
                placeholder="Current password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className={styles.select}
                style={{ width: "100%", padding: "0.5rem 0.75rem" }}
              />
            )}
            <input
              type="text"
              placeholder="New password (min 8 chars)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={styles.select}
              style={{ width: "100%", padding: "0.5rem 0.75rem" }}
            />
            <button
              className={styles.actionBtn}
              onClick={handleChangeOwnPassword}
              disabled={changingPw}
            >
              {changingPw ? "Saving..." : "Save New Password"}
            </button>
          </div>
        )}

        {/* Mode switching */}
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Mode</span>
            <span className={styles.settingDesc}>
              {accounts.length <= 1
                ? "Single-user mode. To add family/friends: create accounts above, then share the sign-in URL with them."
                : "Multi-user mode. New users sign in from the sign-in page on any device."}
            </span>
          </div>
        </div>

        {message && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              fontSize: "0.8125rem",
              color: message.includes("Failed") || message.includes("error")
                ? "rgba(244,80,80,0.9)"
                : "rgba(0,229,191,0.9)",
              background: message.includes("Failed") || message.includes("error")
                ? "rgba(244,80,80,0.08)"
                : "rgba(0,229,191,0.08)",
              border: `1px solid ${
                message.includes("Failed") || message.includes("error")
                  ? "rgba(244,80,80,0.15)"
                  : "rgba(0,229,191,0.15)"
              }`,
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
