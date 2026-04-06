"use client";

import { TeamTask } from "@/lib/task-types";
import { useLocale } from "@/components/LocaleProvider";

interface Member {
  _id: string;
  name: string;
  role: string;
}

interface Props {
  tasks:   TeamTask[];
  members: Member[];
}

const STATUS_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  draft:       { bg: "rgba(113,113,122,0.12)", border: "rgba(113,113,122,0.3)",  text: "#a1a1aa" },
  in_progress: { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",   text: "#60a5fa" },
  submitted:   { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",   text: "#fbbf24" },
  completed:   { bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)",    text: "#4ade80" },
};

const PRIORITY_COLOR: Record<string, string> = {
  high:   "var(--status-danger)",
  medium: "var(--status-warning)",
  low:    "var(--status-success)",
};

const ACTIVE_STATUSES = new Set(["draft", "in_progress", "submitted"]);

function fmtDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" });
}

function TaskPill({ task }: { task: TeamTask }) {
  const now        = Date.now();
  const due        = task.submissionDate;
  const msInDay    = 86_400_000;
  const isActive   = ACTIVE_STATUSES.has(task.status);
  const isOverdue  = isActive && due && due.getTime() < now;
  const isDueSoon  = isActive && due && !isOverdue && due.getTime() - now <= msInDay;

  const s = STATUS_COLOR[task.status] ?? STATUS_COLOR.draft;
  const borderColor = isOverdue ? "var(--status-danger)" : isDueSoon ? "var(--status-warning)" : s.border;

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 9px", borderRadius: 6,
      background: s.bg, border: `1px solid ${borderColor}`,
      maxWidth: 200, flexShrink: 0,
    }}>
      {/* Priority dot */}
      <span style={{
        width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
        background: PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.medium,
      }} />

      {/* Title */}
      <span style={{
        fontSize: 11.5, fontWeight: 500, color: s.text,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        maxWidth: 130,
      }}>
        {task.title}
      </span>

      {/* Due date */}
      {due && (
        <span style={{
          fontSize: 10, color: isOverdue ? "var(--status-danger)" : isDueSoon ? "var(--status-warning)" : "var(--text-dim)",
          flexShrink: 0, fontWeight: isOverdue || isDueSoon ? 600 : 400,
        }}>
          {fmtDate(due, "en-US")}
        </span>
      )}
    </div>
  );
}

export default function WorkloadView({ tasks, members }: Props) {
  const { t, locale } = useLocale();
  const MAX_ACTIVE = 8; // bar scale max

  const loadLevel = (active: number): { color: string; label: string; barColor: string } => {
    if (active === 0) return { color: "#52525b", label: t.workload.noTasks,   barColor: "#3f3f46" };
    if (active <= 2)  return { color: "#4ade80", label: t.workload.light,      barColor: "var(--status-success)" };
    if (active <= 4)  return { color: "#fbbf24", label: t.workload.moderate,   barColor: "var(--status-warning)" };
    return              { color: "#f87171", label: t.workload.overloaded,  barColor: "var(--status-danger)" };
  };

  // Sort members: non-admin first, then by active task count desc
  const sorted = [...members]
    .filter((m) => m.role !== "admin")
    .map((m) => {
      const mine   = tasks.filter((tk) => tk.memberId === m._id);
      const active = mine.filter((tk) => ACTIVE_STATUSES.has(tk.status));
      // Sort tasks: active first by due date (nulls last), then completed
      const sortedTasks = [
        ...active.sort((a, b) => {
          if (!a.submissionDate && !b.submissionDate) return 0;
          if (!a.submissionDate) return 1;
          if (!b.submissionDate) return -1;
          return a.submissionDate.getTime() - b.submissionDate.getTime();
        }),
        ...mine.filter((tk) => tk.status === "completed"),
      ];
      return { member: m, tasks: sortedTasks, activeCount: active.length };
    })
    .sort((a, b) => b.activeCount - a.activeCount);

  // Also include admin's tasks if any
  const adminMembers = members.filter((m) => m.role === "admin");
  const adminRows = adminMembers
    .map((m) => {
      const mine   = tasks.filter((tk) => tk.memberId === m._id);
      const active = mine.filter((tk) => ACTIVE_STATUSES.has(tk.status));
      return { member: m, tasks: mine, activeCount: active.length };
    })
    .filter((r) => r.tasks.length > 0);

  const rows = [...sorted, ...adminRows];

  if (rows.length === 0) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-dim)", fontSize: 13,
      }}>
        {t.workload.noMembersYet}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: t.status.draft,       ...STATUS_COLOR.draft },
          { label: t.status.in_progress, ...STATUS_COLOR.in_progress },
          { label: t.status.submitted,   ...STATUS_COLOR.submitted },
          { label: t.status.completed,   ...STATUS_COLOR.completed },
        ].map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 10, height: 10, borderRadius: 3,
              background: s.bg, border: `1px solid ${s.border}`,
            }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--status-danger)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.workload.highPriority}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--status-warning)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.workload.mediumPriority}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--status-success)" }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.workload.lowPriority}</span>
        </div>
      </div>

      {/* Member rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ member, tasks: memberTasks, activeCount: mtActiveCount }) => {
          const { color, label, barColor } = loadLevel(mtActiveCount);
          const barPct = Math.min((mtActiveCount / MAX_ACTIVE) * 100, 100);

          return (
            <div
              key={member._id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              {/* Member info */}
              <div style={{ width: 160, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
                  }}>
                    {member.name[0]?.toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {member.name}
                  </span>
                </div>

                {/* Load bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: "var(--surface3)", overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${barPct}%`, height: "100%",
                      background: barColor, borderRadius: 2,
                      transition: "width 0.3s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {mtActiveCount} {t.workload.active}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2, display: "block" }}>
                  {label}
                </span>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 48, background: "var(--border)", flexShrink: 0 }} />

              {/* Task pills */}
              <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {memberTasks.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {t.workload.noTasksAssigned}
                  </span>
                ) : (
                  memberTasks.map((tk) => <TaskPill key={tk.id} task={tk} />)
                )}
              </div>

              {/* Total count */}
              <div style={{
                flexShrink: 0, textAlign: "right",
                borderLeft: "1px solid var(--border)", paddingLeft: 16,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>
                  {memberTasks.length}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{t.workload.tasks}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
