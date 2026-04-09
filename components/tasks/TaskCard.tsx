"use client";

import { useState, useMemo } from "react";
import {
  Trash2, Send, CheckCircle, XCircle, AlertTriangle,
  GripVertical, MessageSquare, ListChecks,
} from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { TeamTask } from "@/lib/task-types";
import { useLocale } from "@/components/LocaleProvider";
import TaskModal from "./TaskModal";
import { BottleneckBadge } from "./BottleneckPrompt";
import { BlockedBadge } from "./DependencySection";

/* ── Colour maps ───────────────────────────────────────────────────────────── */

const PRIORITY_COLOR: Record<string, string> = {
  high:   "var(--status-danger)",
  medium: "var(--status-warning)",
  low:    "var(--status-success)",
};

const TIME_AGO = (date: Date, t: any) => {
  const diff  = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t.notificationsPage.justNow;
  if (mins < 60)  return `${mins}${t.notificationsPage.mAgo}`;
  if (hours < 24) return `${hours}${t.notificationsPage.hAgo}`;
  return `${days}${t.notificationsPage.dAgo}`;
};

/* ── Subtask mini-progress ring (16×16 SVG) ────────────────────────────────── */

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct    = total > 0 ? done / total : 0;
  const r      = 5.5;
  const circ   = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color  = pct === 1 ? "var(--status-success)" : "var(--accent)";
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <circle cx={8} cy={8} r={r} fill="none" stroke="var(--border2)" strokeWidth={2} />
      {total > 0 && (
        <circle
          cx={8} cy={8} r={r} fill="none"
          stroke={color} strokeWidth={2}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      )}
    </svg>
  );
}

/* ── Props ──────────────────────────────────────────────────────────────────── */

interface Props {
  task:            TeamTask;
  isAdmin:         boolean;
  isOwn:           boolean;
  currentUser:     { memberId: string; name: string };
  onDelete?:       (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onSubmit?:       (id: string) => void;
  onApprove?:      (id: string) => void;
  onReject?:       (id: string, reason?: string) => void;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export default function TaskCard({
  task, isAdmin, isOwn, currentUser,
  onDelete, onStatusChange, onSubmit, onApprove, onReject,
}: Props) {
  const { t } = useLocale();
  const [hovered,       setHovered]       = useState(false);
  const [dragging,      setDragging]      = useState(false);
  const [open,          setOpen]          = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeBottleneck = useQuery(api.bottlenecks.getActive, { taskId: task.id as Id<"tasks"> });
  const meta             = useQuery(api.tasks.getTaskMeta,     { taskId: task.id as Id<"tasks"> });

  const PRIORITY_LABEL = useMemo(() => ({
    high: t.priority.high, medium: t.priority.medium, low: t.priority.low,
  }), [t]);

  const STATUS_BADGE = useMemo(() => ({
    draft:       { bg: "rgba(113,113,122,0.15)", text: "var(--text-muted)", label: t.status.draft },
    in_progress: { bg: "rgba(59,130,246,0.15)",  text: "#60a5fa", label: t.status.in_progress },
    submitted:   { bg: "rgba(245,158,11,0.15)",  text: "var(--status-warning)", label: t.status.submitted },
    approved:    { bg: "rgba(34,197,94,0.15)",   text: "var(--status-success)", label: t.status.approved },
    rejected:    { bg: "rgba(239,68,68,0.15)",   text: "var(--status-danger)", label: t.status.rejected },
    completed:   { bg: "var(--accent-bg)",  text: "var(--accent-light)", label: t.status.completed },
  }), [t]);

  const dot   = PRIORITY_COLOR[task.priority ?? "medium"] ?? PRIORITY_COLOR.medium;
  const badge = STATUS_BADGE[task.status] ?? STATUS_BADGE.draft;

  /* Due date logic */
  const activeStatuses = ["draft", "in_progress", "rejected"];
  const isActive = activeStatuses.includes(task.status);
  const msInDay  = 86_400_000;
  const now      = Date.now();
  const dueDiff  = task.submissionDate ? task.submissionDate.getTime() - now : null;
  // Overdue only after the full due day has passed (end of day 23:59:59)
  const dueEndOfDay = task.submissionDate ? new Date(task.submissionDate) : null;
  if (dueEndOfDay) dueEndOfDay.setHours(23, 59, 59, 999);
  const isOverdue = isActive && dueEndOfDay !== null && dueEndOfDay.getTime() < now;
  // "Due Today" = the due date falls on today's calendar date
  const isDueToday = isActive && !isOverdue && task.submissionDate !== undefined &&
    task.submissionDate.toDateString() === new Date().toDateString();
  // "Due Soon" = within 24h but not today and not overdue
  const isDueSoon = isActive && !isOverdue && !isDueToday && dueDiff !== null && dueDiff >= 0 && dueDiff <= msInDay;

  const initials = task.memberName
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const hasSubtasks = meta && meta.subtaskTotal > 0;
  const hasComments = meta && meta.commentCount > 0;

  /* Left-border accent — status stripe */
  const accentColor =
    isOverdue   ? "var(--status-danger)" :
    isDueToday  ? "#6366f1" :
    isDueSoon   ? "var(--status-warning)" :
    task.status === "submitted" ? "var(--status-warning)" :
    task.status === "in_progress" ? "var(--status-info)" :
    task.status === "completed" ? "var(--status-success)" :
    task.status === "rejected" ? "var(--status-danger)" :
    "transparent";

  return (
    <>
      {open && (
        <TaskModal
          task={task}
          isAdmin={isAdmin}
          isOwn={isOwn}
          currentUser={currentUser}
          onClose={() => setOpen(false)}
          onDelete={(id) => { setOpen(false); onDelete?.(id); }}
          onStatusChange={onStatusChange}
          onSubmit={onSubmit}
          onApprove={onApprove}
          onReject={onReject}
        />
      )}

      <div
        draggable={isOwn || isAdmin}
        onDragStart={(e) => {
          e.dataTransfer.setData("taskId", task.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
        }}
        onDragEnd={() => setDragging(false)}
        onClick={() => !dragging && setOpen(true)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
        className="task-card"
        style={{
          position:     "relative",
          background:   "var(--surface2)",
          border:       `1px solid ${
            isOverdue   ? "rgba(239,68,68,0.35)"  :
            isDueToday  ? "rgba(99,102,241,0.4)"  :
            isDueSoon   ? "rgba(245,158,11,0.35)" :
            hovered     ? "var(--border3)"         : "var(--border2)"
          }`,
          borderLeft:   `3px solid ${accentColor}`,
          borderRadius: 10,
          padding:      "12px 14px 10px 13px",
          cursor:       dragging ? "grabbing" : "pointer",
          opacity:      dragging ? 0.35 : 1,
          transition:   "border-color 0.15s, opacity 0.15s, transform 0.15s, box-shadow 0.2s",
          transform:    dragging ? "rotate(1.5deg) scale(1.02)" : hovered ? "translateY(-1px)" : "none",
          boxShadow:    dragging
            ? "0 8px 24px rgba(0,0,0,0.35)"
            : hovered
              ? "0 4px 16px rgba(0,0,0,0.12)"
              : "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {/* Top row: priority pill + drag handle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0,
            }} />
            <span style={{
              fontSize: 9.5, fontWeight: 600, color: dot,
              letterSpacing: "0.03em", textTransform: "uppercase",
            }}>
              {PRIORITY_LABEL[task.priority ?? "medium"] ?? "Medium"}
            </span>
            {task.tag && (
              <span style={{
                fontSize: 9.5, fontWeight: 500, color: "var(--accent-light)",
                background: "var(--accent-bg)",
                borderRadius: 4, padding: "1px 6px",
              }}>
                {task.tag}
              </span>
            )}
          </div>
          {hovered && isOwn && (
            <GripVertical
              size={12}
              style={{ color: "var(--text-dim)", flexShrink: 0, cursor: "grab" }}
            />
          )}
        </div>

        {/* Title */}
        <p style={{
          fontSize: 13.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.4,
          margin: "0 0 4px",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {task.title}
        </p>

        {/* Description */}
        {task.description && (
          <p style={{
            fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5,
            margin: "0 0 8px",
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {task.description}
          </p>
        )}

        {/* Rejection note */}
        {task.status === "rejected" && task.rejectionReason && (
          <div style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: 6, padding: "5px 8px", marginBottom: 8,
          }}>
            <p style={{ fontSize: 11, color: "var(--status-danger)", margin: 0, lineHeight: 1.4 }}>
              {task.rejectionReason}
            </p>
          </div>
        )}

        {/* Blocked / Bottleneck / Recurring badges */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
          <BlockedBadge taskId={task.id} />
          {activeBottleneck && (
            <BottleneckBadge
              body={activeBottleneck.body}
              category={activeBottleneck.category}
            />
          )}
          {task.isRecurring && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
              background: "rgba(99,102,241,0.1)", color: "var(--accent-light)",
              border: "1px solid rgba(99,102,241,0.2)",
              display: "flex", alignItems: "center", gap: 3,
            }}>
              ↻ {t.taskCard.recurring}
            </span>
          )}
        </div>

        {/* Due date alert */}
        {task.submissionDate && task.status !== "completed" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5, marginBottom: 8,
            borderRadius: 6, padding: "4px 8px",
            ...(isOverdue ? {
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.15)",
            } : isDueToday ? {
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.2)",
            } : isDueSoon ? {
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.15)",
            } : {
              background: "transparent",
              border: "1px solid transparent",
            }),
          }}>
            {isOverdue && (
              <AlertTriangle size={10} style={{ color: "var(--status-danger)", flexShrink: 0 }} />
            )}
            {isDueToday && (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="2" />
                <path d="M12 6v6l4 2" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {isDueSoon && (
              <AlertTriangle size={10} style={{ color: "var(--status-warning)", flexShrink: 0 }} />
            )}
            <span style={{
              fontSize: 10.5,
              color: isOverdue ? "var(--status-danger)" : isDueToday ? "#6366f1" : isDueSoon ? "var(--status-warning)" : "var(--text-muted)",
              fontWeight: (isOverdue || isDueToday || isDueSoon) ? 600 : 400,
            }}>
              {isOverdue
                ? `${t.taskCard.overdue} \u00b7 ${task.submissionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : isDueToday
                  ? `${t.taskCard.dueToday} \u00b7 Today`
                  : isDueSoon
                    ? `${t.taskCard.dueToday} \u00b7 ${task.submissionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : `${t.taskCard.due} ${task.submissionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              }
            </span>
          </div>
        )}

        {/* Metadata chips: subtasks + comments */}
        {(hasSubtasks || hasComments) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {hasSubtasks && meta && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <ProgressRing done={meta.subtaskDone} total={meta.subtaskTotal} />
                <span style={{
                  fontSize: 10.5, color: meta.subtaskDone === meta.subtaskTotal ? "var(--status-success)" : "var(--text-muted)",
                  fontWeight: 500,
                }}>
                  {meta.subtaskDone}/{meta.subtaskTotal}
                </span>
              </div>
            )}
            {hasComments && meta && (
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <MessageSquare size={11} style={{ color: "var(--text-dim)" }} />
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 500 }}>
                  {meta.commentCount}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer: avatar + status · timestamp + quick actions */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 8, borderTop: "1px solid var(--border)",
          marginTop: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {/* Member avatar */}
            <div
              title={task.memberName}
              style={{
                width: 22, height: 22, borderRadius: "50%",
                background: isOwn ? "var(--accent-bg)" : "var(--surface3)",
                border: isOwn ? "1.5px solid rgba(99,102,241,0.35)" : "1px solid var(--border2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 700,
                color: isOwn ? "var(--accent-light)" : "var(--text-muted)",
              }}
            >
              {initials}
            </div>
            {/* Status badge */}
            <span style={{
              fontSize: 9.5, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
              background: badge.bg, color: badge.text,
            }}>
              {badge.label}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
              {TIME_AGO(task.updatedAt, t)}
            </span>
          </div>

          {/* Quick actions — always visible area on hover */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            opacity: hovered || confirmDelete ? 1 : 0,
            transition: "opacity 0.15s",
            pointerEvents: hovered || confirmDelete ? "auto" : "none",
          }}>
            {/* Submit button for own tasks in draft/in_progress/rejected */}
            {isOwn && (task.status === "draft" || task.status === "in_progress" || task.status === "rejected") && onSubmit && (
              <button
                onClick={(e) => { e.stopPropagation(); onSubmit(task.id); }}
                title={t.taskCard.submitForApproval}
                style={{
                  background: "var(--accent-bg)", border: "none",
                  borderRadius: 5, cursor: "pointer", color: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "3px 4px", transition: "background 0.12s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(99,102,241,0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--accent-bg)"}
              >
                <Send size={11} />
              </button>
            )}

            {/* Approve/Reject for admin on submitted tasks */}
            {isAdmin && task.status === "submitted" && (
              <>
                {onApprove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onApprove(task.id); }}
                    title={t.status.approved}
                    style={{
                      background: "rgba(34,197,94,0.1)", border: "none",
                      borderRadius: 5, cursor: "pointer", color: "var(--status-success)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "3px 4px", transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(34,197,94,0.2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(34,197,94,0.1)"}
                  >
                    <CheckCircle size={11} />
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onReject(task.id); }}
                    title={t.status.rejected}
                    style={{
                      background: "rgba(239,68,68,0.1)", border: "none",
                      borderRadius: 5, cursor: "pointer", color: "var(--status-danger)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "3px 4px", transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.2)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                  >
                    <XCircle size={11} />
                  </button>
                )}
              </>
            )}

            {/* Delete — own tasks or admin */}
            {(isOwn || isAdmin) && task.status !== "submitted" && task.status !== "completed" && onDelete && (
              confirmDelete ? (
                <div style={{ display: "flex", gap: 3 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                    style={{
                      background: "none", border: "1px solid var(--border2)", borderRadius: 4,
                      cursor: "pointer", color: "var(--text-muted)",
                      fontSize: 10, fontWeight: 600, padding: "2px 6px", fontFamily: "inherit",
                    }}
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    style={{
                      background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: 4, cursor: "pointer", color: "var(--status-danger)",
                      fontSize: 10, fontWeight: 600, padding: "2px 6px", fontFamily: "inherit",
                    }}
                  >
                    {t.delete}
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  title={t.delete}
                  style={{
                    background: "none", border: "none",
                    borderRadius: 5, cursor: "pointer", color: "var(--text-dim)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "3px 4px", transition: "color 0.12s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--status-danger)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
                >
                  <Trash2 size={11} />
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
