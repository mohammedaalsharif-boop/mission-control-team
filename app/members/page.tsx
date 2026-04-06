"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import { UserPlus, Trash2, Shield, User, Mail, XCircle } from "lucide-react";

export default function MembersPage() {
  const { isAdmin, isLoading, orgId } = useAuth();
  const { t } = useLocale();
  const membersArgs = orgId ? { orgId } : "skip" as const;
  const members      = useQuery(api.members.listMembers, membersArgs) ?? [];
  const allTasksArgs = orgId ? { orgId } : "skip" as const;
  const allTasks     = useQuery(api.tasks.listAllTasks, allTasksArgs)  ?? [];
  const invites      = useQuery(api.inviteActions.listInvites, membersArgs) ?? [];
  const createInvite = useMutation(api.inviteActions.createInvite);
  const revokeInvite = useMutation(api.inviteActions.revokeInvite);
  const resendInvite = useMutation(api.inviteActions.resendInvite);
  const removeMember = useMutation(api.members.removeMember);

  const [form,      setForm]      = useState({ name: "", email: "" });
  const [adding,    setAdding]    = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const [loading,   setLoading]   = useState(false);

  const pendingInvites = invites.filter((inv: any) => inv.status === "pending" && inv.expiresAt > Date.now());

  if (isLoading) return null;
  if (!isAdmin) return (
    <div className="flex h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>{t.adminAccessRequired}</p>
      </div>
    </div>
  );

  const taskCountFor = (memberId: string) =>
    allTasks.filter((tk: any) => tk.memberId === memberId).length;

  const completedFor = (memberId: string) =>
    allTasks.filter((tk: any) => tk.memberId === memberId && tk.status === "completed").length;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (!orgId) return;
      await createInvite({ orgId, name: form.name.trim(), email: form.email.trim() });
      setForm({ name: "", email: "" });
      setSuccess(t.teamTab?.inviteSent ?? "Invite sent! They'll receive an email with a link to join.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to send invite.");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div style={{ padding: "28px 32px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.membersPage.title}</h1>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {members.length} {members.length !== 1 ? t.membersPage.teamMembers : t.membersPage.teamMember}
              </p>
            </div>
            <button
              onClick={() => { setAdding(!adding); setError(""); setSuccess(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
              }}
            >
              <UserPlus size={14} /> {t.teamTab?.inviteMember ?? "Invite Member"}
            </button>
          </div>

          {/* Invite form */}
          {adding && (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 14, padding: "20px 24px", marginBottom: 20,
              animation: "fadeIn 0.15s ease",
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: "0 0 16px" }}>
                {t.teamTab?.inviteTeamMember ?? "Invite a team member"}
              </h3>
              <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
                      {t.membersPage.fullName}
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Jane Smith"
                      required
                      style={{
                        width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 8, padding: "8px 12px", fontSize: 13,
                        color: "var(--text)", outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
                      {t.membersPage.email}
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="jane@example.com"
                      required
                      style={{
                        width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 8, padding: "8px 12px", fontSize: 13,
                        color: "var(--text)", outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                {error && (
                  <p style={{ fontSize: 12, color: "var(--status-danger)", margin: 0 }}>{error}</p>
                )}
                {success && (
                  <p style={{ fontSize: 12, color: "var(--status-success, #22c55e)", margin: 0 }}>{success}</p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={loading} style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                    opacity: loading ? 0.6 : 1,
                  }}>
                    {loading ? (t.teamTab?.sending ?? "Sending…") : (t.teamTab?.sendInvite ?? "Send Invite")}
                  </button>
                  <button type="button" onClick={() => setAdding(false)} style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 13,
                    background: "var(--surface2)", color: "var(--text-muted)",
                    border: "1px solid var(--border2)", cursor: "pointer",
                  }}>
                    {t.cancel}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                {t.teamTab?.pendingInvites ?? "Pending Invites"} ({pendingInvites.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pendingInvites.map((inv: any) => (
                  <div key={inv._id} style={{
                    background: "var(--surface)", border: "1px solid var(--border2)",
                    borderRadius: 10, padding: "12px 18px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <Mail size={14} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{inv.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{inv.email}</span>
                    </div>
                    <button
                      onClick={async () => { if (orgId) try { await resendInvite({ orgId, inviteId: inv._id }); } catch {} }}
                      style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border2)", cursor: "pointer" }}
                    >
                      {t.teamTab?.resend ?? "Resend"}
                    </button>
                    <button
                      onClick={async () => { if (orgId) try { await revokeInvite({ orgId, inviteId: inv._id }); } catch {} }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                      title={t.teamTab?.revokeInvite ?? "Revoke invite"}
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map((m: any) => {
              const total     = taskCountFor(m._id);
              const completed = completedFor(m._id);
              const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <div key={m._id} style={{
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 12, padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: 16,
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: m.role === "admin" ? "var(--accent-bg)" : "rgba(113,113,122,0.15)",
                    border: m.role === "admin" ? "1px solid rgba(99,102,241,0.3)" : "1px solid var(--border2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700,
                    color: m.role === "admin" ? "var(--accent-light)" : "var(--text-muted)",
                    flexShrink: 0,
                  }}>
                    {m.name[0]?.toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{m.name}</span>
                      {m.role === "admin" && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                          background: "var(--accent-bg)", color: "var(--accent-light)",
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          <Shield size={9} /> {t.membersPage.admin}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{m.email}</p>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: "var(--accent)", margin: 0 }}>{total}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{t.membersPage.tasks}</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: "var(--status-success)", margin: 0 }}>{completed}</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{t.membersPage.done}</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: pct === 100 ? "var(--status-success)" : "var(--text)", margin: 0 }}>{pct}%</p>
                      <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{t.membersPage.rate}</p>
                    </div>
                  </div>

                  {/* Remove (not for admin) */}
                  {m.role !== "admin" && (
                    <button
                      onClick={() => orgId && removeMember({ orgId, memberId: m._id })}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-danger)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                      title={t.membersPage.removeMember}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
