"use client";

import { useState, type ReactNode } from "react";

const STEPS = ["welcome", "network", "accounts", "tmdb", "finish"] as const;
type Step = (typeof STEPS)[number];

interface SetupData {
  networkMode: "localhost" | "network";
  username: string;
  password: string;
  displayName: string;
  tmdbKey: string;
}

export default function SetupPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [data, setData] = useState<SetupData>({
    networkMode: "localhost",
    username: "",
    password: "",
    displayName: "",
    tmdbKey: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const idx = STEPS.indexOf(step);
  // "finish" is the post-save confirmation screen, NOT a step Continue can
  // advance into. The last *input* step ("tmdb") is where the save must
  // happen — if Continue can advance past it, the wizard shows "Setup
  // Complete!" without ever calling the save route, and "Launch Flyx"
  // bounces straight back to /setup (the exact "setup keeps resetting"
  // report). The save button therefore lives on the tmdb step.
  const isLastInput = idx === STEPS.length - 2;
  const isFirst = idx === 0;

  function update(fields: Partial<SetupData>) {
    setData((d) => ({ ...d, ...fields }));
    setError("");
  }

  function next() {
    // The username/password become the default account's credentials — a
    // setup saved without them can never auto-login and the wizard would
    // loop (the server rejects it too, but catch it before the POST).
    if (step === "accounts") {
      if (!data.username.trim()) {
        setError("Please choose a username");
        return;
      }
      if (data.password.length < 4) {
        setError("Password must be at least 4 characters");
        return;
      }
    }
    const i = STEPS.indexOf(step);
    // Never let Continue advance past the last input step — the save
    // button owns that transition (see isLastInput above).
    if (i < STEPS.length - 2) {
      // The desktop main process tees renderer console messages into
      // flyx-server.log — these lines make the wizard's progress visible
      // there, so a silent failure can never look like "setup resets".
      console.log(`[Setup UI] step: ${step} → ${STEPS[i + 1]}`);
      setStep(STEPS[i + 1]);
    }
  }
  function back() {
    const i = STEPS.indexOf(step);
    if (i > 0) {
      console.log(`[Setup UI] step: ${step} → ${STEPS[i - 1]}`);
      setStep(STEPS[i - 1]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    console.log(
      "[Setup UI] save clicked —",
      JSON.stringify({
        networkMode: data.networkMode,
        username: data.username,
        password: data.password ? "(set)" : "(empty)",
        displayName: data.displayName,
        tmdbKey: data.tmdbKey ? "(set)" : "(empty)",
      })
    );
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch("/api/setup/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        clearTimeout(timer);
        console.log(`[Setup UI] save response: HTTP ${res.status}`);
        const result = await res.json();
        if (result.ok) {
          console.log("[Setup UI] save ok — showing finish step");
          setStep("finish");
        } else {
          console.warn(`[Setup UI] save rejected: ${result.error}`);
          setError(result.error || "Failed to save settings");
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      console.error(`[Setup UI] save failed: ${(e as Error).message}`);
      // A hung request must be visible, never a stuck "Saving…" button.
      setError(
        (e as Error).name === "AbortError"
          ? "The server did not respond within 15 seconds."
          : (e as Error).message
      );
    } finally {
      setSaving(false);
    }
  }

  function handleLaunch() {
    console.log("[Setup UI] Launch Flyx clicked → /");
    window.location.href = "/";
  }

  const progressPct = Math.round(((idx + 1) / STEPS.length) * 100);

  return (
    <main style={styles.root}>
      <div style={styles.card}>
        {/* Progress bar */}
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progressPct}%`,
            }}
          />
        </div>
        <p style={styles.stepLabel}>
          Step {idx + 1} of {STEPS.length}
        </p>

        {/* Step content */}
        {step === "welcome" && <WelcomeStep onNext={next} />}
        {step === "network" && (
          <NetworkStep
            value={data.networkMode}
            onChange={(v) => update({ networkMode: v })}
          />
        )}
        {step === "accounts" && (
          <AccountsStep
            username={data.username}
            password={data.password}
            displayName={data.displayName}
            onChange={(u, p, d) => update({ username: u, password: p, displayName: d })}
          />
        )}
        {step === "tmdb" && (
          <TmdbStep
            value={data.tmdbKey}
            onChange={(v) => update({ tmdbKey: v })}
          />
        )}
        {step === "finish" && <FinishStep onLaunch={handleLaunch} />}

        {/* Error */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Nav buttons */}
        {step !== "finish" && (
          <div style={styles.nav}>
            {!isFirst && (
              <button onClick={back} style={styles.btnSecondary}>
                ← Back
              </button>
            )}
            <div style={{ flex: 1 }} />
            {!isLastInput ? (
              <button onClick={next} style={styles.btnPrimary}>
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !data.tmdbKey.trim()}
                style={{
                  ...styles.btnPrimary,
                  opacity: saving || !data.tmdbKey.trim() ? 0.5 : 1,
                }}
              >
                {saving ? "Saving..." : "Complete Setup"}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Step components ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div style={styles.stepBody}>
      <IconBox>🎬</IconBox>
      <h2 style={styles.title}>Welcome to Flyx</h2>
      <p style={styles.desc}>
        Your privacy-first streaming hub. Watch movies, TV, anime, and live
        sports — all from one app. No ads, no tracking.
      </p>
      <p style={styles.desc}>
        This wizard will help you get set up in just a few steps. You&apos;ll
        need a free TMDB API key (we&apos;ll show you where to get one).
      </p>
      <button onClick={onNext} style={{ ...styles.btnPrimary, width: "100%", marginTop: 12 }}>
        Let&apos;s Get Started →
      </button>
    </div>
  );
}

function NetworkStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: "localhost" | "network") => void;
}) {
  return (
    <div style={styles.stepBody}>
      <IconBox>🏠</IconBox>
      <h2 style={styles.title}>Where will you watch?</h2>
      <p style={styles.desc}>
        Choose how Flyx is accessed on your network.
      </p>
      <div style={styles.options}>
        <label
          style={{
            ...styles.option,
            ...(value === "localhost" ? styles.optionActive : {}),
          }}
        >
          <input
            type="radio"
            name="network"
            value="localhost"
            checked={value === "localhost"}
            onChange={() => onChange("localhost")}
            style={{ display: "none" }}
          />
          <span style={styles.optionTitle}>💻 Just this computer</span>
          <span style={styles.optionDesc}>
            Only accessible from this device. Most private option.
          </span>
        </label>
        <label
          style={{
            ...styles.option,
            ...(value === "network" ? styles.optionActive : {}),
          }}
        >
          <input
            type="radio"
            name="network"
            value="network"
            checked={value === "network"}
            onChange={() => onChange("network")}
            style={{ display: "none" }}
          />
          <span style={styles.optionTitle}>🏡 Whole home network</span>
          <span style={styles.optionDesc}>
            Access Flyx from any device on your Wi‑Fi — phones, tablets, smart
            TVs. Other people on your network can connect.
          </span>
        </label>
      </div>
    </div>
  );
}

function AccountsStep({
  username,
  password,
  displayName,
  onChange,
}: {
  username: string;
  password: string;
  displayName: string;
  onChange: (u: string, p: string, d: string) => void;
}) {
  return (
    <div style={styles.stepBody}>
      <IconBox>👤</IconBox>
      <h2 style={styles.title}>Create your account</h2>
      <p style={styles.desc}>
        Set up the main account. You can add more accounts later from Settings.
      </p>
      <Field label="Display name" hint="How you'll appear">
        <input
          type="text"
          value={displayName}
          onChange={(e) => onChange(username, password, e.target.value)}
          placeholder="e.g. Alex"
          style={styles.input}
        />
      </Field>
      <Field label="Username" hint="Used to sign in">
        <input
          type="text"
          value={username}
          onChange={(e) => onChange(e.target.value, password, displayName)}
          placeholder="e.g. alex"
          autoComplete="username"
          style={styles.input}
        />
      </Field>
      <Field label="Password" hint="At least 4 characters">
        <input
          type="password"
          value={password}
          onChange={(e) => onChange(username, e.target.value, displayName)}
          placeholder="Choose a password"
          autoComplete="new-password"
          style={styles.input}
        />
      </Field>
    </div>
  );
}

function TmdbStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={styles.stepBody}>
      <IconBox>🔑</IconBox>
      <h2 style={styles.title}>TMDB API Key</h2>
      <p style={styles.desc}>
        Flyx uses TMDB for movie and TV metadata. You need a free API key —
        it takes 30 seconds to get one.
      </p>
      <div style={styles.helpBox}>
        <p style={styles.helpTitle}>How to get a key:</p>
        <ol style={styles.helpList}>
          <li>
            Create a free account at{" "}
            <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer" style={styles.link}>
              themoviedb.org
            </a>
          </li>
          <li>
            Go to{" "}
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" style={styles.link}>
              Settings → API
            </a>
          </li>
          <li>Click &quot;Request an API key&quot; → choose Developer</li>
          <li>Fill out the form (use &quot;Personal project&quot; as type)</li>
          <li>Copy the API Key (not the Read Access Token)</li>
        </ol>
      </div>
      <Field label="Paste your key here">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste TMDB API key..."
          onKeyDown={(e) => e.key === "Enter" && value.trim() && onChange(value)}
          style={styles.input}
        />
      </Field>
    </div>
  );
}

function FinishStep({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div style={{ ...styles.stepBody, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <IconBox>✅</IconBox>
      <h2 style={styles.title}>Setup Complete!</h2>
      <p style={styles.desc}>
        Flyx is ready. Launch the app to start streaming movies, TV, anime, and
        live sports — all from one place.
      </p>
      <p style={{ ...styles.desc, fontSize: "0.75rem", color: "rgba(255,255,255,0.3)", marginTop: 8 }}>
        Tip: Close and reopen Flyx to get the full-size window.
      </p>
      <button onClick={onLaunch} style={{ ...styles.btnPrimary, width: "100%", marginTop: 20, padding: "12px 24px", fontSize: "0.95rem" }}>
        Launch Flyx →
      </button>
    </div>
  );
}

// ── Shared UI ────────────────────────────────────────────────────────────────

function IconBox({ children }: { children: ReactNode }) {
  return <div style={styles.iconBox}>{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={styles.fieldLabel}>
        {label}
        {hint && <span style={styles.fieldHint}> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #030307 0%, #0d0d1a 100%)",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "0.75rem",
    overflow: "hidden",
  },
  card: {
    maxWidth: 460,
    width: "100%",
    maxHeight: "calc(100vh - 1.5rem)",
    background: "linear-gradient(135deg, #0a0a16 0%, #111126 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: "1.5rem 1.25rem",
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    background: "rgba(255,255,255,0.08)",
    marginBottom: 6,
    overflow: "hidden",
    flexShrink: 0,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    background: "linear-gradient(90deg, #00e5bf, #8b7cf0)",
    transition: "width 0.4s ease",
  },
  stepLabel: {
    fontSize: "0.7rem",
    color: "rgba(255,255,255,0.25)",
    textAlign: "center" as const,
    marginBottom: 16,
    flexShrink: 0,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    margin: "0 auto 12px",
    boxShadow: "0 8px 24px rgba(0,229,191,0.25)",
    flexShrink: 0,
  },
  stepBody: {
    flex: 1,
    overflow: "auto",
    minHeight: 0,
  },
  title: {
    fontSize: "1.2rem",
    fontWeight: 700,
    margin: "0 0 6px",
    textAlign: "center" as const,
  },
  desc: {
    fontSize: "0.8rem",
    color: "rgba(255,255,255,0.45)",
    lineHeight: 1.5,
    textAlign: "center" as const,
    margin: "0 0 6px",
  },
  options: { display: "flex", flexDirection: "column", gap: 8, marginTop: 12 },
  option: {
    display: "flex",
    flexDirection: "column" as const,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  optionActive: {
    borderColor: "rgba(0,229,191,0.4)",
    background: "rgba(0,229,191,0.06)",
    boxShadow: "0 0 16px rgba(0,229,191,0.06)",
  },
  optionTitle: { fontSize: "0.85rem", fontWeight: 600 },
  optionDesc: {
    fontSize: "0.72rem",
    color: "rgba(255,255,255,0.35)",
    marginTop: 3,
  },
  helpBox: {
    background: "rgba(0,229,191,0.05)",
    border: "1px solid rgba(0,229,191,0.1)",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 12,
    marginTop: 8,
  },
  helpTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#00e5bf",
    margin: "0 0 6px",
  },
  helpList: {
    fontSize: "0.72rem",
    color: "rgba(255,255,255,0.5)",
    paddingLeft: 16,
    margin: 0,
    lineHeight: 1.6,
  },
  link: { color: "#00e5bf", textDecoration: "none" },
  fieldLabel: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  fieldHint: { fontWeight: 400, color: "rgba(255,255,255,0.25)" },
  input: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontSize: "0.85rem",
    outline: "none",
    boxSizing: "border-box" as const,
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  btnPrimary: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
    color: "#030307",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.85rem",
    whiteSpace: "nowrap" as const,
  },
  btnSecondary: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "rgba(255,255,255,0.55)",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.82rem",
    whiteSpace: "nowrap" as const,
  },
  error: {
    color: "#f45050",
    fontSize: "0.78rem",
    textAlign: "center" as const,
    marginTop: 10,
    flexShrink: 0,
  },
};
