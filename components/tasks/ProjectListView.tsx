"use client";

import { useState } from "react";
import {
  ChevronRight, Plus, MoreHorizontal,
  Calendar, Tag, AlertCircle, FolderOpen,
} from "lucide-react";
import { TeamTask } from "@/lib/task-types";
import { useLocale } from "@/components/LocaleProvider";

// ── Types ───────────────────────────────────────────────────────────────────

interface Project {
  _id: string;
  name: string;
  status: string;
  priority?: string;
  description?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  draft:       "var(--text-muted)",
  in_progress: "var(--status-info)",
  submitted:   "var(--status-warning)",
  completed:   "var(--status-success)",
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   "var(--status-danger)",
  medium: "var(--status-warning)",
  low:    "var(--status-success)",
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  active:    "var(--status-success)",
  on_hold:   "var(--status-warning)",
  completed: "var(--accent-light)",
  archived:  "#6b7280",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts?: number | Date, locale: string = "en-US"): string {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  const dateLocale = locale === "ar" ? "ar-SA" : "en-US";
  return d.toLocaleDateString(dateLocale, { month: "short", day: "numeric" });
}

function isOverdue(task: TeamTask): boolean {
  if (!task.dueDate || task.status === "completed") return false;
  const due = task.dueDate instanceof Date ? task.dueDate.getTime() : (task.dueDate as unknown as number);
  return due < Date.now();
}

function isDueSoon(task: TeamTask): boolean {
  if (!task.dueDate || task.status === "completed") return false;
  const due = task.dueDate instanceof Date ? task.dueDate.getTime() : (task.dueDate as unknown as number);
  const diff = due - Date.now();
  return diff >= 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

// ── Task Row ────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isAdmin,
  isOwn,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onClick,
}: {
  task: TeamTask;
  isAdmin: boolean;
  isOwn: boolean;
  onSubmit:  (id: string) => void;
  onApprove: (id: string) => void;
  onReject:  (id: string, reason: string) => void;
  onDelete:  (id: string) => void;
  onClick:   (task: TeamTask) => void;
}) {
  const { t, locale } = useLocale();
  const [hovered,     setHovered]     = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [rejectInput, setRejectInput] = useState(false);
  const [reason,      setReason]      = useState("");

  const statusLabel: Record<string, string> = {
    draft:       t.status.todo,
    in_progress: t.status.in_progress,
    submitted:   t.status.submitted,
    completed:   t.status.completed,
  };

  const overdue  = isOverdue(task);
  const dueSoon  = isDueSoon(task);
  const dueLabel = task.dueDate
    ? formatDate(task.dueDate instanceof Date ? task.dueDate.getTime() : task.dueDate as unknown as number, locale)
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        borderBottom: "1px solid var(--border)",
        background: hovered ? "rgba(99,102,241,0.03)" : "transparent",
        transition: "background 0.12s",
        cursor: "pointer",
        position: "relative",
        paddingLeft: 28,
      }}
    >
      {/* Status dot */}
      <div
        onClick={(e) => { e.stopPropagation(); onClick(task); }}
        style={{ padding: "10px 8px 10px 8px", display: "flex", alignItems: "center", flexShrink: 0 }}
      >
        <div style={{
          width: 15, height: 15, borderRadius: "50%",
          border: `1.5px solid ${STATUS_DOT[task.status] ?? "#6b7280"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {task.status === "completed" && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[task.status] }} />
          )}
        </div>
      </div>

      {/* Task title */}
      <div onClick={() => onClick(task)} style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 4px" }}>
        <span style={{
          fontSize: 13, fontWeight: 500, color: "var(--text)",
          textDecoration: task.status === "completed" ? "line-through" : "none",
          opacity: task.status === "completed" ? 0.55 : 1,
          display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {task.title}
        </span>
        {task.description && (
          <span style={{
            fontSize: 11, color: "var(--text-muted)",
            display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginTop: 1,
          }}>
            {task.description}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div style={{ width: 95, padding: "0 8px", flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
          background: `${STATUS_DOT[task.status] ?? "#6b7280"}18`,
          color: STATUS_DOT[task.status] ?? "#6b7280",
        }}>
          {statusLabel[task.status] ?? task.status}
        </span>
      </div>

      {/* Tag */}
      <div style={{ width: 90, padding: "0 8px", flexShrink: 0 }}>
        {task.tag && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
            background: "var(--accent-bg)", color: "var(--accent-light)",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            <Tag size={9} /> {task.tag}
          </span>
        )}
      </div>

      {/* Assignee */}
      <div style={{ width: 110, padding: "0 8px", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
        }}>
          {task.memberName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.memberName}
        </span>
      </div>

      {/* Priority */}
      <div style={{ width: 80, padding: "0 8px", flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
          background: `${PRIORITY_COLORS[task.priority]}18`,
          color: PRIORITY_COLORS[task.priority],
          textTransform: "capitalize",
        }}>
          {task.priority}
        </span>
      </div>

      {/* Due date */}
      <div style={{ width: 90, padding: "0 8px", flexShrink: 0 }}>
        {dueLabel && (
          <span style={{
            fontSize: 11, fontWeight: overdue ? 600 : 400,
            color: overdue ? "var(--status-danger)" : dueSoon ? "var(--status-warning)" : "var(--text-muted)",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            {overdue && <AlertCircle size={10} />}
            <Calendar size={10} />
            {dueLabel}
          </span>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div style={{
        width: 80, padding: "0 12px 0 8px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4,
        opacity: hovered ? 1 : 0, transition: "opacity 0.12s",
      }}>
        {isOwn && task.status === "in_progress" && (
          <button
            onClick={(e) => { e.stopPropagation(); onSubmit(task.id); }}
            style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
              background: "rgba(245,158,11,0.15)", color: "var(--status-warning)",
              border: "1px solid rgba(245,158,11,0.25)", cursor: "pointer",
            }}
          >
            {t.listView.submit}
          </button>
        )}
        {isAdmin && task.status === "submitted" && (
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(task.id); }}
            style={{
              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5,
              background: "rgba(34,197,94,0.15)", color: "var(--status-success)",
              border: "1px solid rgba(34,197,94,0.25)", cursor: "pointer",
            }}
          >
            {t.listView.approve}
          </button>
        )}

        {/* Three-dot menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: "2px 3px",
              display: "flex", alignItems: "center",
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div style={{
              position: "absolute", right: 0, top: "100%", zIndex: 50,
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              padding: "4px 0", minWidth: 130,
            }}>
              {isOwn && task.status === "in_progress" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSubmit(task.id); setMenuOpen(false); }}
                  style={{ ...menuItemStyle, color: "var(--status-warning)" }}
                >
                  {t.listView.submitForReview}
                </button>
              )}
              {isAdmin && task.status === "submitted" && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onApprove(task.id); setMenuOpen(false); }}
                    style={{ ...menuItemStyle, color: "var(--status-success)" }}
                  >
                    {t.listView.approve}
                  </button>
                  {!rejectInput ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRejectInput(true); }}
                      style={{ ...menuItemStyle, color: "var(--status-danger)" }}
                    >
                      {t.listView.reject}
                    </button>
                  ) : (
                    <div style={{ padding: "6px 10px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        placeholder={t.listView.rejectionReasonPlaceholder}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && reason.trim()) {
                            onReject(task.id, reason.trim());
                            setMenuOpen(false);
                          }
                        }}
                        style={{
                          width: "100%", fontSize: 11, padding: "4px 7px",
                          borderRadius: 5, background: "var(--surface2)",
                          border: "1px solid var(--border2)", color: "var(--text)",
                          outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  )}
                </>
              )}
              <div style={{ height: 1, background: "var(--border)", margin: "3px 0" }} />
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setMenuOpen(false); }}
                style={{ ...menuItemStyle, color: "var(--status-danger)" }}
              >
                {t.listView.deleteTask}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "7px 14px", fontSize: 12, fontWeight: 500,
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text)",
};

// ── Project Group ───────────────────────────────────────────────────────────

function ProjectGroup({
  project,
  spaceName,
  tasks,
  isAdmin,
  currentUserId,
  onAddTask,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onTaskClick,
  onProjectClick,
}: {
  project: Project;
  spaceName?: string;
  tasks: TeamTask[];
  isAdmin: boolean;
  currentUserId: string;
  onAddTask:      (projectId: string, statusId: string) => void;
  onSubmit:       (id: string) => void;
  onApprove:      (id: string) => void;
  onReject:       (id: string, reason: string) => void;
  onDelete:       (id: string) => void;
  onTaskClick:    (task: TeamTask) => void;
  onProjectClick: (projectId: string) => void;
}) {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered]     = useState(false);

  const completedCount = tasks.filter((tk) => tk.status === "completed").length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const statusColor = PROJECT_STATUS_COLORS[project.status] ?? "#6b7280";

  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: 12,
      border: "1px solid var(--border2)",
      marginBottom: 8,
      overflow: "hidden",
      transition: "box-shadow 0.15s",
      boxShadow: hovered ? "0 2px 12px rgba(0,0,0,0.1)" : "none",
    }}>
      {/* Project header */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 0,
          background: collapsed ? "var(--surface)" : "var(--surface2)",
          transition: "background 0.12s",
          userSelect: "none",
        }}
      >
        {/* Expand / collapse arrow */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "14px 8px 14px 16px",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            flexShrink: 0,
          }}
        >
          <ChevronRight
            size={14}
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 0.15s",
              color: "var(--text-muted)",
            }}
          />
        </button>

        {/* Project info */}
        <div
          onClick={() => onProjectClick(project._id)}
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "14px 0", cursor: "pointer", minWidth: 0 }}
        >
          {/* Space label */}
          {spaceName && (
            <span style={{
              fontSize: 10, fontWeight: 500, color: "var(--text-muted)",
              letterSpacing: "0.02em",
            }}>
              {spaceName}
            </span>
          )}

          {/* Project name */}
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {project.name}
          </span>

          {/* Status badge */}
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
            background: `${statusColor}18`,
            color: statusColor,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
            {project.status.replace("_", " ")}
          </span>

          {/* Three dots (like ClickUp) */}
          <span style={{ color: "var(--text-muted)", fontSize: 16, letterSpacing: 2, lineHeight: 1 }}>
            ···
          </span>
        </div>

        {/* Right side: progress + task count */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 16, flexShrink: 0 }}>
          {/* Progress bar */}
          {tasks.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 60, height: 4, borderRadius: 2,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${progress}%`, height: "100%",
                  background: "var(--status-success)", borderRadius: 2,
                  transition: "width 0.3s",
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>
                {progress}%
              </span>
            </div>
          )}

          {/* Task count */}
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
            background: "var(--accent-bg)", color: "var(--accent-light)",
          }}>
            {tasks.length} {tasks.length === 1 ? t.projectListView.task : t.projectListView.tasks}
          </span>

          {/* Add task */}
          <button
            onClick={(e) => { e.stopPropagation(); onAddTask(project._id, "draft"); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: hovered ? "var(--text-muted)" : "transparent",
              transition: "color 0.12s",
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 11, fontWeight: 500, padding: "4px 6px",
            }}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Task rows */}
      {!collapsed && (
        <div>
          {/* Column headers */}
          <div style={{
            display: "flex", alignItems: "center",
            borderBottom: "1px solid var(--border)",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            paddingLeft: 28,
          }}>
            <div style={{ width: 31, flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "6px 12px 6px 4px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnTaskName}
              </span>
            </div>
            <div style={{ width: 95, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnStatus}
              </span>
            </div>
            <div style={{ width: 90, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnTag}
              </span>
            </div>
            <div style={{ width: 110, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnAssignee}
              </span>
            </div>
            <div style={{ width: 80, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnPriority}
              </span>
            </div>
            <div style={{ width: 90, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnDueDate}
              </span>
            </div>
            <div style={{ width: 80, flexShrink: 0 }} />
          </div>

          {/* Task list */}
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isAdmin={isAdmin}
                isOwn={task.memberId === currentUserId}
                onSubmit={onSubmit}
                onApprove={onApprove}
                onReject={onReject}
                onDelete={onDelete}
                onClick={onTaskClick}
              />
            ))
          ) : (
            <div style={{
              padding: "20px 28px",
              display: "flex", alignItems: "center", gap: 8,
              borderBottom: "1px solid var(--border)",
            }}>
              <FolderOpen size={14} style={{ color: "var(--text-muted)" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                {t.projectListView.noTasksYet}
              </span>
              <button
                onClick={() => onAddTask(project._id, "draft")}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                  background: "var(--accent-bg)", color: "var(--accent-light)",
                  border: "1px solid rgba(99,102,241,0.2)", cursor: "pointer",
                  marginLeft: 4,
                }}
              >
                <Plus size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
                {t.listView.addTask}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Unassigned Tasks Group ──────────────────────────────────────────────────

function UnassignedGroup({
  tasks,
  isAdmin,
  currentUserId,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onTaskClick,
}: {
  tasks: TeamTask[];
  isAdmin: boolean;
  currentUserId: string;
  onSubmit:    (id: string) => void;
  onApprove:   (id: string) => void;
  onReject:    (id: string, reason: string) => void;
  onDelete:    (id: string) => void;
  onTaskClick: (task: TeamTask) => void;
}) {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered]     = useState(false);

  if (tasks.length === 0) return null;

  return (
    <div style={{
      background: "var(--surface)",
      borderRadius: 12,
      border: "1px solid var(--border2)",
      marginBottom: 8,
      overflow: "hidden",
      opacity: 0.85,
    }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 0,
          background: collapsed ? "var(--surface)" : "var(--surface2)",
          userSelect: "none",
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "14px 8px 14px 16px",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            flexShrink: 0,
          }}
        >
          <ChevronRight
            size={14}
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 0.15s",
            }}
          />
        </button>

        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, padding: "14px 0", cursor: "pointer" }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>
            {t.projectListView.unassignedToProject}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
            background: "rgba(113,113,122,0.1)", color: "var(--text-muted)",
          }}>
            {tasks.length} {tasks.length === 1 ? t.projectListView.task : t.projectListView.tasks}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div>
          <div style={{
            display: "flex", alignItems: "center",
            borderBottom: "1px solid var(--border)",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            paddingLeft: 28,
          }}>
            <div style={{ width: 31, flexShrink: 0 }} />
            <div style={{ flex: 1, padding: "6px 12px 6px 4px" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnTaskName}
              </span>
            </div>
            <div style={{ width: 95, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnStatus}
              </span>
            </div>
            <div style={{ width: 90, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnTag}
              </span>
            </div>
            <div style={{ width: 110, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnAssignee}
              </span>
            </div>
            <div style={{ width: 80, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnPriority}
              </span>
            </div>
            <div style={{ width: 90, padding: "6px 8px", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t.listView.columnDueDate}
              </span>
            </div>
            <div style={{ width: 80, flexShrink: 0 }} />
          </div>

          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isAdmin={isAdmin}
              isOwn={task.memberId === currentUserId}
              onSubmit={onSubmit}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
              onClick={onTaskClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────

export default function ProjectListView({
  projects,
  tasks,
  spaces,
  isAdmin,
  currentUserId,
  onAddTask,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onTaskClick,
  onProjectClick,
}: {
  projects: Project[];
  tasks: TeamTask[];
  spaces?: { _id: string; name: string }[];
  isAdmin: boolean;
  currentUserId: string;
  onAddTask:      (projectId: string, statusId: string) => void;
  onSubmit:       (id: string) => void;
  onApprove:      (id: string) => void;
  onReject:       (id: string, reason: string) => void;
  onDelete:       (id: string) => void;
  onTaskClick:    (task: TeamTask) => void;
  onProjectClick: (projectId: string) => void;
}) {
  const { t } = useLocale();

  // Group tasks by project
  const tasksByProject = new Map<string, TeamTask[]>();
  const unassigned: TeamTask[] = [];

  for (const task of tasks) {
    if (task.projectId) {
      const existing = tasksByProject.get(task.projectId) ?? [];
      existing.push(task);
      tasksByProject.set(task.projectId, existing);
    } else {
      unassigned.push(task);
    }
  }

  // Build space lookup
  const spaceMap = new Map<string, string>();
  if (spaces) {
    for (const s of spaces) spaceMap.set(s._id, s.name);
  }

  // Sort projects: active first, then by name
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
      <div style={{ minWidth: 720 }}>
        {sortedProjects.map((project) => {
          const projectTasks = tasksByProject.get(project._id) ?? [];
          const spaceName = (project as any).spaceId ? spaceMap.get((project as any).spaceId) : undefined;

          return (
            <ProjectGroup
              key={project._id}
              project={project}
              spaceName={spaceName}
              tasks={projectTasks}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onAddTask={onAddTask}
              onSubmit={onSubmit}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
              onTaskClick={onTaskClick}
              onProjectClick={onProjectClick}
            />
          );
        })}

        {/* Tasks not assigned to any project */}
        <UnassignedGroup
          tasks={unassigned}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          onSubmit={onSubmit}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDelete}
          onTaskClick={onTaskClick}
        />

        {/* Empty state */}
        {sortedProjects.length === 0 && unassigned.length === 0 && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "60px 20px", gap: 12,
          }}>
            <FolderOpen size={36} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              {t.projectListView.noProjectsOrTasks}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
