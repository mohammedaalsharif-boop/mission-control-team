"use client";

import { useMemo } from "react";
import {
  CheckCircle2, Clock, AlertTriangle, Send, FileText,
  TrendingUp, Users, Target,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

// ── Types ────────────────────────────────────────────────────────────────────

interface Task {
  _id: string;
  title: string;
  status: string;
  priority?: string;
  memberId: string;
  memberName: string;
  dueDate?: number;
  submissionDate?: number;
  createdAt: number;
}

interface Member {
  _id: string;
  name: string;
  role: string;
}

interface Project {
  name: string;
  northStar?: string;
  status: string;
  startDate?: number;
  dueDate?: number;
  estimatedCompletionDate?: number;
}

interface Props {
  project: Project;
  tasks: Task[];
  members: Member[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "var(--status-danger)",
  medium: "var(--status-warning)",
  low: "var(--status-success)",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: "To Do",       color: "var(--text-muted)",      bg: "rgba(113,113,122,0.10)" },
  in_progress: { label: "In Progress", color: "var(--status-info)",     bg: "rgba(59,130,246,0.10)" },
  submitted:   { label: "Submitted",   color: "var(--status-warning)",  bg: "rgba(245,158,11,0.10)" },
  completed:   { label: "Completed",   color: "var(--status-success)",  bg: "rgba(34,197,94,0.10)" },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ProjectOverview({ project, tasks, members }: Props) {
  const { locale } = useLocale();
  const now = Date.now();

  const stats = useMemo(() => {
    const total = tasks.length;
    const byStatus: Record<string, Task[]> = { draft: [], in_progress: [], submitted: [], completed: [] };
    let overdue = 0;
    let dueSoon = 0;
    const sevenDays = 7 * 86_400_000;

    for (const t of tasks) {
      if (byStatus[t.status]) byStatus[t.status].push(t);
      if (t.status !== "completed") {
        const due = t.dueDate ?? t.submissionDate;
        if (due && due < now) overdue++;
        else if (due && due < now + sevenDays) dueSoon++;
      }
    }

    const completed = byStatus.completed.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Member workload
    const memberWork: Record<string, { total: number; done: number }> = {};
    for (const t of tasks) {
      if (!memberWork[t.memberId]) memberWork[t.memberId] = { total: 0, done: 0 };
      memberWork[t.memberId].total++;
      if (t.status === "completed") memberWork[t.memberId].done++;
    }

    // Priority breakdown
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
    for (const t of tasks) {
      if (t.status !== "completed" && t.priority) {
        byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      }
    }

    return { total, completed, pct, overdue, dueSoon, byStatus, memberWork, byPriority };
  }, [tasks, now]);

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  // ── Card wrapper ──────────────────────────────────────────────────────────
  const Card = ({ title, icon, children, span }: {
    title: string; icon: React.ReactNode; children: React.ReactNode; span?: number;
  }) => (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
      borderRadius: 14, padding: "20px 22px",
      gridColumn: span ? `span ${span}` : undefined,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        maxWidth: 1100,
      }}>

        {/* ── Overall Progress ──────────────────────────────────────────── */}
        <Card title="Progress" icon={<TrendingUp size={15} style={{ color: "var(--accent-light)" }} />} span={2}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Circular progress */}
            <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
              <svg width={90} height={90} viewBox="0 0 90 90">
                <circle cx={45} cy={45} r={38} fill="none" stroke="var(--border)" strokeWidth={7} />
                <circle
                  cx={45} cy={45} r={38} fill="none"
                  stroke={stats.pct === 100 ? "var(--status-success)" : "var(--accent)"}
                  strokeWidth={7} strokeLinecap="round"
                  strokeDasharray={`${(stats.pct / 100) * 238.76} 238.76`}
                  transform="rotate(-90 45 45)"
                  style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  fontSize: 22, fontWeight: 800,
                  color: stats.pct === 100 ? "var(--status-success)" : "var(--text)",
                }}>
                  {stats.pct}%
                </span>
              </div>
            </div>

            {/* Status breakdown bars */}
            <div style={{ flex: 1 }}>
              {(["draft", "in_progress", "submitted", "completed"] as const).map((status) => {
                const cfg = STATUS_CONFIG[status];
                const count = stats.byStatus[status].length;
                const barPct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                return (
                  <div key={status} style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99, background: cfg.color,
                        width: `${barPct}%`, transition: "width 0.5s ease",
                        minWidth: barPct > 0 ? 4 : 0,
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact number strip */}
          <div style={{
            display: "flex", gap: 2, borderTop: "1px solid var(--border)", paddingTop: 14,
          }}>
            {[
              { label: "Total", value: stats.total, color: "var(--text)" },
              { label: "Done", value: stats.completed, color: "var(--status-success)" },
              { label: "Submitted", value: stats.byStatus.submitted.length, color: "var(--status-warning)" },
              { label: "Overdue", value: stats.overdue, color: "var(--status-danger)", hide: stats.overdue === 0 },
              { label: "Due soon", value: stats.dueSoon, color: "var(--status-warning)", hide: stats.dueSoon === 0 },
            ].filter((s) => !s.hide).map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, textAlign: "center" }}>
                <p style={{ fontSize: 20, fontWeight: 800, color, margin: 0, lineHeight: 1.2 }}>{value}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 500 }}>{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Dates & Timeline ──────────────────────────────────────────── */}
        <Card title="Timeline" icon={<Clock size={15} style={{ color: "var(--status-info)" }} />}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Start date", value: project.startDate ? formatDate(project.startDate) : "—" },
              { label: "Due date", value: project.dueDate ? formatDate(project.dueDate) : "—" },
              { label: "Est. completion", value: project.estimatedCompletionDate ? formatDate(project.estimatedCompletionDate) : "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* North Star */}
          {project.northStar && (
            <div style={{
              marginTop: 4, padding: "10px 12px",
              background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)",
              borderLeft: "3px solid var(--accent)", borderRadius: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Target size={11} style={{ color: "var(--accent-light)" }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent-light)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  North Star
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text)", margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>
                &ldquo;{project.northStar}&rdquo;
              </p>
            </div>
          )}
        </Card>

        {/* ── Priority Breakdown ──────────────────────────────────────── */}
        <Card title="Open by priority" icon={<AlertTriangle size={15} style={{ color: "var(--status-warning)" }} />}>
          {(["high", "medium", "low"] as const).map((pri) => {
            const count = stats.byPriority[pri] ?? 0;
            const openTotal = stats.total - stats.completed;
            const barPct = openTotal > 0 ? (count / openTotal) * 100 : 0;
            return (
              <div key={pri}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: PRIORITY_COLORS[pri], textTransform: "capitalize" }}>{pri}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>{count}</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99, background: PRIORITY_COLORS[pri],
                    width: `${barPct}%`, transition: "width 0.5s ease",
                    minWidth: barPct > 0 ? 4 : 0,
                  }} />
                </div>
              </div>
            );
          })}
        </Card>

        {/* ── Team Workload ──────────────────────────────────────────── */}
        <Card title="Team workload" icon={<Users size={15} style={{ color: "#8b5cf6" }} />} span={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members
              .filter((m) => stats.memberWork[m._id])
              .sort((a, b) => (stats.memberWork[b._id]?.total ?? 0) - (stats.memberWork[a._id]?.total ?? 0))
              .map((m) => {
                const w = stats.memberWork[m._id];
                const memberPct = w.total > 0 ? Math.round((w.done / w.total) * 100) : 0;
                return (
                  <div key={m._id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "var(--accent-light)",
                    }}>
                      {initials(m.name)}
                    </div>
                    {/* Name */}
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", minWidth: 90 }}>
                      {m.name}
                    </span>
                    {/* Progress bar */}
                    <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        background: memberPct === 100 ? "var(--status-success)" : "var(--accent)",
                        width: `${memberPct}%`, transition: "width 0.5s ease",
                        minWidth: memberPct > 0 ? 4 : 0,
                      }} />
                    </div>
                    {/* Stats */}
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", minWidth: 55, textAlign: "right" }}>
                      {w.done}/{w.total} done
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 32, textAlign: "right",
                      color: memberPct === 100 ? "var(--status-success)" : "var(--text-muted)",
                    }}>
                      {memberPct}%
                    </span>
                  </div>
                );
              })}
            {members.filter((m) => stats.memberWork[m._id]).length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>No tasks assigned yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
