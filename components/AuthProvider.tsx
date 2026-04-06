"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { CurrentUser, OrgInfo } from "@/lib/task-types";
import { Building2, Plus, ChevronRight } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import WeeklyReflectionPopup from "@/components/WeeklyReflectionPopup";

interface AuthContextType {
  user: CurrentUser | null;
  orgId: Id<"organizations"> | null;
  orgs: OrgInfo[];
  switchOrg: (orgId: string) => void;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
  isLoading: boolean;
  needsOrgSelection: boolean;
}

const ORG_STORAGE_KEY = "mc_current_org";

const AuthContext = createContext<AuthContextType>({
  user: null,
  orgId: null,
  orgs: [],
  switchOrg: () => {},
  logout: () => {},
  isAdmin: false,
  isManager: false,
  isLoading: true,
  needsOrgSelection: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading: convexLoading, isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router   = useRouter();
  const pathname = usePathname();

  // ── Queries ──────────────────────────────────────────────────────────────
  const email = useQuery(api.users.currentEmail);

  const orgsRaw = useQuery(
    api.organizations.listForUser,
    email ? { email } : "skip"
  );
  const orgs = orgsRaw ?? [];

  // ── Selected org ─────────────────────────────────────────────────────────
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ORG_STORAGE_KEY);
    }
    return null;
  });

  useEffect(() => {
    if (orgs.length === 1 && !selectedOrgId && orgs[0]) {
      setSelectedOrgId(orgs[0].orgId);
      localStorage.setItem(ORG_STORAGE_KEY, orgs[0].orgId);
    }
    if (selectedOrgId && orgs.length > 0 && !orgs.find((o) => o?.orgId === selectedOrgId) && orgs[0]) {
      setSelectedOrgId(orgs[0].orgId);
      localStorage.setItem(ORG_STORAGE_KEY, orgs[0].orgId);
    }
    if (selectedOrgId && orgsRaw !== undefined && orgs.length === 0) {
      setSelectedOrgId(null);
      localStorage.removeItem(ORG_STORAGE_KEY);
    }
  }, [orgs, orgsRaw, selectedOrgId]);

  // ── Member doc for selected org ──────────────────────────────────────────
  const memberDoc = useQuery(
    api.users.currentMember,
    selectedOrgId ? { orgId: selectedOrgId as Id<"organizations"> } : "skip"
  );

  // ── Derived state ────────────────────────────────────────────────────────
  const isLoading = convexLoading || (isAuthenticated && (email === undefined || (email !== null && orgsRaw === undefined)));

  const needsOrg =
    !isLoading && isAuthenticated &&
    (orgs.length === 0 || !selectedOrgId) &&
    email !== undefined;

  const user: CurrentUser | null = memberDoc && selectedOrgId
    ? {
        memberId: memberDoc._id,
        orgId:    selectedOrgId,
        name:     memberDoc.name,
        email:    memberDoc.email,
        role:     memberDoc.role as "admin" | "manager" | "member",
      }
    : null;

  // ── Only redirect: unauthenticated → /login, authenticated+ready → away from /login
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
    if (isAuthenticated && user && pathname === "/login") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user, pathname, router]);

  const switchOrg = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    localStorage.setItem(ORG_STORAGE_KEY, newOrgId);
    router.replace("/");
  };

  const logout = () => {
    localStorage.removeItem(ORG_STORAGE_KEY);
    signOut().then(() => router.replace("/login"));
  };

  // ── Render decision ──────────────────────────────────────────────────────
  let content: ReactNode;

  if (pathname === "/login") {
    // Login page always renders normally
    content = children;
  } else if (isLoading || !isAuthenticated) {
    // Show spinner while loading or before redirect to /login
    content = <FullScreenSpinner />;
  } else if (needsOrg) {
    // Show org creation/selection inline — no redirect needed
    content = (
      <OrgGate
        orgs={orgs as OrgInfo[]}
        email={email ?? ""}
        onSelectOrg={switchOrg}
      />
    );
  } else if (!user) {
    // User has an org selected but member doc hasn't loaded yet
    content = <FullScreenSpinner />;
  } else {
    content = (
      <>
        <WeeklyReflectionPopup />
        {children}
      </>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      orgId: selectedOrgId as Id<"organizations"> | null,
      orgs: orgs as OrgInfo[],
      switchOrg,
      logout,
      isAdmin:   user?.role === "admin",
      isManager: user?.role === "manager",
      isLoading,
      needsOrgSelection: needsOrg,
    }}>
      {content}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ── Inline spinner ───────────────────────────────────────────────────────────
function FullScreenSpinner() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div role="status" aria-label="Loading" style={{ width: 32, height: 32, border: "3px solid #3a3a3a", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Org gate: shown when user is authenticated but has no org selected ───────
function OrgGate({
  orgs,
  email,
  onSelectOrg,
}: {
  orgs: OrgInfo[];
  email: string;
  onSelectOrg: (orgId: string) => void;
}) {
  const { t } = useLocale();
  const [screen, setScreen] = useState<"select" | "create">(
    orgs.length > 0 ? "select" : "create"
  );
  const [orgName, setOrgName]         = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  const createOrg = useMutation(api.organizations.create);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await createOrg({
        name: orgName.trim(),
        creatorName: creatorName.trim() || email.split("@")[0] || "Admin",
        creatorEmail: email,
      });
      localStorage.setItem(ORG_STORAGE_KEY, result.orgId);
      onSelectOrg(result.orgId);
    } catch (err: any) {
      setError(err?.message ?? t.genericError);
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
    borderRadius: 10, padding: "10px 14px", fontSize: 14, color: "var(--text)",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 20, padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ width: 48, height: 48, background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>⌘</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.appName}</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            {screen === "select" ? t.selectOrg : t.createOrg}
          </p>
        </div>

        {/* ── Org selection ─────────────────────────────────────────── */}
        {screen === "select" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orgs.map((org) => (
              <button
                key={org.orgId}
                onClick={() => onSelectOrg(org.orgId)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderRadius: 12,
                  background: "var(--surface2)", border: "1px solid var(--border2)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "all 0.15s", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-subtle)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.background = "var(--surface2)"; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={18} style={{ color: "var(--accent-light)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{org.orgName}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0", textTransform: "capitalize" }}>{org.role}</p>
                </div>
                <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
              </button>
            ))}
            <button
              onClick={() => setScreen("create")}
              style={{
                display: "flex", alignItems: "center", gap: 10, justifyContent: "center",
                padding: "12px 16px", borderRadius: 12,
                background: "none", border: "1px dashed var(--border2)",
                cursor: "pointer", color: "var(--text-muted)", fontSize: 13, fontWeight: 500,
                transition: "all 0.15s", marginTop: 4, fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent-light)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <Plus size={14} /> {t.createNewOrg}
            </button>
          </div>
        )}

        {/* ── Org creation ──────────────────────────────────────────── */}
        {screen === "create" && (
          <form onSubmit={handleCreateOrg} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.orgNameLabel}</label>
              <input
                type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                placeholder={t.orgNamePlaceholder} required autoFocus style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.yourNameLabel}</label>
              <input
                type="text" value={creatorName} onChange={(e) => setCreatorName(e.target.value)}
                placeholder={t.yourNamePlaceholder} style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
              />
            </div>

            <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0, background: "var(--accent-subtle)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "8px 12px" }}>
              {t.orgAdminHint}
            </p>

            {error && <p style={{ fontSize: 12.5, color: "var(--status-danger)", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px", margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading || !orgName.trim()}
              style={{ width: "100%", padding: "11px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, background: loading || !orgName.trim() ? "var(--accent-muted)" : "var(--accent)", color: "#fff", border: "none", cursor: loading || !orgName.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {loading ? t.creating : t.createOrganization}
            </button>

            {orgs.length > 0 && (
              <button type="button" onClick={() => setScreen("select")}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
                {t.backToOrgList}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
