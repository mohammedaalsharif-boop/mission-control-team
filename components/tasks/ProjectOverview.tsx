"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
  _id: string;
  name: string;
  description?: string;
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
  projectId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).toUpperCase();
}

function formatTime(ts: number, locale: string): string {
  return new Date(ts).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "numeric", minute: "2-digit",
  }).toLowerCase();
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Card shell ───────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid #e0e0e0",
      borderRadius: 6,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      minHeight: 260,
    }}>
      {/* Card title */}
      <div style={{
        borderBottom: "1px solid #e0e0e0",
        padding: "14px 18px",
        textAlign: "center",
      }}>
        <h3 style={{
          fontSize: 16, fontWeight: 700, color: "#1a1a1a",
          margin: 0, letterSpacing: "-0.01em",
        }}>
          {title}
        </h3>
      </div>
      {/* Card body */}
      <div style={{ flex: 1, padding: "12px 18px", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
    }}>
      {initials(name)}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProjectOverview({ project, tasks, members, projectId }: Props) {
  const { locale } = useLocale();
  const now = Date.now();

  // Fetch comments and activities for this project
  const activities = useQuery(
    api.tasks.getProjectActivities,
    { projectId: projectId as Id<"projects"> },
  ) ?? [];

  // ── Derived data ──────────────────────────────────────────────────────────

  const todosByStatus = useMemo(() => {
    const groups: Record<string, Task[]> = {
      draft: [], in_progress: [], submitted: [], completed: [],
    };
    for (const t of tasks) {
      if (groups[t.status]) groups[t.status].push(t);
    }
    return groups;
  }, [tasks]);

  const schedule = useMemo(() => {
    return tasks
      .filter((t) => {
        const due = t.dueDate ?? t.submissionDate;
        return due && t.status !== "completed";
      })
      .sort((a, b) => {
        const aD = a.dueDate ?? a.submissionDate ?? 0;
        const bD = b.dueDate ?? b.submissionDate ?? 0;
        return aD - bD;
      })
      .slice(0, 8);
  }, [tasks]);

  const recentActivity = useMemo(() => activities.slice(0, 8), [activities]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => {
      const due = t.dueDate ?? t.submissionDate;
      return due && due < now && t.status !== "completed";
    }).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, overdue, pct };
  }, [tasks, now]);

  // ── Project members (with tasks) for avatar row ───────────────────────────

  const projectMembers = useQuery(
    api.projects.listMembers,
    { projectId: projectId as Id<"projects"> },
  ) ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      flex: 1, overflowY: "auto",
      background: "#f6f6f4",
    }}>
      {/* ── Header area ─────────────────────────────────────────────────── */}
      <div style={{
        textAlign: "center",
        padding: "32px 28px 24px",
      }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: "#1a1a1a",
          margin: 0, letterSpacing: "-0.02em",
        }}>
          {project.name}
        </h1>
        {project.description && (
          <p style={{ fontSize: 14, color: "#666", margin: "6px 0 0" }}>
            {project.description}
          </p>
        )}

        {/* Member avatar row */}
        {projectMembers.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 0, marginTop: 18, flexWrap: "wrap",
          }}>
            {projectMembers.map((m: any, i: number) => (
              <div
                key={m._id}
                title={m.name}
                style={{ marginLeft: i > 0 ? -6 : 0, position: "relative", zIndex: projectMembers.length - i }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: avatarColor(m.name),
                  border: "2px solid #f6f6f4",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff",
                  cursor: "default",
                }}>
                  {initials(m.name)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Card grid ────────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        padding: "0 28px 32px",
        maxWidth: 1100,
        margin: "0 auto",
      }}>

        {/* ── To-dos ──────────────────────────────────────────────────── */}
        <Card title="To-dos">
          {(["draft", "in_progress", "submitted"] as const).map((status) => {
            const items = todosByStatus[status];
            if (items.length === 0) return null;
            const label = status === "draft" ? "To Do"
              : status === "in_progress" ? "In Progress"
              : "Submitted";
            return (
              <div key={status} style={{ marginBottom: 14 }}>
                <p style={{
                  fontSize: 13, fontWeight: 700, color: "#1a1a1a",
                  margin: "0 0 6px",
                }}>
                  {label}
                </p>
                {items.slice(0, 5).map((t) => (
                  <div key={t._id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 0",
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                      border: "1.5px solid #ccc", background: "#fff",
                    }} />
                    <span style={{
                      fontSize: 13, color: "#333", flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {t.title}
                    </span>
                    {t.memberName && (
                      <Avatar name={t.memberName} size={20} />
                    )}
                  </div>
                ))}
                {items.length > 5 && (
                  <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>
                    +{items.length - 5} more
                  </p>
                )}
              </div>
            );
          })}
          {/* Completed */}
          {todosByStatus.completed.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <p style={{
                fontSize: 13, fontWeight: 700, color: "#1a1a1a",
                margin: "0 0 6px",
              }}>
                Completed
              </p>
              {todosByStatus.completed.slice(0, 3).map((t) => (
                <div key={t._id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 0",
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                    border: "1.5px solid #22c55e", background: "#22c55e",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5L4 7.5L8 3" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span style={{
                    fontSize: 13, color: "#999",
                    textDecoration: "line-through",
                    flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.title}
                  </span>
                </div>
              ))}
              {todosByStatus.completed.length > 3 && (
                <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>
                  +{todosByStatus.completed.length - 3} more
                </p>
              )}
            </div>
          )}
          {tasks.length === 0 && (
            <p style={{ fontSize: 13, color: "#999", margin: 0 }}>No tasks yet</p>
          )}
        </Card>

        {/* ── Schedule ────────────────────────────────────────────────── */}
        <Card title="Schedule">
          {schedule.length === 0 ? (
            <p style={{ fontSize: 13, color: "#999", margin: 0 }}>No upcoming deadlines</p>
          ) : (
            schedule.map((t, i) => {
              const due = t.dueDate ?? t.submissionDate ?? 0;
              const isOverdue = due < now;
              const prevDue = i > 0 ? (schedule[i - 1].dueDate ?? schedule[i - 1].submissionDate ?? 0) : 0;
              const showDate = i === 0 || formatDate(due, locale) !== formatDate(prevDue, locale);

              return (
                <div key={t._id}>
                  {showDate && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      marginTop: i > 0 ? 12 : 0, marginBottom: 6,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isOverdue ? "#ef4444" : "#666",
                        letterSpacing: "0.02em",
                      }}>
                        {isOverdue ? "📅 " : "📅 "}{formatDate(due, locale)}
                      </span>
                    </div>
                  )}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 0 4px 16px",
                  }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                      border: `1.5px solid ${isOverdue ? "#ef4444" : "#ccc"}`,
                      background: "#fff",
                    }} />
                    <span style={{
                      fontSize: 13, flex: 1,
                      color: isOverdue ? "#ef4444" : "#333",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {t.title}
                    </span>
                    {t.memberName && <Avatar name={t.memberName} size={20} />}
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* ── Progress ────────────────────────────────────────────────── */}
        <Card title="Progress">
          {/* Big percentage */}
          <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <p style={{
              fontSize: 48, fontWeight: 800, margin: 0, lineHeight: 1,
              color: stats.pct === 100 ? "#22c55e" : "#1a1a1a",
            }}>
              {stats.pct}%
            </p>
            <p style={{ fontSize: 12, color: "#999", margin: "4px 0 0" }}>
              {stats.completed}/{stats.total} tasks done
            </p>
          </div>
          {/* Progress bar */}
          <div style={{
            height: 8, borderRadius: 99, background: "#e5e5e5", overflow: "hidden",
            marginBottom: 16,
          }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: stats.pct === 100 ? "#22c55e" : "#6366f1",
              width: `${stats.pct}%`, transition: "width 0.5s ease",
            }} />
          </div>
          {/* Stat rows */}
          {[
            { label: "Overdue", value: stats.overdue, color: "#ef4444", hide: stats.overdue === 0 },
            { label: "In progress", value: todosByStatus.in_progress.length, color: "#3b82f6" },
            { label: "Submitted", value: todosByStatus.submitted.length, color: "#f59e0b" },
            { label: "To do", value: todosByStatus.draft.length, color: "#999" },
          ].filter((s) => !s.hide).map(({ label, value, color }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "5px 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#555" }}>{label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{value}</span>
            </div>
          ))}
        </Card>

        {/* ── Activity (like Campfire) ────────────────────────────────── */}
        <Card title="Activity">
          {recentActivity.length === 0 ? (
            <p style={{ fontSize: 13, color: "#999", margin: 0 }}>No activity yet</p>
          ) : (
            recentActivity.map((a: any) => (
              <div key={a._id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "6px 0",
                borderBottom: "1px solid #f0f0f0",
              }}>
                <Avatar name={a.memberName ?? "?"} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
                      {a.memberName ?? "Unknown"}
                    </span>
                    <span style={{ fontSize: 11, color: "#999" }}>
                      {formatTime(a.createdAt, locale)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 12, color: "#555", margin: "2px 0 0", lineHeight: 1.4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* ── Team ────────────────────────────────────────────────────── */}
        <Card title="Team">
          {members.filter((m) => {
            return tasks.some((t) => t.memberId === m._id);
          }).map((m) => {
            const mTasks = tasks.filter((t) => t.memberId === m._id);
            const mDone = mTasks.filter((t) => t.status === "completed").length;
            return (
              <div key={m._id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 0",
                borderBottom: "1px solid #f0f0f0",
              }}>
                <Avatar name={m.name} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 13, fontWeight: 600, color: "#1a1a1a",
                    margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {m.name}
                  </p>
                  <p style={{ fontSize: 11, color: "#999", margin: "1px 0 0", textTransform: "capitalize" }}>
                    {m.role}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>
                    {mDone}/{mTasks.length}
                  </span>
                  <p style={{ fontSize: 10, color: "#999", margin: 0 }}>done</p>
                </div>
              </div>
            );
          })}
          {members.filter((m) => tasks.some((t) => t.memberId === m._id)).length === 0 && (
            <p style={{ fontSize: 13, color: "#999", margin: 0 }}>No tasks assigned yet</p>
          )}
        </Card>

        {/* ── North Star ──────────────────────────────────────────────── */}
        <Card title="North Star">
          {project.northStar ? (
            <div style={{ padding: "8px 0" }}>
              <p style={{
                fontSize: 15, color: "#1a1a1a", margin: 0, lineHeight: 1.6,
                fontStyle: "italic", textAlign: "center",
              }}>
                &ldquo;{project.northStar}&rdquo;
              </p>
            </div>
          ) : (
            <p style={{
              fontSize: 13, color: "#999", margin: 0, textAlign: "center",
              padding: "16px 0",
            }}>
              No North Star set yet
            </p>
          )}
          {/* Quick timeline info */}
          <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 12, paddingTop: 12 }}>
            {[
              { label: "Start", value: project.startDate },
              { label: "Due", value: project.dueDate },
              { label: "Est. completion", value: project.estimatedCompletionDate },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", padding: "3px 0",
              }}>
                <span style={{ fontSize: 12, color: "#999" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: value ? "#333" : "#ccc" }}>
                  {value ? formatDate(value, locale) : "—"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
