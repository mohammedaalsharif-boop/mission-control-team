"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  ChevronRight, Plus, MoreHorizontal,
  Calendar, Tag, AlertCircle, X,
} from "lucide-react";
import { TeamTask } from "@/lib/task-types";
import { useLocale } from "@/components/LocaleProvider";

const PRIORITY_COLORS: Record<string, string> = {
  high:   "var(--status-danger)",
  medium: "var(--status-warning)",
  low:    "var(--status-success)",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts?: number | Date, locale: string = "en-US"): string {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  const localeCode = locale === "ar" ? "ar-SA" : "en-US";
  return d.toLocaleDateString(localeCode, { month: "short", day: "numeric" });
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

// ── Row ──────────────────────────────────────────────────────────────────────

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

  const overdue  = isOverdue(task);
  const dueSoon  = isDueSoon(task);
  const dueLabel = task.dueDate ? formatDate(task.dueDate instanceof Date ? task.dueDate.getTime() : task.dueDate as unknown as number, locale) : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        borderBottom: "1px solid var(--border)",
        background: hovered ? "var(--surface2)" : "transparent",
        transition: "background 0.12s",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {/* Checkbox / status dot */}
      <div
        onClick={(e) => { e.stopPropagation(); onClick(task); }}
        style={{ padding: "10px 8px 10px 20px", display: "flex", alignItems: "center", flexShrink: 0 }}
      >
        <div style={{
          width: 15, height: 15, borderRadius: "50%",
          border: `1.5px solid ${PRIORITY_COLORS[task.priority] ?? "#6b7280"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {task.status === "completed" && (
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[task.priority] }} />
          )}
        </div>
      </div>

      {/* Task title */}
      <div
        onClick={() => onClick(task)}
        style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 4px" }}
      >
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

      {/* Tag */}
      <div style={{ width: 100, padding: "0 8px", flexShrink: 0 }}>
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
      <div style={{ width: 85, padding: "0 8px", flexShrink: 0 }}>
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
        {/* Quick action */}
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

// ── Section ──────────────────────────────────────────────────────────────────

const EMPTY_ROW_FORM = { title: "", desc: "", priority: "medium", dueDate: "", tag: "" };

function Section({
  section,
  tasks,
  isAdmin,
  currentUserId,
  isAdding,
  onStartAdd,
  onCreateTask,
  onCancelAdd,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onTaskClick,
}: {
  section:       { id: string; label: string; dot: string; dotBg: string };
  tasks:         TeamTask[];
  isAdmin:       boolean;
  currentUserId: string;
  isAdding:      boolean;
  onStartAdd:    () => void;
  onCreateTask:  (data: typeof EMPTY_ROW_FORM) => void;
  onCancelAdd:   () => void;
  onSubmit:      (id: string) => void;
  onApprove:     (id: string) => void;
  onReject:      (id: string, reason: string) => void;
  onDelete:      (id: string) => void;
  onTaskClick:   (task: TeamTask) => void;
}) {
  const { t } = useLocale();
  const [collapsed,     setCollapsed]     = useState(false);
  const [headerHovered, setHeaderHovered] = useState(false);
  const [form,          setForm]          = useState(EMPTY_ROW_FORM);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      setForm(EMPTY_ROW_FORM);
      setTimeout(() => titleRef.current?.focus(), 30);
    }
  }, [isAdding]);

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onCreateTask(form);
    setForm(EMPTY_ROW_FORM);
  };

  return (
    <div style={{ marginBottom: 0 }}>
      {/* Section header */}
      <div
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 0,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface2)",
          userSelect: "none",
        }}
      >
        {/* Expand / collapse arrow */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 6px 10px 12px",
            color: "var(--text-muted)", display: "flex", alignItems: "center",
            flexShrink: 0,
          }}
        >
          <ChevronRight
            size={13}
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 0.15s",
              color: "var(--text-muted)",
            }}
          />
        </button>

        {/* Status dot + label */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, padding: "10px 0", cursor: "pointer" }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: section.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {section.label}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 10,
            background: section.dotBg, color: section.dot,
            marginLeft: 2,
          }}>
            {tasks.length}
          </span>
        </div>

        {/* Spacer matching column widths */}
        <div style={{ display: "flex", alignItems: "center", opacity: 0, pointerEvents: "none" }}>
          <div style={{ width: 100 }} />
          <div style={{ width: 110 }} />
          <div style={{ width: 85 }} />
          <div style={{ width: 90 }} />
          <div style={{ width: 80 }} />
        </div>

        {/* Add task to section */}
        <button
          onClick={onStartAdd}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "10px 14px",
            color: headerHovered ? "var(--text-muted)" : "transparent",
            transition: "color 0.12s",
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 500,
          }}
        >
          <Plus size={12} /> {t.listView.addTask}
        </button>
      </div>

      {/* Task rows */}
      {!collapsed && (
        <>
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

          {/* Inline add form */}
          {isAdding && (
            <div style={{
              borderBottom: "1px solid var(--border)",
              background: "var(--surface)",
              padding: "10px 14px",
              display: "flex", flexDirection: "column", gap: 7,
              animation: "fadeIn 0.12s ease both",
            }}>
              <input
                ref={titleRef}
                placeholder={t.listView.taskTitlePlaceholder}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancelAdd(); }}
                style={{
                  background: "var(--surface2)", border: "1px solid var(--border2)",
                  borderRadius: 7, padding: "7px 10px", fontSize: 13,
                  color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input
                  placeholder={t.listView.descriptionPlaceholder}
                  value={form.desc}
                  onChange={(e) => setForm({ ...form, desc: e.target.value })}
                  style={{
                    flex: 2, minWidth: 160, background: "var(--surface2)",
                    border: "1px solid var(--border2)", borderRadius: 7,
                    padding: "5px 9px", fontSize: 12, color: "var(--text)",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border2)",
                    borderRadius: 7, padding: "5px 9px", fontSize: 12,
                    color: "var(--text)", cursor: "pointer", outline: "none",
                  }}
                >
                  {priorityOptions(t).map((p) => (
                    <option key={p.value} value={p.value}>{p.label} {t.listView.prioritySuffix}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  style={{
                    background: "var(--surface2)", border: "1px solid var(--border2)",
                    borderRadius: 7, padding: "5px 9px", fontSize: 12,
                    color: "var(--text)", outline: "none",
                  }}
                />
                <input
                  placeholder={t.listView.tagPlaceholder}
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  style={{
                    width: 110, background: "var(--surface2)",
                    border: "1px solid var(--border2)", borderRadius: 7,
                    padding: "5px 9px", fontSize: 12, color: "var(--text)",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={handleSubmit}
                  disabled={!form.title.trim()}
                  style={{
                    padding: "6px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                    background: form.title.trim() ? "var(--accent)" : "var(--surface3)",
                    color: form.title.trim() ? "#fff" : "var(--text-dim)",
                    border: "none", cursor: form.title.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {t.listView.addTaskBtn}
                </button>
                <button
                  onClick={onCancelAdd}
                  style={{
                    padding: "6px 10px", borderRadius: 7, fontSize: 12,
                    background: "var(--surface2)", border: "1px solid var(--border2)",
                    color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center",
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {tasks.length === 0 && !isAdding && (
            <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                {t.listView.noTasks}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Column headers bar ───────────────────────────────────────────────────────

function ColumnHeaders() {
  const { t } = useLocale();
  return (
    <div style={{
      display: "flex", alignItems: "center",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      {/* Left spacer: chevron + dot + checkbox */}
      <div style={{ width: 36, flexShrink: 0 }} />
      {/* Title */}
      <div style={{ flex: 1, padding: "7px 4px 7px 4px" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t.listView.columnTaskName}
        </span>
      </div>
      {/* Tag */}
      <div style={{ width: 100, padding: "7px 8px", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t.listView.columnTag}
        </span>
      </div>
      {/* Assignee */}
      <div style={{ width: 110, padding: "7px 8px", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t.listView.columnAssignee}
        </span>
      </div>
      {/* Priority */}
      <div style={{ width: 85, padding: "7px 8px", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t.listView.columnPriority}
        </span>
      </div>
      {/* Due date */}
      <div style={{ width: 90, padding: "7px 8px", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t.listView.columnDueDate}
        </span>
      </div>
      {/* Actions */}
      <div style={{ width: 80, flexShrink: 0 }} />
    </div>
  );
}

// ── Sections builder with translations ───────────────────────────────────────

function buildSections(t: any) {
  return [
    { id: "draft",       label: t.status.todo,        dot: "var(--text-muted)", dotBg: "rgba(113,113,122,0.15)" },
    { id: "in_progress", label: t.status.in_progress, dot: "var(--status-info)", dotBg: "rgba(59,130,246,0.15)"  },
    { id: "submitted",   label: t.status.submitted,   dot: "var(--status-warning)", dotBg: "rgba(245,158,11,0.15)"  },
    { id: "completed",   label: t.status.completed,   dot: "var(--status-success)", dotBg: "rgba(34,197,94,0.15)"   },
  ];
}

// ── Priority options builder with translations ────────────────────────────────

function priorityOptions(t: any) {
  return [
    { value: "high",   label: t.priority.high,   color: "var(--status-danger)" },
    { value: "medium", label: t.priority.medium, color: "var(--status-warning)" },
    { value: "low",    label: t.priority.low,    color: "var(--status-success)" },
  ];
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function ListView({
  tasks,
  isAdmin,
  currentUserId,
  triggerAddStatus,
  onTriggerConsumed,
  onCreateTask,
  onSubmit,
  onApprove,
  onReject,
  onDelete,
  onTaskClick,
}: {
  tasks:              TeamTask[];
  isAdmin:            boolean;
  currentUserId:      string;
  triggerAddStatus?:  string | null;
  onTriggerConsumed?: () => void;
  onCreateTask:       (statusId: string, data: typeof EMPTY_ROW_FORM) => void;
  onSubmit:           (id: string) => void;
  onApprove:          (id: string) => void;
  onReject:           (id: string, reason: string) => void;
  onDelete:           (id: string) => void;
  onTaskClick:        (task: TeamTask) => void;
}) {
  const { t, locale } = useLocale();
  const [addingSection, setAddingSection] = useState<string | null>(null);

  const sections = useMemo(() => buildSections(t), [t]);

  useEffect(() => {
    if (triggerAddStatus) {
      setAddingSection(triggerAddStatus);
      onTriggerConsumed?.();
    }
  }, [triggerAddStatus]);

  return (
    <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
      <div style={{ minWidth: 680 }}>
        <ColumnHeaders />
        {sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            tasks={tasks.filter((task) => task.status === section.id)}
            isAdmin={isAdmin}
            currentUserId={currentUserId}
            isAdding={addingSection === section.id}
            onStartAdd={() => setAddingSection(section.id)}
            onCreateTask={(data) => { onCreateTask(section.id, data); setAddingSection(null); }}
            onCancelAdd={() => setAddingSection(null)}
            onSubmit={onSubmit}
            onApprove={onApprove}
            onReject={onReject}
            onDelete={onDelete}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  );
}
