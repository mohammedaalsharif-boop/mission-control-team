"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import {
  ChevronDown, ChevronRight, MoreHorizontal, GripVertical,
  Plus, CalendarDays, UserPlus, Pencil, Archive, ExternalLink,
  Link as LinkIcon, Check,
} from "lucide-react";

// ── Status config ─────────────────────────────────────────────────────────────

type StatusKey = "draft" | "in_progress" | "submitted" | "approved" | "completed";

interface StatusConfig {
  label:       string;
  pillBg:      string;
  pillColor:   string;
  pillBorder:  string;
  dotBg:       string;
  dotBorder:   string;
}

function getStatusConfig(t: any): Record<StatusKey, StatusConfig> {
  return {
    draft: {
      label:      t.projectListCard.toDo,
      pillBg:     "rgba(113,113,122,0.15)",
      pillColor:  "#a1a1aa",
      pillBorder: "1px solid rgba(113,113,122,0.3)",
      dotBg:      "transparent",
      dotBorder:  "2px dashed #52525b",
    },
    in_progress: {
      label:      t.projectListCard.inProgress,
      pillBg:     "#2563eb",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#2563eb",
      dotBorder:  "none",
    },
    submitted: {
      label:      t.projectListCard.submittedStatus,
      pillBg:     "#d97706",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#d97706",
      dotBorder:  "none",
    },
    approved: {
      label:      t.projectListCard.approvedStatus,
      pillBg:     "#7c3aed",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#7c3aed",
      dotBorder:  "none",
    },
    completed: {
      label:      t.projectListCard.completedStatus,
      pillBg:     "#16a34a",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#16a34a",
      dotBorder:  "none",
    },
  };
}

const STATUS_ORDER: StatusKey[] = ["draft", "in_progress", "submitted", "approved", "completed"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status, statusConfig }: { status: string; statusConfig: StatusConfig }) {
  return (
    <div style={{
      width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
      background: statusConfig.dotBg,
      border: statusConfig.dotBorder,
    }} />
  );
}

function formatDate(ms: number, locale: string): string {
  const dateLocale = locale === "ar" ? "ar-SA" : "en-US";
  return new Date(ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
}

// ── Inline add-task input ─────────────────────────────────────────────────────

function AddTaskInput({
  projectId,
  status,
  onDone,
  statusConfig,
  t,
}: {
  projectId: Id<"projects">;
  status: StatusKey;
  onDone: () => void;
  statusConfig: StatusConfig;
  t: any;
}) {
  const { user, orgId } = useAuth();
  const createTask     = useMutation(api.tasks.createTask);
  const updateStatus   = useMutation(api.tasks.updateTaskStatus);
  const [title, setTitle] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || !user?.memberId || !orgId) { onDone(); return; }
    const taskId = await createTask({
      orgId,
      projectId,
      title:       trimmed,
      description: "",
      memberId:    user.memberId as Id<"members">,
      memberName:  user.name,
      submissionDate: Date.now() + 7 * 24 * 60 * 60 * 1000, // default: 1 week from now
    });
    // createTask always creates with status "draft"; move to target status if different
    if (status !== "draft") {
      await updateStatus({ taskId, status });
    }
    setTitle("");
    onDone();
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 12px 7px 42px",
      borderTop: "1px solid rgba(255,255,255,0.04)",
    }}>
      <StatusDot status={status} statusConfig={statusConfig} />
      <input
        ref={ref} autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
        onBlur={() => { if (!title.trim()) onDone(); else submit(); }}
        placeholder={t.projectListCard.taskName}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          fontSize: 13, color: "#e4e4e7", fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// ── Status group ──────────────────────────────────────────────────────────────

function StatusGroup({
  status,
  tasks,
  projectId,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  statusConfig,
  t,
  locale,
}: {
  status:     StatusKey;
  tasks:      Doc<"tasks">[];
  projectId:  Id<"projects">;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop:     (e: React.DragEvent) => void;
  statusConfig: StatusConfig;
  t: any;
  locale: string;
}) {
  const cfg              = statusConfig;
  const [open, setOpen]  = useState(true);
  const [adding, setAdding] = useState(false);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        background: isDragOver ? "rgba(99,102,241,0.05)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {/* Status header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px",
      }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#52525b", display: "flex" }}
        >
          {open
            ? <ChevronDown  size={13} strokeWidth={2.5} />
            : <ChevronRight size={13} strokeWidth={2.5} />}
        </button>

        {/* Status pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "2px 9px 2px 7px", borderRadius: 5,
          background: cfg.pillBg,
          border: cfg.pillBorder,
        }}>
          <StatusDot status={status} statusConfig={cfg} />
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.pillColor, letterSpacing: "0.03em" }}>
            {cfg.label}
          </span>
        </div>

        <span style={{ fontSize: 12, color: "#52525b" }}>{tasks.length}</span>
      </div>

      {open && (
        <>
          {/* Column headers */}
          <div style={{
            display: "flex", alignItems: "center",
            padding: "4px 12px 4px 46px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <span style={{ flex: 1, fontSize: 11, color: "#3f3f46", fontWeight: 500 }}>{t.projectListCard.name}</span>
            <span style={{ width: 130, fontSize: 11, color: "#3f3f46", fontWeight: 500 }}>{t.projectListCard.assignee}</span>
            <span style={{ width: 90,  fontSize: 11, color: "#3f3f46", fontWeight: 500 }}>{t.projectListCard.dueDate}</span>
          </div>

          {/* Task rows */}
          {tasks.map((task) => {
            const _eod = task.dueDate ? new Date(task.dueDate) : null;
            if (_eod) _eod.setHours(23, 59, 59, 999);
            const isOverdue = _eod && _eod.getTime() < Date.now() && task.status !== "completed";
            return (
              <div
                key={task._id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("taskId",    task._id);
                  e.dataTransfer.setData("fromStatus", task.status);
                  e.dataTransfer.effectAllowed = "move";
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px 8px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  cursor: "grab",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {/* Drag handle */}
                <GripVertical size={13} style={{ color: "#3f3f46", flexShrink: 0, marginRight: 2 }} />

                {/* Status dot */}
                <StatusDot status={task.status} statusConfig={cfg} />

                {/* Title */}
                <span style={{
                  flex: 1, fontSize: 13, color: "#e4e4e7", fontWeight: 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {task.title}
                </span>

                {/* Assignee (130px) */}
                <div style={{ width: 130, display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(99,102,241,0.2)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "var(--accent-light)",
                  }}>
                    {task.memberName[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {task.memberName}
                  </span>
                </div>

                {/* Due date (90px) */}
                <div style={{ width: 90, display: "flex", alignItems: "center", gap: 4 }}>
                  {task.dueDate ? (
                    <>
                      <CalendarDays size={11} style={{ color: isOverdue ? "var(--status-danger)" : "#3f3f46", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: isOverdue ? "var(--status-danger)" : "#52525b", fontWeight: isOverdue ? 600 : 400 }}>
                        {formatDate(task.dueDate, locale)}
                      </span>
                    </>
                  ) : (
                    <CalendarDays size={12} style={{ color: "#2a2a2a" }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline add-task */}
          {adding ? (
            <AddTaskInput
              projectId={projectId}
              status={status}
              onDone={() => setAdding(false)}
              statusConfig={cfg}
              t={t}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 12px 8px 46px", width: "100%",
                background: "none", border: "none", cursor: "pointer",
                borderTop: "1px solid rgba(255,255,255,0.03)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              <Plus size={12} style={{ color: "#3f3f46" }} />
              <span style={{ fontSize: 13, color: "#3f3f46" }}>{t.projectListCard.addTask}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color = pct === 100 ? "var(--status-success)" : "var(--accent)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 4, borderRadius: 99,
        background: "rgba(255,255,255,0.07)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${pct}%`,
          background: color,
          transition: "width 0.4s ease",
          minWidth: pct > 0 ? 4 : 0,
        }} />
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, color: pct === 100 ? "var(--status-success)" : "#52525b",
        minWidth: 30, textAlign: "right",
      }}>
        {pct}%
      </span>
    </div>
  );
}

// ── ProjectListCard ───────────────────────────────────────────────────────────

interface ProjectListCardProps {
  project:   Pick<Doc<"projects">, "_id" | "name" | "status"> & { estimatedCompletionDate?: number; ownerId?: string; supporterId?: string };
  spaceName: string;
}

export default function ProjectListCard({ project, spaceName }: ProjectListCardProps) {
  const router       = useRouter();
  const { orgId, can } = useAuth();
  const { t, locale } = useLocale();
  const tasks        = useQuery(api.tasks.listByProject, { projectId: project._id }) ?? [];
  const members      = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const updateStatus = useMutation(api.tasks.updateTaskStatus);
  const updateProject = useMutation(api.projects.update);
  const archiveProject = useMutation(api.projects.archive);

  const statusConfig = getStatusConfig(t);

  const [open,           setOpen]           = useState(true);
  const [dragOverStatus, setDragOverStatus] = useState<StatusKey | null>(null);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [renaming,       setRenaming]       = useState(false);
  const [renameName,     setRenameName]     = useState(project.name);
  const [linkCopied,     setLinkCopied]     = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const canEdit = can("project.edit");

  const handleRename = async () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== project.name) {
      await updateProject({ projectId: project._id, name: trimmed });
    }
    setRenaming(false);
  };

  const handleArchive = async () => {
    await archiveProject({ projectId: project._id });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${project._id}`);
    setLinkCopied(true);
    setMenuOpen(false);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Group tasks by status
  const grouped = STATUS_ORDER.reduce<Record<StatusKey, Doc<"tasks">[]>>(
    (acc, statusKey) => {
      acc[statusKey] = tasks.filter((taskItem) => taskItem.status === statusKey);
      return acc;
    },
    { draft: [], in_progress: [], submitted: [], approved: [], completed: [] }
  );

  // Only render status groups that have tasks OR are "draft" (always show)
  const visibleGroups = STATUS_ORDER.filter(
    (statusKey) => statusKey === "draft" || grouped[statusKey].length > 0
  );

  const completedCount = tasks.filter((taskItem) => taskItem.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleDragOver = (e: React.DragEvent, status: StatusKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDrop = async (e: React.DragEvent, toStatus: StatusKey) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId    = e.dataTransfer.getData("taskId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (!taskId || fromStatus === toStatus) return;
    await updateStatus({ taskId: taskId as Id<"tasks">, status: toStatus });
  };

  return (
    <div style={{
      background: "#171717",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Project header */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: 11, color: "#52525b", margin: "0 0 5px", fontWeight: 500, letterSpacing: "0.02em" }}>
          {spaceName}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 12 }}>
          <button
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#52525b", display: "flex" }}
          >
            {open
              ? <ChevronDown  size={15} strokeWidth={2.5} />
              : <ChevronRight size={15} strokeWidth={2.5} />}
          </button>
          {renaming ? (
            <input
              ref={renameRef}
              autoFocus
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
              onBlur={handleRename}
              style={{
                fontSize: 15, fontWeight: 700, color: "#e4e4e7", margin: 0,
                background: "var(--accent-subtle)", border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: 6, padding: "2px 8px", outline: "none", fontFamily: "inherit",
              }}
            />
          ) : (
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#e4e4e7", margin: 0 }}>
              {project.name}
            </h2>
          )}
          <div style={{ position: "relative", marginLeft: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              style={{
                background: menuOpen ? "rgba(255,255,255,0.08)" : "none",
                border: "none", cursor: "pointer", color: menuOpen ? "#a1a1aa" : "#3f3f46",
                padding: "2px 4px", borderRadius: 5, display: "flex",
                transition: "background 0.1s, color 0.1s",
              }}
            >
              <MoreHorizontal size={15} />
            </button>
            {menuOpen && (
              <div
                style={{
                  position: "absolute", left: 0, top: "calc(100% + 4px)", zIndex: 50,
                  background: "#1c1c1c", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  padding: "4px 0", minWidth: 170, overflow: "hidden",
                }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => router.push(`/projects/${project._id}`)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 12.5, color: "#d4d4d8", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <ExternalLink size={13} /> {t.projectListCard.openProject}
                </button>
                <button
                  onClick={handleCopyLink}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 12.5, color: "#d4d4d8", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  {linkCopied ? <Check size={13} color="var(--status-success)" /> : <LinkIcon size={13} />}
                  {linkCopied ? t.copied : t.projectListCard.copyLink}
                </button>
                {canEdit && (
                  <>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                    <button
                      onClick={() => { setMenuOpen(false); setRenaming(true); setTimeout(() => renameRef.current?.focus(), 0); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12.5, color: "#d4d4d8", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <Pencil size={13} /> {t.projectListCard.rename}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); const next = project.status === "active" ? "on_hold" : "active"; updateProject({ projectId: project._id, status: next }); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12.5, color: "#d4d4d8", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      {project.status === "active" ? "⏸ " + t.projectListCard.putOnHold : "▶ " + t.projectListCard.setActive}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleArchive(); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12.5, color: "var(--status-danger)", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <Archive size={13} /> {t.projectListCard.archive}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <span style={{
            marginLeft: "auto", fontSize: 11, color: "#52525b",
            background: "rgba(255,255,255,0.05)", borderRadius: 5,
            padding: "2px 8px",
          }}>
            {tasks.length} {tasks.length === 1 ? t.projectListCard.task : t.projectListCard.tasks}
          </span>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div style={{ paddingBottom: project.estimatedCompletionDate ? 8 : 14 }}>
            <ProgressBar pct={pct} />
          </div>
        )}

        {/* Estimated Completion Date */}
        {project.estimatedCompletionDate && (() => {
          const ecd = project.estimatedCompletionDate;
          const ecdEod = new Date(ecd);
          ecdEod.setHours(23,59,59,999);
          const isOverdue = ecdEod.getTime() < Date.now() && pct < 100;
          const dateLocale = locale === "ar" ? "ar-SA" : "en-US";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 5, paddingBottom: 8 }}>
              <CalendarDays size={11} style={{ color: isOverdue ? "var(--status-danger)" : "#52525b", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isOverdue ? "var(--status-danger)" : "#52525b", fontWeight: isOverdue ? 700 : 400 }}>
                {isOverdue ? t.projectListCard.overdue : t.projectListCard.estCompletion} · {new Date(ecd).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          );
        })()}

        {/* Owner & Supporter avatars */}
        {(() => {
          const owner     = members.find((memberItem: any) => memberItem._id === project.ownerId);
          const supporter = members.find((memberItem: any) => memberItem._id === project.supporterId);
          if (!owner && !supporter) return null;
          const initials = (name: string) => name.split(" ").map((word: string) => word[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14 }}>
              {owner && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, color: "var(--accent-light)",
                  }}>
                    {initials(owner.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-light)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.projectListCard.owner}</p>
                    <p style={{ fontSize: 11, color: "#a1a1aa", margin: 0 }}>{owner.name}</p>
                  </div>
                </div>
              )}
              {owner && supporter && (
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.07)" }} />
              )}
              {supporter && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(20,184,166,0.2)", border: "1px solid rgba(20,184,166,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, color: "#2dd4bf",
                  }}>
                    {initials(supporter.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#2dd4bf", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.projectListCard.supporter}</p>
                    <p style={{ fontSize: 11, color: "#a1a1aa", margin: 0 }}>{supporter.name}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Status groups */}
      {open && visibleGroups.map((statusKey) => (
        <StatusGroup
          key={statusKey}
          status={statusKey}
          tasks={grouped[statusKey]}
          projectId={project._id}
          isDragOver={dragOverStatus === statusKey}
          onDragOver={(e) => handleDragOver(e, statusKey)}
          onDragLeave={() => setDragOverStatus(null)}
          onDrop={(e) => handleDrop(e, statusKey)}
          statusConfig={statusConfig[statusKey]}
          t={t}
          locale={locale}
        />
      ))}
    </div>
  );
}
