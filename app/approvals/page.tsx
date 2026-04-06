"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import {
  CheckCircle, XCircle, Clock, CheckCheck,
  History, ClipboardList, ChevronDown, ChevronUp,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts: number, locale: string) {
  return new Date(ts).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(ts: number, locale: string) {
  return new Date(ts).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function weekLabel(ts: number, locale: string) {
  const d   = new Date(ts);
  const day = d.getDay(); // 0=Sun
  const sun = new Date(d); sun.setDate(d.getDate() - day);
  const thu = new Date(sun); thu.setDate(sun.getDate() + 4);
  const sunStr = sun.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" });
  const thuStr = thu.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  return `Week of ${sunStr} – ${thuStr}`;
}

// ── Pending tab ──────────────────────────────────────────────────────────────

function PendingTab({ t, locale }: { t: any; locale: string }) {
  const { orgId } = useAuth();
  const submittedArgs = orgId ? { orgId, status: "submitted" } : "skip" as const;
  const submitted    = useQuery(api.tasks.listTasksByStatus, submittedArgs) ?? [];
  const approveTask  = useMutation(api.tasks.approveTask);
  const rejectTask   = useMutation(api.tasks.rejectTask);
  const approveAll   = useMutation(api.tasks.approveAllSubmitted);

  const [rejectingId,  setRejectingId]  = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  return (
    <div>
      {/* Sub-header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
          {submitted.length} task{submitted.length !== 1 ? "s" : ""} {t.approvalsPage.pendingYourReview}
        </p>
        {submitted.length > 1 && (
          <button
            onClick={() => orgId && approveAll({ orgId })}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "var(--status-success)", color: "#fff", border: "none", cursor: "pointer",
            }}
          >
            <CheckCheck size={15} /> {t.approvalsPage.approveAll} ({submitted.length})
          </button>
        )}
      </div>

      {submitted.length === 0 ? (
        <div style={{
          border: "1px dashed var(--border2)", borderRadius: 14,
          padding: "48px 24px", textAlign: "center",
        }}>
          <CheckCircle size={32} style={{ color: "var(--status-success)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{t.approvalsPage.allCaughtUp}</p>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{t.approvalsPage.noTasksPending}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {submitted.map((task: any) => (
            <div key={task._id} style={{
              background: "var(--surface)",
              border: "1px solid var(--border2)",
              borderRadius: 14, padding: "18px 20px",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: "var(--accent-light)",
                    }}>
                      {task.memberName[0]?.toUpperCase()}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-light)" }}>{task.memberName}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {t.approvalsPage.submitted} {fmtDate(task.submittedAt ?? task.updatedAt, locale)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 8px", lineHeight: 1.5 }}>
                      {task.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {task.tag && (
                      <span style={{
                        fontSize: 10, fontWeight: 500, color: "var(--accent-light)",
                        background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.2)",
                        borderRadius: 4, padding: "2px 7px",
                      }}>{task.tag}</span>
                    )}
                    {task.submissionDate && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} /> {t.approvalsPage.due} {fmtDate(task.submissionDate, locale)}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color:       task.priority === "high" ? "var(--status-danger)" : task.priority === "low" ? "var(--status-success)" : "var(--status-warning)",
                      background:  task.priority === "high" ? "rgba(239,68,68,0.1)" : task.priority === "low" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                      borderRadius: 4, padding: "2px 7px",
                    }}>
                      {task.priority ?? "medium"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => approveTask({ taskId: task._id })}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "var(--status-success)", color: "#fff", border: "none", cursor: "pointer",
                    }}
                  >
                    <CheckCircle size={14} /> {t.approvalsPage.approve}
                  </button>
                  <button
                    onClick={() => { setRejectingId(task._id); setRejectReason(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "rgba(239,68,68,0.12)", color: "var(--status-danger)",
                      border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer",
                    }}
                  >
                    <XCircle size={14} /> {t.approvalsPage.reject}
                  </button>
                </div>
              </div>

              {rejectingId === task._id && (
                <div style={{
                  marginTop: 14, padding: "14px", background: "var(--surface2)",
                  border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <textarea
                    autoFocus
                    placeholder={t.approvalsPage.feedbackPlaceholder}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    style={{
                      width: "100%", background: "var(--surface3)", border: "1px solid var(--border2)",
                      borderRadius: 8, padding: "8px 12px", fontSize: 13,
                      color: "var(--text)", outline: "none", resize: "none", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => { rejectTask({ taskId: task._id, reason: rejectReason || undefined }); setRejectingId(null); }}
                      style={{
                        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: "var(--status-danger)", color: "#fff", border: "none", cursor: "pointer",
                      }}
                    >
                      {t.approvalsPage.sendBack}
                    </button>
                    <button
                      onClick={() => setRejectingId(null)}
                      style={{
                        padding: "6px 12px", borderRadius: 7, fontSize: 12,
                        background: "var(--surface3)", color: "var(--text-muted)",
                        border: "1px solid var(--border2)", cursor: "pointer",
                      }}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ t, locale }: { t: any; locale: string }) {
  const { orgId } = useAuth();
  const historyArgs = orgId ? { orgId } : "skip" as const;
  const history = useQuery(api.tasks.listApprovalHistory, historyArgs) ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterMember, setFilterMember] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<"all" | "approved" | "rejected">("all");

  // Unique member names for filter
  const memberNames = Array.from(new Set(history.map((tk: any) => tk.memberName))).sort();

  // Build flat event list — a task can have both approved and rejected events
  type HistoryEvent = {
    key:       string;
    taskId:    string;
    taskTitle: string;
    memberName: string;
    action:    "approved" | "rejected";
    date:      number;
    reason?:   string;
    priority?: string;
    tag?:      string;
  };

  const events: HistoryEvent[] = [];
  for (const tk of history) {
    if (tk.approvedAt) {
      events.push({
        key:        `${tk._id}-approved`,
        taskId:     tk._id,
        taskTitle:  tk.title,
        memberName: tk.memberName,
        action:     "approved",
        date:       tk.approvedAt,
        priority:   tk.priority,
        tag:        tk.tag,
      });
    }
    if (tk.rejectedAt) {
      events.push({
        key:        `${tk._id}-rejected`,
        taskId:     tk._id,
        taskTitle:  tk.title,
        memberName: tk.memberName,
        action:     "rejected",
        date:       tk.rejectedAt,
        reason:     tk.rejectionReason,
        priority:   tk.priority,
        tag:        tk.tag,
      });
    }
  }

  // Sort newest first
  events.sort((a, b) => b.date - a.date);

  // Apply filters
  const filtered = events.filter((e) => {
    if (filterMember !== "all" && e.memberName !== filterMember) return false;
    if (filterAction !== "all" && e.action !== filterAction) return false;
    return true;
  });

  // Group by week
  const weeks: { label: string; events: HistoryEvent[] }[] = [];
  for (const ev of filtered) {
    const label = weekLabel(ev.date, locale);
    const last  = weeks[weeks.length - 1];
    if (last && last.label === label) {
      last.events.push(ev);
    } else {
      weeks.push({ label, events: [ev] });
    }
  }

  // Summary counts
  const totalApproved = events.filter((e) => e.action === "approved").length;
  const totalRejected = events.filter((e) => e.action === "rejected").length;

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {[
          { label: t.approvalsPage.totalApproved, value: totalApproved, color: "var(--status-success)", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" },
          { label: t.approvalsPage.totalSentBack, value: totalRejected, color: "var(--status-danger)", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" },
          { label: t.approvalsPage.approvalRate,
            value: totalApproved + totalRejected > 0
              ? `${Math.round((totalApproved / (totalApproved + totalRejected)) * 100)}%`
              : "—",
            color: "var(--accent-light)", bg: "var(--accent-subtle)", border: "rgba(99,102,241,0.2)" },
        ].map((s) => (
          <div key={s.label} style={{
            flex: 1, padding: "12px 16px", borderRadius: 10,
            background: s.bg, border: `1px solid ${s.border}`,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select
          value={filterMember}
          onChange={(e) => setFilterMember(e.target.value)}
          style={{
            padding: "6px 10px", borderRadius: 7, fontSize: 12,
            background: "var(--surface2)", border: "1px solid var(--border2)",
            color: "var(--text)", outline: "none", cursor: "pointer",
          }}
        >
          <option value="all">{t.approvalsPage.allMembers}</option>
          {memberNames.map((n: string) => <option key={n} value={n}>{n}</option>)}
        </select>

        <div style={{ display: "flex", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 7, overflow: "hidden" }}>
          {(["all", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterAction(f)}
              style={{
                padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none",
                background: filterAction === f ? "var(--surface3)" : "transparent",
                color: filterAction === f
                  ? f === "approved" ? "var(--status-success)" : f === "rejected" ? "var(--status-danger)" : "var(--text)"
                  : "var(--text-muted)",
              }}
            >
              {f === "all" ? t.approvalsPage.all :
               f === "approved" ? t.approvalsPage.approved :
               t.approvalsPage.sentBack}
            </button>
          ))}
        </div>

        {filtered.length !== events.length && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>
            Showing {filtered.length} of {events.length}
          </span>
        )}
      </div>

      {/* Timeline */}
      {weeks.length === 0 ? (
        <div style={{
          border: "1px dashed var(--border2)", borderRadius: 14,
          padding: "48px 24px", textAlign: "center",
        }}>
          <History size={32} style={{ color: "var(--text-dim)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>{t.approvalsPage.noHistoryYet}</p>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{t.approvalsPage.noHistoryHint}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {weeks.map((week) => (
            <div key={week.label}>
              {/* Week header */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 10, paddingBottom: 6,
                borderBottom: "1px solid var(--border)",
              }}>
                {week.label}
                <span style={{ fontWeight: 400, marginLeft: 8 }}>({week.events.length} action{week.events.length !== 1 ? "s" : ""})</span>
              </div>

              {/* Events */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {week.events.map((ev) => {
                  const isApproved = ev.action === "approved";
                  const isExpanded = expandedId === ev.key;

                  return (
                    <div
                      key={ev.key}
                      style={{
                        background: "var(--surface)",
                        border: `1px solid ${isApproved ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                        borderLeft: `3px solid ${isApproved ? "var(--status-success)" : "var(--status-danger)"}`,
                        borderRadius: 10, padding: "12px 16px",
                        cursor: ev.reason ? "pointer" : "default",
                      }}
                      onClick={() => ev.reason && setExpandedId(isExpanded ? null : ev.key)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Icon */}
                        {isApproved
                          ? <CheckCircle size={15} style={{ color: "var(--status-success)", flexShrink: 0 }} />
                          : <XCircle    size={15} style={{ color: "var(--status-danger)", flexShrink: 0 }} />
                        }

                        {/* Member avatar */}
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
                        }}>
                          {ev.memberName[0]?.toUpperCase()}
                        </div>

                        {/* Main text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                            {ev.memberName}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 6px" }}>—</span>
                          <span style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ev.taskTitle}
                          </span>
                          {ev.tag && (
                            <span style={{
                              marginLeft: 8, fontSize: 10, color: "var(--accent-light)",
                              background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.2)",
                              borderRadius: 4, padding: "1px 6px",
                            }}>{ev.tag}</span>
                          )}
                        </div>

                        {/* Right side */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: isApproved ? "var(--status-success)" : "var(--status-danger)",
                            background: isApproved ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                            borderRadius: 5, padding: "2px 8px",
                          }}>
                            {isApproved ? t.approvalsPage.approved : t.approvalsPage.sentBack}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {fmtDateTime(ev.date, locale)}
                          </span>
                          {ev.reason && (
                            isExpanded
                              ? <ChevronUp size={13} style={{ color: "var(--text-dim)" }} />
                              : <ChevronDown size={13} style={{ color: "var(--text-dim)" }} />
                          )}
                        </div>
                      </div>

                      {/* Expanded rejection reason */}
                      {isExpanded && ev.reason && (
                        <div style={{
                          marginTop: 10, padding: "10px 12px",
                          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                          borderRadius: 7, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5,
                        }}>
                          <span style={{ fontWeight: 600, color: "var(--status-danger)", marginRight: 6 }}>{t.approvalsPage.feedback}:</span>
                          {ev.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { isAdmin, isManager, isLoading, orgId } = useAuth();
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const pendingCountArgs = orgId ? { orgId, status: "submitted" } : "skip" as const;
  const pendingCount = (useQuery(api.tasks.listTasksByStatus, pendingCountArgs) ?? []).length;

  if (isLoading) return null;
  if (!isAdmin && !isManager) return (
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
        <div style={{ padding: "28px 32px" }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.approvalsPage.title}</h1>
          </div>

          {/* Tab bar */}
          <div style={{
            display: "flex", gap: 2, marginBottom: 24,
            borderBottom: "1px solid var(--border)", paddingBottom: 0,
          }}>
            {([
              { id: "pending", icon: <ClipboardList size={13} />, label: t.approvalsPage.pending,
                badge: pendingCount > 0 ? pendingCount : null },
              { id: "history", icon: <History size={13} />, label: t.approvalsPage.history },
            ] as const).map((tb) => (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", border: "none", background: "transparent",
                  color: tab === tb.id ? "var(--text)" : "var(--text-muted)",
                  borderBottom: tab === tb.id ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.15s",
                }}
              >
                {tb.icon}
                {tb.label}
                {"badge" in tb && tb.badge != null && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: "var(--status-warning)", color: "#000",
                    borderRadius: 8, padding: "1px 6px", lineHeight: "16px",
                  }}>
                    {tb.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "pending" ? <PendingTab t={t} locale={locale} /> : <HistoryTab t={t} locale={locale} />}
        </div>
      </div>
    </div>
  );
}
