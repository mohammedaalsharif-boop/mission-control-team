"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import {
  CheckSquare, CalendarDays, AlertCircle, Clock,
  ChevronDown, ChevronRight, Folder, ArrowRight,
} from "lucide-react";

// ── Status config ──────────────────────────────────────────────────────────

type StatusKey = "draft" | "in_progress" | "submitted" | "approved" | "completed";

function getStatusConfig(t: any) {
  return {
    draft:       { label: t.myTasks.toDo,       color: "var(--text-muted)",      bg: "rgba(113,113,122,0.15)" },
    in_progress: { label: t.myTasks.inProgress,  color: "#3b82f6",               bg: "rgba(59,130,246,0.10)" },
    submitted:   { label: t.myTasks.submitted,    color: "#d97706",               bg: "rgba(245,158,11,0.10)" },
    approved:    { label: t.myTasks.approved,     color: "#0d9488",               bg: "rgba(13,148,136,0.10)" },
    completed:   { label: t.myTasks.completed,    color: "var(--text-dim)",        bg: "var(--surface3)" },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ms: number, locale: string): string {
  const dateLocale = locale === "ar" ? "ar-SA" : "en-US";
  return new Date(ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
}

function isOverdue(task: Doc<"tasks">): boolean {
  if (!task.submissionDate || task.status === "completed" || task.status === "submitted") return false;
  const submissionEod = new Date(task.submissionDate);
  submissionEod.setHours(23,59,59,999);
  return submissionEod.getTime() < Date.now();
}

function isDueSoon(task: Doc<"tasks">): boolean {
  if (!task.submissionDate) return false;
  const diff = task.submissionDate - Date.now();
  return diff > 0 && diff <= 24 * 60 * 60 * 1000 && task.status !== "completed";
}

// ── Summary cards ──────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  count,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: bgColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color, margin: 0, lineHeight: 1.1 }}>{count}</p>
        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "2px 0 0", fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

// ── Task row ───────────────────────────────────────────────────────────────

function TaskRow({ task, projectName, locale, t }: {
  task: Doc<"tasks">;
  projectName: string;
  locale: string;
  t: any;
}) {
  const router = useRouter();
  const cfg = getStatusConfig(t)[task.status as StatusKey] ?? getStatusConfig(t).draft;
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);

  return (
    <div
      onClick={() => router.push(`/tasks/${task._id}`)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        cursor: "pointer", transition: "background 0.1s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Status dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
        background: cfg.color,
      }} />

      {/* Title */}
      <span style={{
        flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 500,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {task.title}
      </span>

      {/* Project name */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, width: 150, flexShrink: 0 }}>
        <Folder size={11} style={{ color: "var(--text-dim)" }} />
        <span style={{
          fontSize: 11, color: "var(--text-muted)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {projectName}
        </span>
      </div>

      {/* Status pill */}
      <span style={{
        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
        background: cfg.bg, color: cfg.color, width: 90, textAlign: "center", flexShrink: 0,
      }}>
        {cfg.label}
      </span>

      {/* Priority */}
      {task.priority && (
        <div style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: task.priority === "high" ? "var(--status-danger)"
            : task.priority === "medium" ? "var(--status-warning)"
            : "var(--status-success)",
        }} />
      )}

      {/* Due date */}
      <div style={{ width: 90, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {task.submissionDate ? (
          <>
            <CalendarDays size={11} style={{
              color: overdue ? "var(--status-danger)" : dueSoon ? "var(--status-warning)" : "var(--text-dim)",
            }} />
            <span style={{
              fontSize: 11,
              color: overdue ? "var(--status-danger)" : dueSoon ? "var(--status-warning)" : "var(--text-muted)",
              fontWeight: overdue || dueSoon ? 600 : 400,
            }}>
              {formatDate(task.submissionDate, locale)}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>
        )}
      </div>

      <ArrowRight size={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const { user, orgId } = useAuth();
  const { t, locale } = useLocale();
  const router = useRouter();

  const memberId = user?.memberId as Id<"members"> | undefined;

  const tasks = useQuery(
    api.tasks.listTasksByMember,
    memberId ? { memberId } : "skip"
  ) ?? [];

  const allProjects = useQuery(
    api.projects.listAll,
    orgId ? { orgId } : "skip"
  ) ?? [];
  const projectMap: Record<string, string> = {};
  for (const p of allProjects) {
    projectMap[p._id] = p.name;
  }

  // Filter out completed unless user wants to see them
  const [showCompleted, setShowCompleted] = useState(false);
  const [groupBy, setGroupBy] = useState<"status" | "project">("status");

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const overdueTasks = activeTasks.filter(isOverdue);
  const dueSoonTasks = activeTasks.filter(isDueSoon);

  const displayTasks = showCompleted ? tasks : activeTasks;

  // Group by status
  const statusOrder: StatusKey[] = ["draft", "in_progress", "submitted", "approved", ...(showCompleted ? ["completed" as StatusKey] : [])];
  const groupedByStatus: Record<StatusKey, Doc<"tasks">[]> = {
    draft: [], in_progress: [], submitted: [], approved: [], completed: [],
  };
  for (const task of displayTasks) {
    const s = task.status as StatusKey;
    if (groupedByStatus[s]) groupedByStatus[s].push(task);
  }

  // Group by project
  const groupedByProject: Record<string, { name: string; tasks: Doc<"tasks">[] }> = {};
  for (const task of displayTasks) {
    const pid = task.projectId ?? "no-project";
    if (!groupedByProject[pid]) {
      groupedByProject[pid] = { name: projectMap[pid] ?? t.myTasks.noProject, tasks: [] };
    }
    groupedByProject[pid].tasks.push(task);
  }

  if (!user) {
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{t.loading}…</p>
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          padding: "20px 28px 0",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <CheckSquare size={18} style={{ color: "var(--accent-light)" }} />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
              {t.myTasks.title}
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "var(--text-dim)",
              background: "var(--surface3)", borderRadius: 5, padding: "2px 8px",
              marginLeft: 4,
            }}>
              {activeTasks.length} {t.myTasks.active}
            </span>
          </div>

          {/* Summary cards */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <SummaryCard
              icon={<AlertCircle size={16} style={{ color: "var(--status-danger)" }} />}
              label={t.myTasks.overdue}
              count={overdueTasks.length}
              color="var(--status-danger)"
              bgColor="rgba(239,68,68,0.08)"
            />
            <SummaryCard
              icon={<Clock size={16} style={{ color: "var(--status-warning)" }} />}
              label={t.myTasks.dueSoon}
              count={dueSoonTasks.length}
              color="var(--status-warning)"
              bgColor="rgba(245,158,11,0.08)"
            />
            <SummaryCard
              icon={<CheckSquare size={16} style={{ color: "#3b82f6" }} />}
              label={t.myTasks.inProgressLabel}
              count={groupedByStatus.in_progress.length}
              color="#3b82f6"
              bgColor="rgba(59,130,246,0.08)"
            />
            <SummaryCard
              icon={<CheckSquare size={16} style={{ color: "var(--status-success)" }} />}
              label={t.myTasks.completedCount}
              count={completedTasks.length}
              color="var(--status-success)"
              bgColor="rgba(34,197,94,0.08)"
            />
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12 }}>
            {/* Group by toggle */}
            <div style={{ display: "flex", gap: 2, background: "var(--surface2)", borderRadius: 8, padding: 2 }}>
              {(["status", "project"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: groupBy === g ? "var(--surface)" : "transparent",
                    color: groupBy === g ? "var(--text)" : "var(--text-dim)",
                    border: groupBy === g ? "1px solid var(--border)" : "1px solid transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: groupBy === g ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  {g === "status" ? t.myTasks.byStatus : t.myTasks.byProject}
                </button>
              ))}
            </div>

            <label style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
              color: "var(--text-muted)", cursor: "pointer", marginLeft: "auto",
            }}>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              {t.myTasks.showCompleted}
            </label>
          </div>
        </div>

        {/* Task list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px 64px" }}>
          {displayTasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
              <CheckSquare size={32} style={{ color: "var(--text-dim)", marginBottom: 12 }} />
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-muted)", margin: "0 0 4px" }}>
                {t.myTasks.empty}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                {t.myTasks.emptyHint}
              </p>
            </div>
          ) : groupBy === "status" ? (
            statusOrder.map((status) => {
              const group = groupedByStatus[status];
              if (group.length === 0) return null;
              const cfg = getStatusConfig(t)[status];
              return (
                <TaskGroup
                  key={status}
                  label={cfg.label}
                  count={group.length}
                  color={cfg.color}
                  bg={cfg.bg}
                  tasks={group}
                  projectMap={projectMap}
                  locale={locale}
                  t={t}
                />
              );
            })
          ) : (
            Object.entries(groupedByProject).map(([pid, group]) => (
              <TaskGroup
                key={pid}
                label={group.name}
                count={group.tasks.length}
                color="var(--accent-light)"
                bg="rgba(99,102,241,0.08)"
                tasks={group.tasks}
                projectMap={projectMap}
                locale={locale}
                t={t}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

// ── Collapsible task group ─────────────────────────────────────────────────

function TaskGroup({
  label,
  count,
  color,
  bg,
  tasks,
  projectMap,
  locale,
  t,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  tasks: Doc<"tasks">[];
  projectMap: Record<string, string>;
  locale: string;
  t: any;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 12, overflow: "hidden", marginBottom: 12,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {open ? <ChevronDown size={13} style={{ color: "var(--text-dim)" }} /> : <ChevronRight size={13} style={{ color: "var(--text-dim)" }} />}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 5,
          background: bg, color,
        }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{count}</span>
      </button>

      {open && (
        <>
          {/* Column headers */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "4px 16px 4px 38px",
            borderBottom: "1px solid var(--border)",
            borderTop: "1px solid var(--border)",
          }}>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.myTasks.taskName}</span>
            <span style={{ width: 150, fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.myTasks.project}</span>
            <span style={{ width: 90, fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.myTasks.status}</span>
            <span style={{ width: 6 }} />
            <span style={{ width: 90, fontSize: 10, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.myTasks.due}</span>
            <span style={{ width: 12 }} />
          </div>

          {tasks.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              projectName={projectMap[task.projectId ?? ""] ?? t.myTasks.noProject}
              locale={locale}
              t={t}
            />
          ))}
        </>
      )}
    </div>
  );
}
