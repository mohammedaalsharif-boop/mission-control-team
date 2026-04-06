"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { useLocale } from "@/components/LocaleProvider";

export default function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const { t } = useLocale();

  const token = searchParams.get("token") ?? "";
  const invite = useQuery(api.inviteActions.getInviteByToken, token ? { token } : "skip");
  const acceptInvite = useMutation(api.inviteActions.acceptInvite);

  const [flow,     setFlow]     = useState<"signIn" | "signUp">("signUp");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [accepted, setAccepted] = useState(false);

  // Pre-fill email from invite
  useEffect(() => {
    if (invite?.email) setEmail(invite.email);
  }, [invite?.email]);

  // Once authenticated, try to accept the invite
  useEffect(() => {
    if (!isAuthenticated || !token || accepted) return;

    (async () => {
      try {
        setLoading(true);
        const result = await acceptInvite({ token });
        setAccepted(true);
        // Store the org so AuthProvider picks it up
        if (result?.orgId) {
          localStorage.setItem("mc_current_org", result.orgId);
        }
        // Short delay then redirect to dashboard
        setTimeout(() => router.replace("/"), 1500);
      } catch (err: any) {
        setError(err?.message || t.genericError);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, token, accepted, acceptInvite, router, t]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      await signIn("password", { email: email.trim(), password, flow });
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (flow === "signIn" && msg.toLowerCase().includes("invalid")) {
        setError(t.invalidCredentials);
      } else if (flow === "signUp" && msg.toLowerCase().includes("exists")) {
        setError(t.accountExists);
        setFlow("signIn");
      } else {
        setError(msg || t.genericError);
      }
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  // ── Loading states ─────────────────────────────────────────────────────
  if (!token) {
    return (
      <CenterCard>
        <h2 style={{ color: "var(--status-danger)", margin: "0 0 8px" }}>{t.inviteInvalidTitle}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.inviteNoToken}</p>
      </CenterCard>
    );
  }

  if (invite === undefined) {
    return <CenterCard><p style={{ color: "var(--text-muted)" }}>{t.loading}...</p></CenterCard>;
  }

  if (invite === null) {
    return (
      <CenterCard>
        <h2 style={{ color: "var(--status-danger)", margin: "0 0 8px" }}>{t.inviteInvalidTitle}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.inviteNotFound}</p>
      </CenterCard>
    );
  }

  if (invite.expired || invite.status !== "pending") {
    return (
      <CenterCard>
        <h2 style={{ color: "var(--status-danger)", margin: "0 0 8px" }}>{t.inviteExpiredTitle}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.inviteExpiredHint}</p>
      </CenterCard>
    );
  }

  // ── Accepted ───────────────────────────────────────────────────────────
  if (accepted) {
    return (
      <CenterCard>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h2 style={{ color: "var(--text)", margin: "0 0 8px" }}>{t.inviteAccepted}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t.inviteRedirecting}</p>
      </CenterCard>
    );
  }

  // ── If already authenticated → auto-accepting (shown via the useEffect) ──
  if (isAuthenticated && !error) {
    return (
      <CenterCard>
        <p style={{ color: "var(--text-muted)" }}>{t.inviteAccepting}</p>
      </CenterCard>
    );
  }

  // ── Sign-in / Sign-up form for the invited user ────────────────────────
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 20, padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✉</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.inviteTitle}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            {t.inviteSubtitle.replace("{org}", invite.orgName)}
          </p>
        </div>

        <div style={{ background: "var(--accent-subtle)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--text-dim)" }}>
          <div><strong>{t.inviteName}:</strong> {invite.name}</div>
          <div><strong>{t.inviteRole}:</strong> {invite.role}</div>
        </div>

        <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border2)", marginBottom: 20 }}>
          {(["signUp", "signIn"] as const).map((f) => (
            <button key={f} type="button" onClick={() => { setFlow(f); setError(""); }}
              style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: flow === f ? "var(--accent)" : "var(--surface2)", color: flow === f ? "#fff" : "var(--text-muted)", transition: "background 0.15s" }}>
              {f === "signUp" ? t.firstTimeSetup : t.signIn}
            </button>
          ))}
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.emailLabel}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.emailPlaceholder} required style={inputStyle}
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

          {error && <p style={{ fontSize: 12.5, color: "var(--status-danger)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading || !email.trim() || !password}
            style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, background: loading || !email.trim() || !password ? "var(--accent-muted)" : "var(--accent)", color: "#fff", border: "none", cursor: loading || !email.trim() || !password ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {loading ? t.loading : (flow === "signUp" ? t.inviteCreateAndJoin : t.inviteSignInAndJoin)}
          </button>
        </form>
      </div>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 20, padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)", textAlign: "center" }}>
        {children}
      </div>
    </div>
  );
}
