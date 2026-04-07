"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import {
  Users, Shield, Settings, UserPlus, Trash2, Plus,
  ChevronDown, Check, Bell, Globe, Lock, Link2,
  CheckCircle, XCircle, BarChart2, Mail, Zap, Sliders,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────

const ROLES = [
  {
    id:    "admin",
    label: "Admin",
    color: "var(--accent-light)",
    bg:    "var(--accent-bg)",
    border:"var(--accent-border)",
    desc:  "Full control. One per workspace.",
  },
  {
    id:    "manager",
    label: "Manager",
    color: "#fbbf24",
    bg:    "rgba(245,158,11,0.12)",
    border:"rgba(245,158,11,0.3)",
    desc:  "Can approve tasks and view analytics. Cannot manage members or settings.",
  },
  {
    id:    "member",
    label: "Member",
    color: "#a1a1aa",
    bg:    "rgba(113,113,122,0.12)",
    border:"rgba(113,113,122,0.3)",
    desc:  "Can create and manage their own tasks. No approval or analytics access.",
  },
] as const;

type RoleId = (typeof ROLES)[number]["id"];


function RoleBadge({ role }: { role: string }) {
  const r = ROLES.find((x) => x.id === role) ?? ROLES[2];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
      background: r.bg, color: r.color, border: `1px solid ${r.border}`,
      whiteSpace: "nowrap",
    }}>
      {r.label}
    </span>
  );
}

function RoleDropdown({
  current, memberId, onChange,
}: { current: string; memberId: string; onChange: (role: string) => void }) {
  const [open, setOpen] = useState(false);
  const r = ROLES.find((x) => x.id === current) ?? ROLES[2];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
          background: r.bg, border: `1px solid ${r.border}`,
          color: r.color, cursor: "pointer",
        }}
      >
        {r.label} <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 50,
          background: "var(--surface)", border: "1px solid var(--border2)",
          borderRadius: 10, overflow: "hidden", minWidth: 150,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          {ROLES.filter((x) => x.id !== "admin").map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              style={{
                width: "100%", textAlign: "left", padding: "8px 12px",
                display: "flex", alignItems: "center", gap: 8,
                background: current === opt.id ? opt.bg : "none",
                border: "none", cursor: "pointer", fontSize: 12,
              }}
              onMouseEnter={(e) => { if (current !== opt.id) e.currentTarget.style.background = "var(--surface2)"; }}
              onMouseLeave={(e) => { if (current !== opt.id) e.currentTarget.style.background = "none"; }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: opt.color, flexShrink: 0,
              }} />
              <span style={{ color: "var(--text)", fontWeight: current === opt.id ? 700 : 400 }}>
                {opt.label}
              </span>
              {current === opt.id && <Check size={11} style={{ color: opt.color, marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

function TeamTab() {
  const { t } = useLocale();
  const { user, orgId } = useAuth();
  const membersArgs = orgId ? { orgId } : "skip" as const;
  const members      = useQuery(api.members.listMembers, membersArgs)   ?? [];
  const allTasksArgs = orgId ? { orgId } : "skip" as const;
  const allTasks     = useQuery(api.tasks.listAllTasks, allTasksArgs)     ?? [];
  const invites      = useQuery(api.inviteActions.listInvites, membersArgs) ?? [];
  const removeMember = useMutation(api.members.removeMember);
  const updateRole   = useMutation(api.members.updateMemberRole);
  const createInvite = useMutation(api.inviteActions.createInvite);
  const revokeInvite = useMutation(api.inviteActions.revokeInvite);
  const resendInvite = useMutation(api.inviteActions.resendInvite);

  const [form,    setForm]    = useState({ name: "", email: "", role: "member" as RoleId });
  const [adding,  setAdding]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const pendingInvites = invites.filter((inv: any) => inv.status === "pending" && inv.expiresAt > Date.now());

  const taskCount = (id: string) => allTasks.filter((t: any) => t.memberId === id).length;
  const doneCount = (id: string) => allTasks.filter((t: any) => t.memberId === id && t.status === "completed").length;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !orgId) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      await createInvite({ orgId, name: form.name.trim(), email: form.email.trim(), role: form.role });
      setForm({ name: "", email: "", role: "member" });
      setSuccess(t.teamTab.inviteSent ?? "Invite sent!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to send invite.");
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
            {members.length} {t.teamTab.membersCount}
          </p>
        </div>
        <button
          onClick={() => { setAdding(!adding); setError(""); setSuccess(""); }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
          }}
        >
          <UserPlus size={13} /> {t.teamTab.inviteMember ?? "Invite Member"}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 12, padding: "18px 20px", marginBottom: 16,
          animation: "fadeIn 0.15s ease",
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "0 0 14px" }}>
            {t.teamTab.inviteTeamMember ?? "Invite a team member"}
          </p>
          <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{t.teamTab.fullName}</label>
                <input
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t.teamTab.fullNamePlaceholder} required
                  style={{ width: "100%", background: "var(--surface3)", border: "1px solid var(--border2)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5, color: "var(--text)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>{t.teamTab.email}</label>
                <input
                  type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={t.teamTab.emailPlaceholder} required
                  style={{ width: "100%", background: "var(--surface3)", border: "1px solid var(--border2)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5, color: "var(--text)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{t.teamTab.role}</label>
              <div style={{ display: "flex", gap: 6 }}>
                {ROLES.filter((r) => r.id !== "admin").map((r) => (
                  <button
                    key={r.id} type="button"
                    onClick={() => setForm({ ...form, role: r.id })}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: 7, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.15s",
                      background: form.role === r.id ? r.bg : "var(--surface3)",
                      border:     form.role === r.id ? `1px solid ${r.border}` : "1px solid var(--border2)",
                      color:      form.role === r.id ? r.color : "var(--text-muted)",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
                {ROLES.find((r) => r.id === form.role)?.desc}
              </p>
            </div>

            {error && <p style={{ fontSize: 12, color: "var(--status-danger)", margin: 0 }}>{error}</p>}
            {success && <p style={{ fontSize: 12, color: "var(--status-success, #22c55e)", margin: 0 }}>{success}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={loading} style={{
                padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                opacity: loading ? 0.6 : 1,
              }}>
                {loading ? (t.teamTab.sending ?? "Sending…") : (t.teamTab.sendInvite ?? "Send Invite")}
              </button>
              <button type="button" onClick={() => setAdding(false)} style={{
                padding: "6px 12px", borderRadius: 7, fontSize: 12,
                background: "var(--surface3)", color: "var(--text-muted)",
                border: "1px solid var(--border2)", cursor: "pointer",
              }}>{t.cancel}</button>
            </div>
          </form>
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
            {t.teamTab.pendingInvites ?? "Pending Invites"} ({pendingInvites.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pendingInvites.map((inv: any) => (
              <div key={inv._id} style={{
                background: "var(--surface2)", border: "1px solid var(--border2)",
                borderRadius: 10, padding: "10px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <Mail size={14} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{inv.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>{inv.email}</span>
                </div>
                <RoleBadge role={inv.role} />
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/invite?token=${inv.token}`;
                    navigator.clipboard.writeText(url).then(() => {
                      setSuccess(t.teamTab.linkCopied);
                      setTimeout(() => setSuccess(""), 2000);
                    });
                  }}
                  style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: "var(--accent-bg)", color: "var(--accent-light)", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                  title="Copy invite link"
                >
                  <Link2 size={10} /> {t.teamTab.copyLink}
                </button>
                <button
                  onClick={async () => { if (orgId) try { await resendInvite({ orgId, inviteId: inv._id }); } catch {} }}
                  style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 600, background: "var(--surface3)", color: "var(--text-muted)", border: "1px solid var(--border2)", cursor: "pointer" }}
                >
                  {t.teamTab.resend ?? "Resend"}
                </button>
                <button
                  onClick={async () => { if (orgId) try { await revokeInvite({ orgId, inviteId: inv._id }); } catch {} }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                  title={t.teamTab.revokeInvite ?? "Revoke invite"}
                >
                  <XCircle size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map((m: any) => {
          const total = taskCount(m._id);
          const done  = doneCount(m._id);
          const rate  = total > 0 ? Math.round((done / total) * 100) : 0;
          const isMe  = m._id === user?.memberId;

          return (
            <div key={m._id} style={{
              background: "var(--surface)",
              border: `1px solid ${isMe ? "rgba(99,102,241,0.25)" : "var(--border)"}`,
              borderRadius: 12, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 14,
            }}>
              {/* Avatar */}
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: m.role === "admin" ? "var(--accent-bg)" :
                            m.role === "manager" ? "rgba(245,158,11,0.15)" : "rgba(113,113,122,0.12)",
                border: m.role === "admin" ? "1px solid rgba(99,102,241,0.3)" :
                        m.role === "manager" ? "1px solid rgba(245,158,11,0.3)" : "1px solid var(--border2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700,
                color: m.role === "admin" ? "var(--accent-light)" : m.role === "manager" ? "#fbbf24" : "var(--text-muted)",
              }}>
                {m.name[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{m.name}</span>
                  {isMe && <span style={{ fontSize: 9.5, color: "var(--text-dim)" }}>{t.teamTab.you}</span>}
                </div>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: "1px 0 0" }}>{m.email}</p>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 18, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{total}</div>
                  <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{t.teamTab.tasksLabel}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--status-success)" }}>{done}</div>
                  <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{t.teamTab.doneLabel}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: rate === 100 ? "var(--status-success)" : "var(--text)" }}>{rate}%</div>
                  <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{t.teamTab.rateLabel}</div>
                </div>
              </div>

              {/* Role */}
              <div style={{ flexShrink: 0 }}>
                {m.role === "admin" ? (
                  <RoleBadge role="admin" />
                ) : (
                  <RoleDropdown
                    current={m.role}
                    memberId={m._id}
                    onChange={(role) => orgId && updateRole({ orgId, memberId: m._id as Id<"members">, role })}
                  />
                )}
              </div>

              {/* Remove */}
              {m.role !== "admin" && (
                confirmRemove === m._id ? (
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={() => { orgId && removeMember({ orgId, memberId: m._id as Id<"members"> }); setConfirmRemove(null); }}
                      style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: "var(--status-danger)", color: "#fff", border: "none", cursor: "pointer" }}
                    >
                      {t.remove}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      style={{ padding: "4px 8px", borderRadius: 6, fontSize: 11, background: "var(--surface2)", color: "var(--text-muted)", border: "1px solid var(--border2)", cursor: "pointer" }}
                    >
                      {t.cancel}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(m._id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-danger)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                    title={t.teamTab.removeMember}
                  >
                    <Trash2 size={14} />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Permission categories for grouping ────────────────────────────────────── */
const PERM_CATEGORIES: { label: string; permissions: string[] }[] = [
  { label: "Spaces",       permissions: ["space.create", "space.edit", "space.delete", "space.archive"] },
  { label: "Projects",     permissions: ["project.create", "project.edit", "project.delete"] },
  { label: "Tasks",        permissions: ["task.create", "task.edit", "task.delete", "task.approve", "task.assign"] },
  { label: "Members",      permissions: ["member.invite", "member.remove", "member.role_change"] },
  { label: "Settings",     permissions: ["settings.edit"] },
  { label: "Goals",        permissions: ["goal.create", "goal.edit", "goal.delete"] },
  { label: "Automations",  permissions: ["automation.create", "automation.edit", "automation.delete"] },
  { label: "Custom Fields", permissions: ["custom_field.create", "custom_field.edit", "custom_field.delete"] },
];

function permLabel(perm: string) {
  const [, action] = perm.split(".");
  return (action ?? perm).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PermissionsTab() {
  const { t } = useLocale();
  const { orgId } = useAuth();
  const roles       = useQuery(api.permissions.listRoles, orgId ? { orgId } : "skip") ?? [];
  const allPerms    = useQuery(api.permissions.getAllPermissions) ?? [];
  const updateRole  = useMutation(api.permissions.updateRole);
  const createRole  = useMutation(api.permissions.createRole);
  const deleteRole  = useMutation(api.permissions.deleteRole);
  const seedRoles   = useMutation(api.permissions.seedDefaultRoles);

  const [creating, setCreating]       = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newPerms, setNewPerms]       = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Auto-seed default roles on first visit if none exist
  const seeded = roles.length > 0;

  const handleSeed = async () => {
    if (!orgId) return;
    await seedRoles({ orgId });
  };

  const togglePerm = async (roleId: string, perm: string, currentPerms: string[]) => {
    const has = currentPerms.includes(perm);
    const next = has ? currentPerms.filter((p) => p !== perm) : [...currentPerms, perm];
    await updateRole({ roleId: roleId as Id<"roles">, permissions: next });
  };

  const handleCreateRole = async () => {
    if (!orgId || !newRoleName.trim()) return;
    await createRole({ orgId, name: newRoleName.trim(), permissions: Array.from(newPerms) });
    setNewRoleName("");
    setNewPerms(new Set());
    setCreating(false);
  };

  const handleDeleteRole = async (roleId: string) => {
    await deleteRole({ roleId: roleId as Id<"roles"> });
    setConfirmDelete(null);
  };

  if (!seeded) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
        <Shield size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
        <p style={{ fontSize: 14, margin: "0 0 4px" }}>{t.permissionsTab.noRoles}</p>
        <p style={{ fontSize: 12, margin: "0 0 16px" }}>{t.permissionsTab.noRolesHint}</p>
        <button
          onClick={handleSeed}
          style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {t.permissionsTab.initializeRoles}
        </button>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    Admin: "var(--accent-light)", Manager: "#fbbf24", Member: "#a1a1aa",
  };

  return (
    <div>
      {/* Role cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {roles.map((role: any) => {
          const color = roleColors[role.name] ?? "var(--text-muted)";
          return (
            <div key={role._id} style={{
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 10, padding: "12px 16px", minWidth: 150, flex: "0 1 auto",
              borderLeft: `3px solid ${color}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{role.name}</span>
                {role.isSystem && (
                  <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "var(--surface3)", color: "var(--text-dim)" }}>
                    {t.system}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {role.permissions.length} {t.permissionsTab.permissions}
              </span>
              {!role.isSystem && (
                <div style={{ marginTop: 6 }}>
                  {confirmDelete === role._id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleDeleteRole(role._id)} style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: "var(--status-danger)", color: "#fff",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                      }}>Delete</button>
                      <button onClick={() => setConfirmDelete(null)} style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: "var(--surface3)", color: "var(--text-muted)",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                      }}>{t.cancel}</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(role._id)} style={{
                      fontSize: 10, color: "var(--text-dim)", background: "none",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 3, padding: 0,
                    }}>
                      <Trash2 size={9} /> {t.remove}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add role button */}
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5, padding: "12px 16px",
              borderRadius: 10, fontSize: 12, fontWeight: 600,
              background: "var(--surface2)", border: "1px dashed var(--border2)",
              color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <Plus size={12} /> {t.permissionsTab.customRole}
          </button>
        )}
      </div>

      {/* Create custom role form */}
      {creating && (
        <div style={{
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 10, padding: 16, marginBottom: 20,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: "0 0 10px" }}>
            {t.permissionsTab.newCustomRole}
          </p>
          <input
            autoFocus
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder={t.permissionsTab.roleNamePlaceholder}
            style={{
              width: "100%", padding: "7px 10px", fontSize: 12,
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 6, color: "var(--text)", outline: "none",
              fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateRole(); }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
            {(allPerms as string[]).map((perm) => (
              <button
                key={perm}
                onClick={() => {
                  setNewPerms((prev) => {
                    const next = new Set(prev);
                    next.has(perm) ? next.delete(perm) : next.add(perm);
                    return next;
                  });
                }}
                style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 4,
                  background: newPerms.has(perm) ? "var(--accent-bg)" : "var(--surface3)",
                  color: newPerms.has(perm) ? "var(--accent-light)" : "var(--text-dim)",
                  border: `1px solid ${newPerms.has(perm) ? "var(--accent-border)" : "var(--border2)"}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {perm}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleCreateRole} disabled={!newRoleName.trim()} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: newRoleName.trim() ? "var(--accent)" : "var(--surface3)",
              color: "#fff", border: "none", cursor: newRoleName.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}>Create</button>
            <button onClick={() => { setCreating(false); setNewRoleName(""); setNewPerms(new Set()); }} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 12,
              background: "var(--surface3)", color: "var(--text-muted)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>{t.cancel}</button>
          </div>
        </div>
      )}

      {/* Permission matrix */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border2)" }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {t.permissionsTab.permission}
              </th>
              {roles.map((role: any) => (
                <th key={role._id} style={{
                  padding: "12px 10px", textAlign: "center", fontSize: 11, fontWeight: 700,
                  color: roleColors[role.name] ?? "var(--text-muted)", minWidth: 70,
                }}>
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_CATEGORIES.map((cat) => (
              <>
                <tr key={`cat-${cat.label}`}>
                  <td colSpan={roles.length + 1} style={{
                    padding: "8px 16px 4px", fontSize: 10, fontWeight: 700,
                    color: "var(--text-muted)", textTransform: "uppercase",
                    letterSpacing: "0.06em", borderBottom: "1px solid var(--border)",
                    background: "var(--surface2)",
                  }}>
                    {cat.label}
                  </td>
                </tr>
                {cat.permissions.map((perm) => (
                  <tr key={perm}>
                    <td style={{
                      padding: "8px 16px 8px 24px", fontSize: 12, color: "var(--text)",
                      borderBottom: "1px solid var(--border)",
                    }}>
                      {permLabel(perm)}
                    </td>
                    {roles.map((role: any) => {
                      const has = role.permissions.includes(perm);
                      const isAdmin = role.name === "Admin";
                      return (
                        <td key={role._id} style={{
                          padding: "8px 10px", textAlign: "center",
                          borderBottom: "1px solid var(--border)",
                        }}>
                          <button
                            onClick={() => !isAdmin && togglePerm(role._id, perm, role.permissions)}
                            disabled={isAdmin}
                            style={{
                              width: 18, height: 18, borderRadius: 4, border: "none",
                              background: has ? "var(--accent)" : "var(--surface3)",
                              cursor: isAdmin ? "default" : "pointer",
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              opacity: isAdmin ? 0.6 : 1,
                            }}
                            title={isAdmin ? "Admin always has all permissions" : `Toggle ${perm}`}
                          >
                            {has && <Check size={10} color="#fff" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkspaceTab() {
  const { t, locale, setLocale } = useLocale();
  const { user, orgId } = useAuth();
  const settingsArgs = orgId ? { orgId } : "skip" as const;
  const allSettings = useQuery(api.settings.getAllSettings, settingsArgs) ?? [];
  const setSetting  = useMutation(api.settings.setSetting);
  const [saved, setSaved] = useState(false);

  const defaultVis = allSettings.find((s: any) => s.key === "default_visibility")?.value ?? "public";

  const setDefaultVis = async (v: string) => {
    if (!orgId) return;
    await setSetting({ orgId, key: "default_visibility", value: v });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Admin account */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
          <Shield size={13} style={{ color: "var(--accent-light)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t.workspaceTab.adminAccount}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%",
            background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "var(--accent-light)",
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{user?.name}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0 }}>{user?.email}</p>
          </div>
          <RoleBadge role="admin" />
        </div>
      </div>

      {/* Default task visibility */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Globe size={13} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t.workspaceTab.defaultVisibility}</span>
          {saved && <span style={{ fontSize: 10, color: "var(--status-success)", fontWeight: 600 }}>{t.saved}</span>}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
          {t.workspaceTab.visibilityHint}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "public",  icon: <Globe size={12} />, label: t.workspaceTab.public,  desc: t.workspaceTab.publicDesc,           color: "var(--status-success)", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)"   },
            { id: "private", icon: <Lock  size={12} />, label: t.workspaceTab.private, desc: t.workspaceTab.privateDesc, color: "var(--status-danger)", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setDefaultVis(opt.id)}
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                background: defaultVis === opt.id ? opt.bg : "var(--surface2)",
                border: defaultVis === opt.id ? `1px solid ${opt.border}` : "1px solid var(--border2)",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ color: defaultVis === opt.id ? opt.color : "var(--text-muted)" }}>{opt.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: defaultVis === opt.id ? opt.color : "var(--text)" }}>
                  {opt.label}
                </span>
                {defaultVis === opt.id && <Check size={11} style={{ color: opt.color, marginLeft: "auto" }} />}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Bell size={13} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t.workspaceTab.notifications}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "var(--status-success)" }}>Active</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Task submitted",      desc: "Admin & managers notified when a member submits work" },
            { label: "Task approved",        desc: "Member notified when their task is approved"          },
            { label: "Task sent back",       desc: "Member notified with feedback when rejected"          },
            { label: "@ Mentions",           desc: "Member notified when mentioned in a comment"          },
            { label: "Weekly digest (Thu)",  desc: "All members get a recap of completed tasks at 6 PM"   },
            { label: "Weekly digest (Sun)",  desc: "All members get upcoming due tasks preview at 9 AM"   },
          ].map((n) => (
            <div key={n.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CheckCircle size={12} style={{ color: "var(--status-success)", flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{n.label}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{n.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email notifications — coming soon */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Mail size={13} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t.workspaceTab.emailNotifications}</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.12)", color: "var(--status-warning)" }}>{t.comingSoon}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
          Requires a Resend API key (<code style={{ fontSize: 11, color: "var(--accent-light)" }}>AUTH_RESEND_KEY</code>) in{" "}
          <code style={{ fontSize: 11, color: "var(--accent-light)" }}>.env.local</code>. Once configured, members will receive email alerts for approvals, rejections, and mentions.
        </p>
      </div>

      {/* Language */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <Globe size={13} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{t.workspaceTab.language}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.5 }}>
          {t.workspaceTab.languageHint}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "en" as const, label: "English", desc: "Left to right" },
            { id: "ar" as const, label: "العربية", desc: "Right to left" },
          ].map((lang) => (
            <button
              key={lang.id}
              onClick={() => setLocale(lang.id)}
              style={{
                flex: 1, padding: "12px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                background: locale === lang.id ? "var(--accent-bg)" : "var(--surface2)",
                border: locale === lang.id ? "1px solid var(--accent-border)" : "1px solid var(--border2)",
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: locale === lang.id ? "var(--accent-light)" : "var(--text)" }}>
                  {lang.label}
                </span>
                {locale === lang.id && <Check size={11} style={{ color: "var(--accent-light)", marginLeft: "auto" }} />}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{lang.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AutomationsTab() {
  const { t } = useLocale();
  const { orgId, user } = useAuth();
  const automations = useQuery(api.automations.list, orgId ? { orgId } : "skip") ?? [];
  const metadata    = useQuery(api.automations.getMetadata) ?? { triggers: [], actions: [] };
  const members     = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const createAuto  = useMutation(api.automations.create);
  const updateAuto  = useMutation(api.automations.update);
  const removeAuto  = useMutation(api.automations.remove);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", trigger: "", action: "", condition: "", actionConfig: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const triggerLabel = (id: string) => metadata.triggers.find((t: any) => t.id === id)?.label ?? id;
  const actionLabel  = (id: string) => metadata.actions.find((a: any) => a.id === id)?.label ?? id;

  const handleCreate = async () => {
    if (!orgId || !user || !form.name.trim() || !form.trigger || !form.action) return;
    await createAuto({
      orgId,
      name:         form.name.trim(),
      trigger:      form.trigger,
      action:       form.action,
      condition:    form.condition || undefined,
      actionConfig: form.actionConfig || undefined,
      createdBy:    user.memberId as Id<"members">,
    });
    setForm({ name: "", trigger: "", action: "", condition: "", actionConfig: "" });
    setCreating(false);
  };

  const STATUS_OPTIONS = [
    { value: "draft", label: "Draft" },
    { value: "in_progress", label: "In Progress" },
    { value: "submitted", label: "Submitted" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {automations.length} {t.automationsTab.count}
        </p>
        <button
          onClick={() => setCreating(!creating)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus size={13} /> {t.automationsTab.newAutomation}
        </button>
      </div>

      {creating && (
        <div style={{
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t.automationsTab.automationNamePlaceholder}
            style={{
              width: "100%", padding: "8px 10px", fontSize: 12,
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 6, color: "var(--text)", outline: "none",
              fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box",
            }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.automationsTab.when}
              </label>
              <select
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                }}
              >
                <option value="">{t.automationsTab.selectTrigger}</option>
                {metadata.triggers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.automationsTab.then}
              </label>
              <select
                value={form.action}
                onChange={(e) => setForm({ ...form, action: e.target.value })}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                }}
              >
                <option value="">{t.automationsTab.selectAction}</option>
                {metadata.actions.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action-specific config */}
          {form.action === "change_status" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.automationsTab.changeToStatus}
              </label>
              <select
                value={(() => { try { return JSON.parse(form.actionConfig || "{}").status ?? ""; } catch { return ""; } })()}
                onChange={(e) => setForm({ ...form, actionConfig: JSON.stringify({ status: e.target.value }) })}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                }}
              >
                <option value="">Select status...</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
          {form.action === "assign_member" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.automationsTab.assignTo}
              </label>
              <select
                value={(() => { try { return JSON.parse(form.actionConfig || "{}").memberId ?? ""; } catch { return ""; } })()}
                onChange={(e) => setForm({ ...form, actionConfig: JSON.stringify({ memberId: e.target.value }) })}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                }}
              >
                <option value="">Select member...</option>
                {members.map((m: any) => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.action === "add_comment" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.automationsTab.commentText}
              </label>
              <input
                value={(() => { try { return JSON.parse(form.actionConfig || "{}").body ?? ""; } catch { return ""; } })()}
                onChange={(e) => setForm({ ...form, actionConfig: JSON.stringify({ body: e.target.value }) })}
                placeholder="Automated comment text..."
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Optional condition */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
              {t.automationsTab.condition}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const [key, val] = e.target.value.split("=");
                    setForm({ ...form, condition: JSON.stringify({ [key]: val }) });
                  } else {
                    setForm({ ...form, condition: "" });
                  }
                }}
                style={{
                  flex: 1, padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                }}
              >
                <option value="">{t.automationsTab.noCondition}</option>
                <option value="status=submitted">{t.automationsTab.conditionSubmitted}</option>
                <option value="status=completed">{t.automationsTab.conditionCompleted}</option>
                <option value="status=in_progress">{t.automationsTab.conditionInProgress}</option>
                <option value="priority=high">{t.automationsTab.conditionHighPriority}</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleCreate} disabled={!form.name.trim() || !form.trigger || !form.action} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: (form.name.trim() && form.trigger && form.action) ? "var(--accent)" : "var(--surface3)",
              color: "#fff", border: "none",
              cursor: (form.name.trim() && form.trigger && form.action) ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}>Create</button>
            <button onClick={() => { setCreating(false); setForm({ name: "", trigger: "", action: "", condition: "", actionConfig: "" }); }} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 12,
              background: "var(--surface3)", color: "var(--text-muted)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>{t.cancel}</button>
          </div>
        </div>
      )}

      {/* Automations list */}
      {automations.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text-dim)" }}>
          <Zap size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ fontSize: 14, margin: "0 0 4px" }}>{t.automationsTab.noAutomations}</p>
          <p style={{ fontSize: 12, margin: 0 }}>{t.automationsTab.noAutomationsHint}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {automations.map((auto: any) => (
          <div key={auto._id} style={{
            background: "var(--surface)", border: "1px solid var(--border2)",
            borderRadius: 10, padding: "14px 16px",
            opacity: auto.enabled ? 1 : 0.5,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{auto.name}</span>
                  {!auto.enabled && (
                    <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--surface3)", color: "var(--text-dim)" }}>
                      DISABLED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <span style={{ padding: "1px 6px", borderRadius: 3, background: "rgba(245,158,11,0.1)", color: "var(--status-warning)" }}>
                    {triggerLabel(auto.trigger)}
                  </span>
                  <span style={{ color: "var(--text-dim)" }}>→</span>
                  <span style={{ padding: "1px 6px", borderRadius: 3, background: "var(--accent-bg)", color: "var(--accent-light)" }}>
                    {actionLabel(auto.action)}
                  </span>
                  {auto.condition && (
                    <span style={{ padding: "1px 6px", borderRadius: 3, background: "var(--surface3)", color: "var(--text-dim)", fontSize: 10 }}>
                      if: {auto.condition}
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle + Delete */}
              <button
                onClick={() => updateAuto({ automationId: auto._id as Id<"automations">, enabled: !auto.enabled })}
                style={{
                  padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                  background: auto.enabled ? "rgba(34,197,94,0.1)" : "var(--surface3)",
                  color: auto.enabled ? "var(--status-success)" : "var(--text-dim)",
                  border: `1px solid ${auto.enabled ? "rgba(34,197,94,0.3)" : "var(--border2)"}`,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {auto.enabled ? t.automationsTab.on : t.automationsTab.off}
              </button>

              {confirmDelete === auto._id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => { removeAuto({ automationId: auto._id as Id<"automations"> }); setConfirmDelete(null); }} style={{
                    fontSize: 10, padding: "4px 8px", borderRadius: 4,
                    background: "var(--status-danger)", color: "#fff",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>Delete</button>
                  <button onClick={() => setConfirmDelete(null)} style={{
                    fontSize: 10, padding: "4px 8px", borderRadius: 4,
                    background: "var(--surface3)", color: "var(--text-muted)",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                  }}>No</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(auto._id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4 }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomFieldsTab() {
  const { t } = useLocale();
  const { orgId, user } = useAuth();
  const fieldDefs   = useQuery(api.customFields.listDefs, orgId ? { orgId } : "skip") ?? [];
  const createDef   = useMutation(api.customFields.createDef);
  const updateDef   = useMutation(api.customFields.updateDef);
  const deleteDef   = useMutation(api.customFields.deleteDef);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", fieldType: "text", options: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const FIELD_TYPES = [
    { id: "text",     label: "Text" },
    { id: "number",   label: "Number" },
    { id: "select",   label: "Dropdown" },
    { id: "date",     label: "Date" },
    { id: "checkbox", label: "Checkbox" },
  ];

  const handleCreate = async () => {
    if (!orgId || !user || !form.name.trim()) return;
    const opts = form.fieldType === "select" && form.options.trim()
      ? form.options.split(",").map((o) => o.trim()).filter(Boolean)
      : undefined;
    await createDef({
      orgId,
      name:      form.name.trim(),
      fieldType: form.fieldType,
      options:   opts,
      createdBy: user.memberId as Id<"members">,
    });
    setForm({ name: "", fieldType: "text", options: "" });
    setCreating(false);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {fieldDefs.length} {t.customFields.fieldsDefined}
        </p>
        <button
          onClick={() => setCreating(!creating)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Plus size={13} /> {t.customFields.newField}
        </button>
      </div>

      {creating && (
        <div style={{
          background: "var(--surface2)", border: "1px solid var(--border2)",
          borderRadius: 10, padding: 16, marginBottom: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.customFields.fieldName}
              </label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t.customFields.fieldNamePlaceholder}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.customFields.type}
              </label>
              <select
                value={form.fieldType}
                onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", fontFamily: "inherit",
                }}
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.id} value={ft.id}>{ft.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.fieldType === "select" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>
                {t.customFields.optionsLabel}
              </label>
              <input
                value={form.options}
                onChange={(e) => setForm({ ...form, options: e.target.value })}
                placeholder={t.customFields.optionsPlaceholder}
                style={{
                  width: "100%", padding: "7px 10px", fontSize: 12,
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 6, color: "var(--text)", outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleCreate} disabled={!form.name.trim()} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: form.name.trim() ? "var(--accent)" : "var(--surface3)",
              color: "#fff", border: "none", cursor: form.name.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}>Create</button>
            <button onClick={() => { setCreating(false); setForm({ name: "", fieldType: "text", options: "" }); }} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 12,
              background: "var(--surface3)", color: "var(--text-muted)",
              border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>{t.cancel}</button>
          </div>
        </div>
      )}

      {fieldDefs.length === 0 && !creating && (
        <div style={{ textAlign: "center", padding: "50px 0", color: "var(--text-dim)" }}>
          <Sliders size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
          <p style={{ fontSize: 14, margin: "0 0 4px" }}>{t.customFields.noFields}</p>
          <p style={{ fontSize: 12, margin: 0 }}>{t.customFields.fieldNamePlaceholder}</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fieldDefs.map((def: any) => (
          <div key={def._id} style={{
            background: "var(--surface)", border: "1px solid var(--border2)",
            borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{def.name}</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                  background: "var(--surface3)", color: "var(--text-dim)",
                  textTransform: "uppercase",
                }}>
                  {FIELD_TYPES.find((ft) => ft.id === def.fieldType)?.label ?? def.fieldType}
                </span>
              </div>
              {def.fieldType === "select" && def.options && (
                <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {def.options.map((opt: string) => (
                    <span key={opt} style={{
                      padding: "1px 6px", borderRadius: 3, background: "var(--surface2)",
                      border: "1px solid var(--border)", fontSize: 10,
                    }}>
                      {opt}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {confirmDelete === def._id ? (
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => { deleteDef({ fieldId: def._id as Id<"customFieldDefs"> }); setConfirmDelete(null); }} style={{
                  fontSize: 10, padding: "4px 8px", borderRadius: 4,
                  background: "var(--status-danger)", color: "#fff",
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                }}>Delete</button>
                <button onClick={() => setConfirmDelete(null)} style={{
                  fontSize: 10, padding: "4px 8px", borderRadius: 4,
                  background: "var(--surface3)", color: "var(--text-muted)",
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                }}>Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(def._id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 4, flexShrink: 0 }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

// Tab labels will be translated in the component below
function getTabs(t: any) {
  return [
    { id: "team",          label: t.settings.tabs.team,          icon: <Users size={13} />    },
    { id: "permissions",   label: t.settings.tabs.permissions,   icon: <Shield size={13} />   },
    { id: "automations",   label: t.settings.tabs.automations,   icon: <Zap size={13} />      },
    { id: "custom_fields", label: t.settings.tabs.customFields, icon: <Sliders size={13} />  },
    { id: "workspace",     label: t.settings.tabs.workspace,     icon: <Settings size={13} /> },
  ] as const;
}

type TabId = "team" | "permissions" | "automations" | "custom_fields" | "workspace";

export default function SettingsPage() {
  const { t } = useLocale();
  const { isLoading, can } = useAuth();
  const [tab, setTab] = useState<TabId>("team");

  if (isLoading) return null;
  if (!can("settings.edit")) return (
    <div className="flex h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 flex items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>{t.adminAccessRequired}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <div style={{ padding: "28px 32px", maxWidth: 780 }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.settings.title}</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{t.settings.subtitle}</p>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
            {getTabs(t).map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none", background: "transparent",
                  color: tab === tabItem.id ? "var(--text)" : "var(--text-muted)",
                  borderBottom: tab === tabItem.id ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.15s",
                }}
              >
                {tabItem.icon} {tabItem.label}
              </button>
            ))}
          </div>

          {tab === "team"          && <TeamTab />}
          {tab === "permissions"   && <PermissionsTab />}
          {tab === "automations"   && <AutomationsTab />}
          {tab === "custom_fields" && <CustomFieldsTab />}
          {tab === "workspace"     && <WorkspaceTab />}
        </div>
      </div>
    </div>
  );
}
