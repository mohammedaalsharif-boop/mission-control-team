"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
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
  onSwitchView?: (view: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(ts: number, locale: string): string {
  return new Date(ts).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function fileIcon(contentType: string): string {
  if (contentType.startsWith("image/")) return "🖼️";
  if (contentType.includes("pdf")) return "📄";
  if (contentType.includes("spreadsheet") || contentType.includes("excel")) return "📊";
  if (contentType.includes("presentation") || contentType.includes("powerpoint")) return "📑";
  if (contentType.includes("word") || contentType.includes("document")) return "📝";
  if (contentType.includes("zip") || contentType.includes("archive")) return "📦";
  if (contentType.includes("video")) return "🎬";
  if (contentType.includes("audio")) return "🎵";
  return "📎";
}

// ── Card shell ───────────────────────────────────────────────────────────────

function Card({
  title,
  children,
  onClick,
  count,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        minHeight: 260,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
          e.currentTarget.style.borderColor = "var(--accent-muted)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Card title */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        padding: "14px 18px",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}>
        <h3 style={{
          fontSize: 16, fontWeight: 700, color: "var(--text)",
          margin: 0, letterSpacing: "-0.01em",
        }}>
          {title}
        </h3>
        {count !== undefined && count > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
            background: "var(--surface2)", padding: "2px 8px",
            borderRadius: 10,
          }}>
            {count}
          </span>
        )}
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

// ── Task row (shared between To-dos and Schedule) ───────────────────────────

function TaskRow({
  task,
  isCompleted,
  isOverdue,
  showAssignee,
  onClick,
}: {
  task: Task;
  isCompleted?: boolean;
  isOverdue?: boolean;
  showAssignee?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "5px 4px",
        borderRadius: 6,
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = "var(--surface2)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
        border: isCompleted ? "1.5px solid #22c55e" : `1.5px solid ${isOverdue ? "#ef4444" : "var(--border)"}`,
        background: isCompleted ? "#22c55e" : "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isCompleted && (
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
            <path d="M2 5.5L4 7.5L8 3" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span style={{
        fontSize: 13, flex: 1,
        color: isCompleted ? "var(--text-muted)" : isOverdue ? "#ef4444" : "var(--text)",
        textDecoration: isCompleted ? "line-through" : "none",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {task.title}
      </span>
      {showAssignee && task.memberName && (
        <Avatar name={task.memberName} size={20} />
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ text, icon }: { text: string; icon: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "32px 16px", gap: 8,
    }}>
      <span style={{ fontSize: 28, opacity: 0.5 }}>{icon}</span>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, textAlign: "center" }}>
        {text}
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ProjectOverview({ project, tasks, members, projectId, onSwitchView }: Props) {
  const { locale } = useLocale();
  const router = useRouter();
  const now = Date.now();

  // Fetch activities for this project
  const activities = useQuery(
    api.tasks.getProjectActivities,
    { projectId: projectId as Id<"projects"> },
  ) ?? [];

  // Fetch attachments for this project
  const attachments = useQuery(
    api.taskAttachments.listByProject,
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
      background: "var(--bg)",
    }}>
      {/* ── Header area ─────────────────────────────────────────────────── */}
      <div style={{
        textAlign: "center",
        padding: "32px 28px 24px",
      }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: "var(--text)",
          margin: 0, letterSpacing: "-0.02em",
        }}>
          {project.name}
        </h1>
        {project.description && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "6px 0 0" }}>
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
                  border: "2px solid var(--bg)",
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
        <Card
          title="To-dos"
          count={tasks.filter((t) => t.status !== "completed").length}
          onClick={() => onSwitchView?.("kanban")}
        >
          {(["draft", "in_progress", "submitted"] as const).map((status) => {
            const items = todosByStatus[status];
            if (items.length === 0) return null;
            const label = status === "draft" ? "To Do"
              : status === "in_progress" ? "In Progress"
              : "Submitted";
            return (
              <div key={status} style={{ marginBottom: 14 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                  margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em",
                }}>
                  {label} ({items.length})
                </p>
                {items.slice(0, 5).map((t) => (
                  <TaskRow
                    key={t._id}
                    task={t}
                    showAssignee
                    onClick={() => {
                      router.push(`/tasks/${t._id}`);
                    }}
                  />
                ))}
                {items.length > 5 && (
                  <p style={{
                    fontSize: 11, color: "var(--accent-light)", margin: "6px 0 0",
                    cursor: "pointer", fontWeight: 600,
                  }}>
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
                fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.04em",
              }}>
                Completed ({todosByStatus.completed.length})
              </p>
              {todosByStatus.completed.slice(0, 3).map((t) => (
                <TaskRow
                  key={t._id}
                  task={t}
                  isCompleted
                  onClick={(e: any) => {
                    e?.stopPropagation?.();
                    router.push(`/tasks/${t._id}`);
                  }}
                />
              ))}
              {todosByStatus.completed.length > 3 && (
                <p style={{
                  fontSize: 11, color: "var(--accent-light)", margin: "6px 0 0",
                  fontWeight: 600,
                }}>
                  +{todosByStatus.completed.length - 3} more
                </p>
              )}
            </div>
          )}
          {tasks.length === 0 && (
            <EmptyState text="No tasks yet. Create your first task to get started." icon="📋" />
          )}
        </Card>

        {/* ── Schedule ────────────────────────────────────────────────── */}
        <Card
          title="Schedule"
          count={schedule.length}
          onClick={() => onSwitchView?.("calendar")}
        >
          {schedule.length === 0 ? (
            <EmptyState text="No upcoming deadlines" icon="📅" />
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
                      marginTop: i > 0 ? 12 : 0, marginBottom: 4,
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isOverdue ? "#ef4444" : "var(--text-muted)",
                        letterSpacing: "0.02em", textTransform: "uppercase",
                      }}>
                        {formatDate(due, locale)}
                      </span>
                      {isOverdue && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: "#fff",
                          background: "#ef4444", padding: "1px 5px",
                          borderRadius: 4, textTransform: "uppercase",
                        }}>
                          overdue
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{ paddingLeft: 8 }}>
                    <TaskRow
                      task={t}
                      isOverdue={isOverdue}
                      showAssignee
                      onClick={() => router.push(`/tasks/${t._id}`)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* ── Progress ────────────────────────────────────────────────── */}
        <Card title="Progress">
          {/* Big percentage */}
          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
            <p style={{
              fontSize: 52, fontWeight: 800, margin: 0, lineHeight: 1,
              color: stats.pct === 100 ? "#22c55e" : "var(--text)",
            }}>
              {stats.pct}%
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
              {stats.completed}/{stats.total} tasks done
            </p>
          </div>
          {/* Progress bar */}
          <div style={{
            height: 8, borderRadius: 99, background: "var(--surface2)", overflow: "hidden",
            marginBottom: 20,
          }}>
            <div style={{
              height: "100%", borderRadius: 99,
              background: stats.pct === 100 ? "#22c55e" : "var(--accent)",
              width: `${stats.pct}%`, transition: "width 0.5s ease",
            }} />
          </div>
          {/* Stat rows */}
          {[
            { label: "Overdue", value: stats.overdue, color: "#ef4444", hide: stats.overdue === 0 },
            { label: "In progress", value: todosByStatus.in_progress.length, color: "#3b82f6" },
            { label: "Submitted", value: todosByStatus.submitted.length, color: "#f59e0b" },
            { label: "To do", value: todosByStatus.draft.length, color: "var(--text-muted)" },
          ].filter((s) => !s.hide).map(({ label, value, color }) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{value}</span>
            </div>
          ))}
        </Card>

        {/* ── Activity ────────────────────────────────────────────────── */}
        <Card
          title="Activity"
          count={activities.length}
          onClick={() => onSwitchView?.("activity")}
        >
          {recentActivity.length === 0 ? (
            <EmptyState text="No activity yet" icon="📢" />
          ) : (
            recentActivity.map((a: any) => (
              <div key={a._id} style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "7px 0",
                borderBottom: "1px solid var(--border)",
              }}>
                <Avatar name={a.memberName ?? "?"} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      {a.memberName ?? "Unknown"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {formatRelative(a.createdAt)}
                    </span>
                  </div>
                  <p style={{
                    fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0", lineHeight: 1.4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* ── Docs & Files ────────────────────────────────────────────── */}
        <Card title="Docs & Files" count={attachments.length}>
          {attachments.length === 0 ? (
            <EmptyState text="No files uploaded yet. Attach files to tasks to see them here." icon="📁" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {attachments.slice(0, 10).map((file: any) => {
                const isImage = file.contentType?.startsWith("image/");
                return (
                  <a
                    key={file._id}
                    href={file.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 6px",
                      borderRadius: 6,
                      textDecoration: "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Thumbnail or icon */}
                    {isImage && file.url ? (
                      <div style={{
                        width: 36, height: 36, borderRadius: 6, overflow: "hidden",
                        border: "1px solid var(--border)", flexShrink: 0,
                        background: "var(--surface2)",
                      }}>
                        <img
                          src={file.url}
                          alt={file.fileName}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 6, flexShrink: 0,
                        background: "var(--surface2)", border: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18,
                      }}>
                        {fileIcon(file.contentType ?? "")}
                      </div>
                    )}
                    {/* File info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: "var(--text)",
                        margin: 0, overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {file.fileName}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "1px 0 0" }}>
                        {formatFileSize(file.size)} · {file.taskTitle}
                      </p>
                    </div>
                  </a>
                );
              })}
              {attachments.length > 10 && (
                <p style={{
                  fontSize: 11, color: "var(--accent-light)", margin: "8px 0 0",
                  fontWeight: 600, textAlign: "center",
                }}>
                  +{attachments.length - 10} more files
                </p>
              )}
            </div>
          )}
        </Card>

        {/* ── Team ────────────────────────────────────────────────────── */}
        <Card title="Team" count={projectMembers.length}>
          {projectMembers.length === 0 ? (
            <EmptyState text="No team members assigned yet" icon="👥" />
          ) : (
            projectMembers.map((m: any) => {
              const mTasks = tasks.filter((t) => t.memberId === m._id);
              const mDone = mTasks.filter((t) => t.status === "completed").length;
              const mPct = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
              return (
                <div
                  key={m._id}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 4px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    borderRadius: 6,
                    transition: "background 0.1s",
                  }}
                  onClick={() => router.push(`/members/${m._id}`)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Avatar name={m.name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: "var(--text)",
                      margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {m.name}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "1px 0 0", textTransform: "capitalize" }}>
                      {m.role}
                    </p>
                  </div>
                  {/* Mini progress */}
                  {mTasks.length > 0 && (
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: 48 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                        {mDone}/{mTasks.length}
                      </span>
                      <div style={{
                        width: 48, height: 4, borderRadius: 99,
                        background: "var(--surface2)", overflow: "hidden", marginTop: 4,
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 99,
                          background: mPct === 100 ? "#22c55e" : "var(--accent)",
                          width: `${mPct}%`,
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Card>

        {/* ── North Star ──────────────────────────────────────────────── */}
        <Card title="North Star">
          {project.northStar ? (
            <div style={{ padding: "12px 0" }}>
              <p style={{
                fontSize: 15, color: "var(--text)", margin: 0, lineHeight: 1.6,
                fontStyle: "italic", textAlign: "center",
              }}>
                &ldquo;{project.northStar}&rdquo;
              </p>
            </div>
          ) : (
            <EmptyState text="Set a North Star to keep the team aligned on the big picture goal" icon="⭐" />
          )}
          {/* Quick timeline info */}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            {[
              { label: "Start", value: project.startDate },
              { label: "Due", value: project.dueDate },
              { label: "Est. completion", value: project.estimatedCompletionDate },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between", padding: "4px 0",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: value ? "var(--text)" : "var(--text-dim)" }}>
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
