"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";

type Flow = "signIn" | "signUp" | "signUp-verify";

// ── Password-strength helpers ──────────────────────────────────────────────
interface PwCheck { label: string; met: boolean }

function usePasswordChecks(password: string, t: any): PwCheck[] {
  return useMemo(() => [
    { label: t.pwMin8,       met: password.length >= 8 },
    { label: t.pwUppercase,  met: /[A-Z]/.test(password) },
    { label: t.pwLowercase,  met: /[a-z]/.test(password) },
    { label: t.pwNumber,     met: /[0-9]/.test(password) },
  ], [password, t]);
}

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const { t } = useLocale();

  const [flow,     setFlow]     = useState<Flow>("signIn");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [otpCode,  setOtpCode]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const checks  = usePasswordChecks(password, t);
  const allMet  = checks.every((c) => c.met);

  // Once authenticated, go to dashboard
  useEffect(() => {
    if (isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  // ── Sign-up: create account → backend sends OTP email ──────────────────
  const handleSignUp = async () => {
    if (!allMet) { setError(t.pwRequirements); return; }
    setLoading(true);
    setError("");
    try {
      await signIn("password", { email: email.trim(), password, flow: "signUp" });
      // If email verification is enabled, Convex Auth returns without
      // authenticating — user needs to enter the OTP code.
      // If Resend key is not configured, the user is authenticated directly.
      if (!isAuthenticated) {
        setFlow("signUp-verify");
      }
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("exists")) {
        setError(t.accountExists);
      } else if (msg.toLowerCase().includes("password")) {
        setError(msg);
      } else {
        setError(msg || t.genericError);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP verification step ──────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      await signIn("password", {
        email: email.trim(),
        code: otpCode.trim(),
        flow: "email-verification",
      });
    } catch (err: any) {
      setError(err?.message || t.invalidOtp);
    } finally {
      setLoading(false);
    }
  };

  // ── Sign-in: existing account ─────────────────────────────────────────
  const handleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signIn("password", { email: email.trim(), password, flow: "signIn" });
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("invalid")) {
        setError(t.invalidCredentials);
      } else {
        setError(msg || t.genericError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (flow === "signUp-verify") return handleVerifyOtp();
    if (flow === "signUp") return handleSignUp();
    return handleSignIn();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  // ── OTP verification screen ────────────────────────────────────────────
  if (flow === "signUp-verify") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 400, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 20, padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✉</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.verifyEmailTitle}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
              {t.verifyEmailHint.replace("{email}", email)}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.otpLabel}</label>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder={t.otpPlaceholder} required autoFocus style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em", fontSize: 20 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
              />
            </div>

            {error && <p style={{ fontSize: 12.5, color: "var(--status-danger)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading || !otpCode.trim()}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, background: loading || !otpCode.trim() ? "var(--accent-muted)" : "var(--accent)", color: "#fff", border: "none", cursor: loading || !otpCode.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {loading ? t.verifying : t.verifyEmail}
            </button>
          </form>

          <button type="button" onClick={() => { setFlow("signUp"); setError(""); setOtpCode(""); }}
            style={{ width: "100%", marginTop: 12, padding: "9px 0", fontSize: 13, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  // ── Main login / sign-up screen ────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 20, padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>⌘</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.appName}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            {flow === "signIn" ? t.signInTitle : t.setupTitle}
          </p>
        </div>

        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border2)", marginBottom: 24 }}>
          {(["signIn", "signUp"] as Flow[]).map((f) => (
            <button key={f} type="button" onClick={() => { setFlow(f); setError(""); }}
              style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: flow === f ? "var(--accent)" : "var(--surface2)", color: flow === f ? "#fff" : "var(--text-muted)", transition: "background 0.15s" }}>
              {f === "signIn" ? t.signIn : t.firstTimeSetup}
            </button>
          ))}
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.emailLabel}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} required autoFocus style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.passwordLabel}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={flow === "signIn" ? t.passwordPlaceholder : t.choosePassword} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
            />
          </div>

          {/* ── Password-strength checklist (sign-up only) ─────────────── */}
          {flow === "signUp" && password.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--border2)" }}>
              {checks.map((c) => (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ color: c.met ? "var(--status-success, #22c55e)" : "var(--text-dim)", fontSize: 14 }}>
                    {c.met ? "✓" : "○"}
                  </span>
                  <span style={{ color: c.met ? "var(--text-muted)" : "var(--text-dim)" }}>{c.label}</span>
                </div>
              ))}
            </div>
          )}

          {flow === "signUp" && (
            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0, background: "var(--accent-subtle)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "8px 12px" }}>
              {t.firstTimeHint}
            </p>
          )}

          {error && <p style={{ fontSize: 12.5, color: "var(--status-danger)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading || !email.trim() || !password || (flow === "signUp" && !allMet)}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, background: loading || !email.trim() || !password || (flow === "signUp" && !allMet) ? "var(--accent-muted)" : "var(--accent)", color: "#fff", border: "none", cursor: loading || !email.trim() || !password || (flow === "signUp" && !allMet) ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {loading ? (flow === "signIn" ? t.signingIn : t.settingUp) : (flow === "signIn" ? t.signIn : t.createPassword)}
          </button>
        </form>
      </div>
    </div>
  );
}
