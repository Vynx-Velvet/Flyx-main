"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/";
  const { login } = useAuth();

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hostKey, setHostKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-landing", "1");
    return () => document.documentElement.removeAttribute("data-landing");
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      router.push(redirectTo);
      router.refresh();
    } else {
      setError(result.error ?? "Invalid credentials. Please try again.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!username.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!hostKey.trim()) {
      setError("Host key is required. Ask the person who runs Flyx for the key.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-host-key": hostKey.trim(),
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Account created! Switch to Sign In to log in.");
        setUsername("");
        setPassword("");
        setHostKey("");
        setMode("signin");
      } else {
        setError(data.error ?? "Registration failed.");
      }
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (focusColor: string): React.CSSProperties => ({
    width: "100%",
    padding: "0.625rem 0.875rem",
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    color: "white",
    fontSize: "0.875rem",
    outline: "none",
    transition: "border-color 0.2s",
    ...({ "--focus": focusColor } as any),
  });

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "#030307" }}
    >
      <div className="w-full" style={{ maxWidth: 460, animation: "slide-up 0.5s var(--ease-out) both" }}>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: 20,
            border: "1px solid rgba(255, 255, 255, 0.07)",
            overflow: "hidden",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              padding: "1.25rem 1.5rem",
              borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
            }}
          >
            <div
              style={{
                width: 44, height: 44, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
                boxShadow: "0 0 20px rgba(0,229,191,0.3)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#030307"><path d="M8 5.5v13l11-6.5L8 5.5z" /></svg>
            </div>
            <div>
              <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: "white", margin: "0 0 0.125rem 0" }}>
                Flyx
              </h1>
              <p style={{ fontSize: "0.8125rem", color: "rgba(255, 255, 255, 0.45)", margin: 0 }}>
                {mode === "signin" ? "Sign in to your account" : "Create a new account"}
              </p>
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => { setMode("signin"); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "0.75rem", border: "none", cursor: "pointer",
                background: mode === "signin" ? "rgba(0,229,191,0.06)" : "transparent",
                color: mode === "signin" ? "#00e5bf" : "rgba(255,255,255,0.35)",
                fontSize: "0.8125rem", fontWeight: 600, fontFamily: "inherit",
                borderBottom: mode === "signin" ? "2px solid #00e5bf" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "0.75rem", border: "none", cursor: "pointer",
                background: mode === "register" ? "rgba(139,124,240,0.06)" : "transparent",
                color: mode === "register" ? "#8b7cf0" : "rgba(255,255,255,0.35)",
                fontSize: "0.8125rem", fontWeight: 600, fontFamily: "inherit",
                borderBottom: mode === "register" ? "2px solid #8b7cf0" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              Create Account
            </button>
          </div>

          {/* Form body */}
          <div style={{ padding: "0.75rem" }}>
            {mode === "signin" ? (
              <form onSubmit={handleSignIn}>
                <Field label="Username">
                  <input id="username" type="text" autoComplete="username" autoFocus
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username" style={inputStyle("rgba(0,229,191,0.4)")} />
                </Field>
                <Field label="Password">
                  <div style={{ position: "relative" }}>
                    <input id="password" type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      style={{ ...inputStyle("rgba(139,124,240,0.4)"), paddingRight: "2.5rem" }} />
                    <ToggleShow show={showPassword} onClick={() => setShowPassword((v) => !v)} />
                  </div>
                </Field>
                <SubmitBtn loading={loading} label="Sign In" />
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <Field label="Pick a username">
                  <input id="reg-user" type="text" autoComplete="off" autoFocus
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Min 3 characters" style={inputStyle("rgba(0,229,191,0.4)")} />
                </Field>
                <Field label="Pick a password">
                  <div style={{ position: "relative" }}>
                    <input id="reg-pass" type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      style={{ ...inputStyle("rgba(139,124,240,0.4)"), paddingRight: "2.5rem" }} />
                    <ToggleShow show={showPassword} onClick={() => setShowPassword((v) => !v)} />
                  </div>
                </Field>
                <Field label="Host key">
                  <input id="reg-key" type="text" autoComplete="off"
                    value={hostKey} onChange={(e) => setHostKey(e.target.value)}
                    placeholder="Ask your Flyx host for this key"
                    style={inputStyle("rgba(245,158,11,0.4)")} />
                </Field>
                <SubmitBtn loading={loading} label="Create Account" accent="purple" />
              </form>
            )}

            {error && (
              <div style={{
                padding: "0.75rem 1rem", background: "rgba(244,80,80,0.08)",
                border: "1px solid rgba(244,80,80,0.15)", borderRadius: 10,
                fontSize: "0.8125rem", color: "rgba(244,80,80,0.85)", marginTop: "0.5rem",
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                padding: "0.75rem 1rem", background: "rgba(0,229,191,0.08)",
                border: "1px solid rgba(0,229,191,0.15)", borderRadius: 10,
                fontSize: "0.8125rem", color: "rgba(0,229,191,0.85)", marginTop: "0.5rem",
              }}>{success}</div>
            )}
          </div>
        </div>

        {/* Bottom text */}
        <p style={{
          textAlign: "center", marginTop: "1.25rem", fontSize: "0.8125rem",
          color: "rgba(255, 255, 255, 0.25)",
        }}>
          {mode === "signin"
            ? "New here? Switch to Create Account. You'll need the host key from the person who runs Flyx."
            : "Already have an account? Switch to Sign In."}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "0.75rem 1rem", background: "rgba(0, 0, 0, 0.2)",
      borderRadius: 12, marginBottom: "0.5rem",
    }}>
      <label style={{
        display: "block", fontSize: "0.8125rem", fontWeight: 500,
        color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem",
      }}>{label}</label>
      {children}
    </div>
  );
}

function ToggleShow({ show, onClick }: { show: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={show ? "Hide" : "Show"}
      style={{
        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
        background: "none", border: "none", cursor: "pointer",
        color: "rgba(255,255,255,0.3)", padding: 4,
      }}>
      {show ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  );
}

function SubmitBtn({ loading, label, accent }: { loading: boolean; label: string; accent?: string }) {
  const isPurple = accent === "purple";
  return (
    <button type="submit" disabled={loading} style={{
      display: "block", width: "100%", padding: "0.875rem 1.25rem",
      background: loading ? "rgba(255,255,255,0.05)"
        : isPurple ? "linear-gradient(135deg, #8b7cf0, #6d5fd9)"
        : "linear-gradient(135deg, #00e5bf, #00c4a0)",
      border: "none", borderRadius: 12,
      color: loading ? "rgba(255,255,255,0.3)" : "#030307",
      fontSize: "0.9375rem", fontWeight: 600, fontFamily: "inherit",
      cursor: loading ? "default" : "pointer",
      boxShadow: loading ? "none" : isPurple ? "0 0 24px rgba(139,124,240,0.2)" : "0 0 24px rgba(0,229,191,0.2)",
    }}>
      {loading ? "Please wait..." : label}
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
