"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import Sidebar from "@/components/Sidebar";
import BottleneckPrompt from "@/components/tasks/BottleneckPrompt";
import { useLocale } from "@/components/LocaleProvider";
import {
  CheckSquare, Users, LayoutList, LayoutGrid,
  Calendar, Plus, ChevronDown, ChevronRight,
  GripVertical, CalendarDays, MoreHorizontal, Pencil,
  ExternalLink, Archive, Link as LinkIcon, Check, Folder,
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import ProjectCalendar from "@/components/tasks/ProjectCalendar";
import * as XLSX from "xlsx";

// ── Status config ─────────────────────────────────────────────────────────────

type StatusKey = "draft" | "in_progress" | "submitted" | "approved" | "completed";

const STATUS_ORDER: StatusKey[] = ["draft", "in_progress", "submitted", "approved", "completed"];

function getStatusConfig(t: any): Record<StatusKey, {
  label:      string;
  pillBg:     string;
  pillColor:  string;
  pillBorder: string;
  dotBg:      string;
  dotBorder:  string;
}> {
  return {
    draft: {
      label:      t.spaceDetailPage.toDo,
      pillBg:     "rgba(113,113,122,0.15)",
      pillColor:  "var(--text-muted)",
      pillBorder: "1px solid rgba(113,113,122,0.3)",
      dotBg:      "transparent",
      dotBorder:  "2px dashed var(--text-dim)",
    },
    in_progress: {
      label:      t.spaceDetailPage.inProgress,
      pillBg:     "#2563eb",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#2563eb",
      dotBorder:  "none",
    },
    submitted: {
      label:      t.spaceDetailPage.submitted,
      pillBg:     "#d97706",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#d97706",
      dotBorder:  "none",
    },
    approved: {
      label:      t.spaceDetailPage.approved,
      pillBg:     "#0d9488",
      pillColor:  "#fff",
      pillBorder: "none",
      dotBg:      "#0d9488",
      dotBorder:  "none",
    },
    completed: {
      label:      t.spaceDetailPage.completed,
      pillBg:     "var(--surface3)",
      pillColor:  "var(--text-muted)",
      pillBorder: "1px solid var(--border)",
      dotBg:      "var(--text-dim)",
      dotBorder:  "none",
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status, cfg }: { status: string; cfg?: any }) {
  const defaultCfg = { dotBg: "transparent", dotBorder: "2px dashed var(--text-dim)" };
  const actualCfg = cfg ?? defaultCfg;
  return (
    <div style={{
      width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
      background: actualCfg.dotBg,
      border: actualCfg.dotBorder,
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
}: {
  projectId: Id<"projects">;
  status:    StatusKey;
  onDone:    () => void;
}) {
  const { user, orgId } = useAuth();
  const { t } = useLocale();
  const createTask   = useMutation(api.tasks.createTask);
  const updateStatus = useMutation(api.tasks.updateTaskStatus);
  const [title, setTitle] = useState("");
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

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
    if (status !== "draft") {
      await updateStatus({ taskId, status });
    }
    setTitle("");
    setCreatedTaskId(taskId);
  };

  // If bottleneck prompt is showing, render it instead of the input
  if (createdTaskId && user?.memberId) {
    return (
      <div style={{ padding: "0 12px 0 42px" }}>
        <BottleneckPrompt
          taskId={createdTaskId}
          stage={status}
          memberId={user.memberId}
          onDone={() => { setCreatedTaskId(null); onDone(); }}
        />
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 12px 7px 42px",
      borderTop: "1px solid var(--border)",
    }}>
      <StatusDot status={status} />
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
        onBlur={() => { if (!title.trim()) onDone(); else submit(); }}
        placeholder={t.spaceDetailPage.taskName}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          fontSize: 13, color: "var(--text)", fontFamily: "inherit",
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
}: {
  status:      StatusKey;
  tasks:       Doc<"tasks">[];
  projectId:   Id<"projects">;
  isDragOver:  boolean;
  onDragOver:  (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop:      (e: React.DragEvent) => void;
}) {
  const { t, locale } = useLocale();
  const cfg = getStatusConfig(t)[status];
  const [open,   setOpen]   = useState(true);
  const [adding, setAdding] = useState(false);

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        borderTop: "1px solid var(--border)",
        background: isDragOver ? "rgba(99,102,241,0.05)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {/* Status header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-dim)", display: "flex" }}
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
          <StatusDot status={status} />
          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.pillColor, letterSpacing: "0.03em" }}>
            {cfg.label}
          </span>
        </div>

        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{tasks.length}</span>
      </div>

      {open && (
        <>
          {/* Column headers — only when there are tasks */}
          {tasks.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center",
              padding: "4px 12px 4px 46px",
              borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ flex: 1, fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{t.spaceDetailPage.name}</span>
              <span style={{ width: 130, fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{t.spaceDetailPage.assignee}</span>
              <span style={{ width: 90,  fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>{t.spaceDetailPage.dueDate}</span>
            </div>
          )}

          {/* Task rows */}
          {tasks.map((task) => {
            const _eod = task.dueDate ? new Date(task.dueDate) : null;
            if (_eod) _eod.setHours(23, 59, 59, 999);
            const isOverdue = _eod && _eod.getTime() < Date.now() && task.status !== "completed";
            const name = task.memberName || t.unknown;
            return (
              <div
                key={task._id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("taskId",     task._id);
                  e.dataTransfer.setData("fromStatus", task.status);
                  e.dataTransfer.effectAllowed = "move";
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "grab",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <GripVertical size={13} style={{ color: "var(--text-dim)", flexShrink: 0, marginRight: 2 }} />
                <StatusDot status={task.status} />

                {/* Title */}
                <span style={{
                  flex: 1, fontSize: 13, color: "var(--text)", fontWeight: 400,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {task.title}
                </span>

                {/* Assignee (130px) */}
                <div style={{ width: 130, display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: "var(--accent-bg)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700, color: "var(--accent-light)",
                  }}>
                    {name[0].toUpperCase()}
                  </div>
                  <span style={{
                    fontSize: 11, color: "var(--text-muted)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {name}
                  </span>
                </div>

                {/* Due date (90px) */}
                <div style={{ width: 90, display: "flex", alignItems: "center", gap: 4 }}>
                  {task.dueDate ? (
                    <>
                      <CalendarDays size={11} style={{ color: isOverdue ? "var(--status-danger)" : "var(--text-dim)", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: isOverdue ? "var(--status-danger)" : "var(--text-muted)", fontWeight: isOverdue ? 600 : 400 }}>
                        {formatDate(task.dueDate, locale)}
                      </span>
                    </>
                  ) : (
                    <CalendarDays size={12} style={{ color: "var(--border2)" }} />
                  )}
                </div>
              </div>
            );
          })}

          {/* Inline add task */}
          {adding ? (
            <AddTaskInput
              projectId={projectId}
              status={status}
              onDone={() => setAdding(false)}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 12px 8px 46px", width: "100%",
                background: "none", border: "none", cursor: "pointer",
                borderTop: tasks.length > 0 ? "1px solid var(--border)" : "none",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              <Plus size={12} style={{ color: "var(--text-dim)" }} />
              <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{t.spaceDetailPage.addTask}</span>
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
        background: "var(--surface3)", overflow: "hidden",
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
        fontSize: 11, fontWeight: 600, color: pct === 100 ? "var(--status-success)" : "var(--text-dim)",
        minWidth: 30, textAlign: "right",
      }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  spaceName,
}: {
  project:   Pick<Doc<"projects">, "_id" | "name" | "status"> & { estimatedCompletionDate?: number; ownerId?: string; supporterId?: string };
  spaceName: string;
}) {
  const { orgId, can } = useAuth();
  const { t, locale } = useLocale();
  const tasks         = useQuery(api.tasks.listByProject, orgId ? { projectId: project._id } : "skip") ?? [];
  const members       = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const router         = useRouter();
  const updateStatus   = useMutation(api.tasks.updateTaskStatus);
  const updateProject  = useMutation(api.projects.update);
  const archiveProject = useMutation(api.projects.archive);

  const [open,           setOpen]           = useState(true);
  const [dragOverStatus, setDragOverStatus] = useState<StatusKey | null>(null);
  const [editingName,    setEditingName]    = useState(false);
  const [nameValue,      setNameValue]      = useState(project.name);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [linkCopied,     setLinkCopied]     = useState(false);
  const [adding,         setAdding]         = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/projects/${project._id}`);
    setLinkCopied(true);
    setMenuOpen(false);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const saveName = async () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== project.name) {
      await updateProject({ projectId: project._id, name: trimmed });
    } else {
      setNameValue(project.name);
    }
    setEditingName(false);
  };

  const grouped = STATUS_ORDER.reduce<Record<StatusKey, Doc<"tasks">[]>>(
    (acc, s) => { acc[s] = tasks.filter((tk) => tk.status === s); return acc; },
    { draft: [], in_progress: [], submitted: [], approved: [], completed: [] }
  );

  const visibleGroups = STATUS_ORDER.filter(
    (s) => s === "draft" || grouped[s].length > 0
  );

  const completedCount = tasks.filter((tk) => tk.status === "completed").length;
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleDragOver = (e: React.DragEvent, status: StatusKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  };

  const handleDrop = async (e: React.DragEvent, toStatus: StatusKey) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId     = e.dataTransfer.getData("taskId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (!taskId || fromStatus === toStatus) return;
    await updateStatus({ taskId: taskId as Id<"tasks">, status: toStatus });
  };

  const canEdit = can("project.edit");

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Project header */}
      <div style={{ padding: "16px 16px 0" }}>
        <p style={{ fontSize: 11, color: "var(--text-dim)", margin: "0 0 5px", fontWeight: 500, letterSpacing: "0.02em" }}>
          {spaceName}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 12 }}>
          <button
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-dim)", display: "flex" }}
          >
            {open
              ? <ChevronDown  size={15} strokeWidth={2.5} />
              : <ChevronRight size={15} strokeWidth={2.5} />}
          </button>
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setNameValue(project.name); setEditingName(false); }
              }}
              onBlur={saveName}
              style={{
                fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0,
                background: "var(--accent-subtle)", border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: 6, outline: "none", padding: "2px 8px",
                fontFamily: "inherit", minWidth: 160,
              }}
            />
          ) : (
            <>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {project.name}
              </h2>
              {canEdit && (
                <button
                  onClick={() => setEditingName(true)}
                  title={t.spaceDetailPage.rename}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-dim)", display: "flex", padding: "2px 4px", borderRadius: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-light)"; e.currentTarget.style.background = "var(--accent-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.background = "none"; }}
                >
                  <Pencil size={13} />
                </button>
              )}
            </>
          )}
          <div style={{ position: "relative", marginLeft: 2 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              style={{
                background: menuOpen ? "var(--surface2)" : "none",
                border: "none", cursor: "pointer", color: menuOpen ? "var(--text-muted)" : "var(--text-dim)",
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
                  background: "var(--surface)", border: "1px solid var(--border2)",
                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                  padding: "4px 0", minWidth: 170, overflow: "hidden",
                }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  onClick={() => router.push(`/projects/${project._id}`)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 12.5, color: "var(--text)", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <ExternalLink size={13} /> {t.spaceDetailPage.openProject}
                </button>
                <button
                  onClick={handleCopyLink}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 12.5, color: "var(--text)", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  {linkCopied ? <Check size={13} color="var(--status-success)" /> : <LinkIcon size={13} />}
                  {linkCopied ? t.copied : t.spaceDetailPage.copyLink}
                </button>
                {canEdit && (
                  <>
                    <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
                    <button
                      onClick={() => { setMenuOpen(false); setEditingName(true); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12.5, color: "var(--text)", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <Pencil size={13} /> {t.spaceDetailPage.rename}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); const next = project.status === "active" ? "on_hold" : "active"; updateProject({ projectId: project._id, status: next }); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12.5, color: "var(--text)", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      {project.status === "active" ? `⏸ ${t.spaceDetailPage.putOnHold}` : `▶ ${t.spaceDetailPage.setActive}`}
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); archiveProject({ projectId: project._id }); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12.5, color: "var(--status-danger)", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <Archive size={13} /> {t.spaceDetailPage.archive}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <span style={{
            marginLeft: "auto", fontSize: 11, color: "var(--text-dim)",
            background: "var(--surface2)", borderRadius: 5,
            padding: "2px 8px",
          }}>
            {tasks.length} {tasks.length !== 1 ? t.spaceDetailPage.tasks : t.spaceDetailPage.task}
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
          const isOverdue = ecd < Date.now() && pct < 100;
          const dateLocale = locale === "ar" ? "ar-SA" : "en-US";
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 5, paddingBottom: 8 }}>
              <CalendarDays size={11} style={{ color: isOverdue ? "var(--status-danger)" : "var(--text-dim)", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: isOverdue ? "var(--status-danger)" : "var(--text-dim)", fontWeight: isOverdue ? 700 : 400 }}>
                {isOverdue ? `${t.spaceDetailPage.overdue} · ` : `${t.spaceDetailPage.estCompletion} · `}
                {new Date(ecd).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          );
        })()}

        {/* Owner / Supporter */}
        {(() => {
          const owner     = members.find((m) => m._id === project.ownerId);
          const supporter = members.find((m) => m._id === project.supporterId);
          if (!owner && !supporter) return null;
          const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14 }}>
              {owner && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, color: "var(--accent-light)",
                  }}>
                    {initials(owner.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-light)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.spaceDetailPage.owner}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{owner.name}</p>
                  </div>
                </div>
              )}
              {owner && supporter && (
                <div style={{ width: 1, height: 24, background: "var(--border)" }} />
              )}
              {supporter && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(20,184,166,0.12)", border: "1px solid rgba(20,184,166,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 700, color: "#2dd4bf",
                  }}>
                    {initials(supporter.name)}
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#2dd4bf", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.spaceDetailPage.supporter}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{supporter.name}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Status groups — empty state */}
      {open && tasks.length === 0 && !adding && (
        <button
          onClick={() => setAdding(true)}
          style={{
            width: "100%", padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none",
            borderTop: "1px solid var(--border)",
            cursor: "pointer", transition: "background 0.1s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <Plus size={13} style={{ color: "var(--text-dim)" }} />
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
            {t.spaceDetailPage.noTasksYet}
          </span>
        </button>
      )}
      {open && tasks.length === 0 && adding && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          <AddTaskInput
            projectId={project._id}
            status="draft"
            onDone={() => setAdding(false)}
          />
        </div>
      )}
      {open && tasks.length > 0 && visibleGroups.map((status) => (
        <StatusGroup
          key={status}
          status={status}
          tasks={grouped[status]}
          projectId={project._id}
          isDragOver={dragOverStatus === status}
          onDragOver={(e) => handleDragOver(e, status)}
          onDragLeave={() => setDragOverStatus(null)}
          onDrop={(e) => handleDrop(e, status)}
        />
      ))}
    </div>
  );
}

// ── Mini left sidebar ─────────────────────────────────────────────────────────

function MiniSidebar({
  currentSpaceId,
  currentSpaceName,
}: {
  currentSpaceId: string;
  currentSpaceName: string;
}) {
  const router = useRouter();
  const { orgId } = useAuth();
  const { t } = useLocale();
  const allSpaces = useQuery(api.spaces.list, orgId ? { orgId } : "skip") ?? [];
  const otherSpaces = allSpaces.filter((s) => s._id !== currentSpaceId);

  const itemBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 9,
    padding: "7px 10px", borderRadius: 8, cursor: "pointer",
    transition: "background 0.1s", marginBottom: 1,
  };

  return (
    <div style={{
      width: 220, minWidth: 220,
      borderRight: "1px solid var(--border)",
      padding: "16px 8px",
      display: "flex", flexDirection: "column", gap: 2,
      overflowY: "auto",
    }}>
      {/* Section label */}
      <p style={{
        fontSize: 10, fontWeight: 700, color: "var(--text-dim)",
        textTransform: "uppercase", letterSpacing: "0.07em",
        padding: "0 6px", margin: "0 0 6px",
      }}>
        {t.spaceDetailPage.spaces}
      </p>

      {/* All Tasks — active (current space) */}
      <div style={{
        ...itemBase,
        background: "var(--accent-bg)",
        border: "1px solid rgba(99,102,241,0.2)",
      }}>
        <CheckSquare size={14} strokeWidth={1.8} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-light)", margin: 0 }}>{t.spaceDetailPage.allTasks}</p>
          <p style={{ fontSize: 10, color: "rgba(129,140,248,0.7)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {currentSpaceName}
          </p>
        </div>
      </div>

      {/* Team Space */}
      <div
        style={{ ...itemBase }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        <Users size={14} strokeWidth={1.8} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.spaceDetailPage.teamSpace}</span>
      </div>

      {/* Divider */}
      {otherSpaces.length > 0 && (
        <div style={{ height: 1, background: "var(--border)", margin: "8px 4px" }} />
      )}

      {/* Other spaces */}
      {otherSpaces.map((space) => (
        <div
          key={space._id}
          onClick={() => router.push(`/spaces/${space._id}`)}
          style={{ ...itemBase }}
          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          <div style={{
            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
            background: space.color ? `${space.color}18` : "var(--surface3)",
            border: `1px solid ${space.color ? `${space.color}40` : "var(--border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: space.color ?? "var(--text-muted)",
          }}>
            {space.icon && space.icon.trim() ? space.icon.trim()[0] : space.name[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {space.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Inline add project input ──────────────────────────────────────────────────

function AddProjectInline({
  spaceId,
  onDone,
}: {
  spaceId: Id<"spaces">;
  onDone: () => void;
}) {
  const { user, orgId } = useAuth();
  const { t } = useLocale();
  const createProject = useMutation(api.projects.create);
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !user?.memberId || !orgId) { onDone(); return; }
    await createProject({
      orgId,
      spaceId,
      name:      trimmed,
      ownerId:   user.memberId as Id<"members">,
      createdBy: user.memberId as Id<"members">,
    });
    setName("");
    onDone();
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
      borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
    }}>
      <Plus size={14} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
      <input
        ref={ref} autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onDone();
        }}
        onBlur={() => { if (!name.trim()) onDone(); else submit(); }}
        placeholder={t.spaceDetailPage.projectName}
        style={{
          flex: 1, background: "none", border: "none", outline: "none",
          fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: "inherit",
        }}
      />
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{t.spaceDetailPage.enterToSave}</span>
    </div>
  );
}

// ── Board column ─────────────────────────────────────────────────────────────

function BoardColumn({
  status,
  allTasks,
  onDrop,
}: {
  status:   StatusKey;
  allTasks: Doc<"tasks">[];
  onDrop:   (taskId: string, toStatus: StatusKey) => void;
}) {
  const router = useRouter();
  const { t, locale } = useLocale();
  const cfg = getStatusConfig(t)[status];
  const tasks = allTasks.filter((tk) => tk.status === status);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData("taskId");
        if (taskId) onDrop(taskId, status);
      }}
      style={{
        background: isDragOver ? "var(--accent-subtle)" : "var(--surface)",
        border: `1px solid ${isDragOver ? "var(--accent-border)" : "var(--border)"}`,
        borderRadius: 10, overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* Column header */}
      <div style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          padding: "2px 9px", borderRadius: 5,
          background: cfg.pillBg,
          border: cfg.pillBorder,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.pillColor, letterSpacing: "0.03em" }}>
            {cfg.label}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{tasks.length}</span>
      </div>

      {/* Task cards */}
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6, minHeight: 60 }}>
        {tasks.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "center", padding: "12px 0", margin: 0, fontStyle: "italic" }}>
            {t.spaceDetailPage.noTasks}
          </p>
        )}
        {tasks.map((task) => {
          const _eod2 = task.dueDate ? new Date(task.dueDate) : null;
          if (_eod2) _eod2.setHours(23, 59, 59, 999);
          const isOverdue = _eod2 && _eod2.getTime() < Date.now() && task.status !== "completed";
          const assignee = task.memberName || t.unknown;
          return (
            <div
              key={task._id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("taskId", task._id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => router.push(`/tasks/${task._id}`)}
              style={{
                padding: "10px 12px",
                background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 8, cursor: "grab",
                transition: "border-color 0.1s, box-shadow 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {/* Title */}
              <p style={{
                fontSize: 12.5, fontWeight: 500, color: "var(--text)",
                margin: "0 0 6px", lineHeight: 1.4,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {task.title}
              </p>

              {/* Meta row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Assignee avatar */}
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 700, color: "var(--accent-light)",
                }}>
                  {assignee[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {assignee}
                </span>

                {/* Due date */}
                {task.dueDate && (
                  <span style={{
                    fontSize: 10, color: isOverdue ? "var(--status-danger)" : "var(--text-dim)",
                    fontWeight: isOverdue ? 600 : 400, flexShrink: 0,
                  }}>
                    {formatDate(task.dueDate, locale)}
                  </span>
                )}

                {/* Priority dot */}
                {task.priority && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                    background: task.priority === "high" ? "var(--status-danger)" : task.priority === "medium" ? "var(--status-warning)" : "var(--status-success)",
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Bulk import section ──────────────────────────────────────────────────────

function BulkImportSection({
  projects,
}: {
  projects: { _id: Id<"projects">; name: string }[];
}) {
  const { orgId } = useAuth();
  const { t } = useLocale();
  const importTasks = useMutation(api.bulkImport.importTasks);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open,       setOpen]       = useState(false);
  const [projectId,  setProjectId]  = useState<string>("");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<{ tasksCreated: number; subtasksCreated: number; errors: string[] } | null>(null);
  const [error,      setError]      = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);

    if (!projectId) {
      setError(t.spaceDetailPage.noProjectSelected);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setError(t.spaceDetailPage.invalidFile);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Skip hint row (first data row where Type starts with "(")
      const rows = json
        .filter((r: any) => {
          const t = String(r["Type"] ?? r["type"] ?? "").trim();
          return t === "task" || t === "subtask";
        })
        .map((r: any) => ({
          type:        String(r["Type"]        ?? r["type"]        ?? "").trim().toLowerCase(),
          title:       String(r["Title"]       ?? r["title"]       ?? "").trim(),
          description: String(r["Description"] ?? r["description"] ?? "").trim() || undefined,
          parentTask:  String(r["Parent Task"] ?? r["parentTask"]  ?? "").trim() || undefined,
          assignee:    String(r["Assignee"]    ?? r["assignee"]    ?? "").trim() || undefined,
          priority:    String(r["Priority"]    ?? r["priority"]    ?? "").trim().toLowerCase() || undefined,
          tag:         String(r["Tag"]         ?? r["tag"]         ?? "").trim() || undefined,
          dueDate:     String(r["Due Date"]    ?? r["dueDate"]     ?? "").trim() || undefined,
        }));

      if (rows.length === 0) {
        setError(t.spaceDetailPage.parseError);
        setLoading(false);
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      const res = await importTasks({
        orgId: orgId as Id<"organizations">,
        projectId: projectId as Id<"projects">,
        rows,
      });

      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? t.spaceDetailPage.parseError);
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: "var(--surface)", border: "1px solid var(--border2)",
          color: "var(--text-muted)", cursor: "pointer",
          transition: "border-color 0.15s, color 0.15s",
          marginBottom: 16,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-muted)"; e.currentTarget.style.color = "var(--accent-light)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        <Upload size={13} /> {t.spaceDetailPage.bulkImport}
      </button>
    );
  }

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border2)",
      borderRadius: 14, padding: "18px 22px", marginBottom: 16,
      animation: "fadeIn 0.15s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FileSpreadsheet size={15} style={{ color: "var(--accent-light)" }} />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {t.spaceDetailPage.bulkImport}
          </h3>
        </div>
        <button
          onClick={() => { setOpen(false); setResult(null); setError(""); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", display: "flex", padding: 2 }}
        >
          <X size={15} />
        </button>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>
        {t.spaceDetailPage.bulkImportDesc}
      </p>

      {/* Download template link */}
      <a
        href="/bulk-task-template.xlsx"
        download
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, fontWeight: 600, color: "var(--accent-light)",
          textDecoration: "none", marginBottom: 14,
        }}
      >
        <Download size={12} /> {t.spaceDetailPage.downloadTemplate}
      </a>

      {/* Project selector + file input */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          style={{
            background: "var(--surface2)", border: "1px solid var(--border2)",
            borderRadius: 8, padding: "7px 12px", fontSize: 12,
            color: projectId ? "var(--text)" : "var(--text-dim)",
            outline: "none", minWidth: 180, cursor: "pointer",
          }}
        >
          <option value="">{t.spaceDetailPage.selectProject}</option>
          {projects.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        <label style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: projectId ? "var(--accent)" : "var(--surface3)",
          color: projectId ? "#fff" : "var(--text-dim)",
          cursor: projectId && !loading ? "pointer" : "not-allowed",
          opacity: loading ? 0.6 : 1,
          transition: "background 0.15s",
        }}>
          <Upload size={12} />
          {loading ? t.spaceDetailPage.importing : t.spaceDetailPage.uploadFile}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            disabled={!projectId || loading}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Results */}
      {result && (
        <div style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 8,
          background: result.errors.length > 0 ? "rgba(234,179,8,0.08)" : "rgba(34,197,94,0.08)",
          border: `1px solid ${result.errors.length > 0 ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)"}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: result.errors.length > 0 ? 8 : 0 }}>
            <CheckCircle2 size={13} style={{ color: "var(--status-success)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
              {t.spaceDetailPage.importSuccess
                .replace("{tasks}", String(result.tasksCreated))
                .replace("{subtasks}", String(result.subtasksCreated))}
            </span>
          </div>
          {result.errors.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--status-warning, #eab308)", margin: "0 0 4px" }}>
                <AlertCircle size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                {t.spaceDetailPage.importErrors}
              </p>
              {result.errors.map((err, i) => (
                <p key={i} style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 2px 16px" }}>• {err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !result && (
        <div style={{
          marginTop: 14, padding: "8px 12px", borderRadius: 8,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <AlertCircle size={12} style={{ color: "var(--status-danger)" }} />
          <span style={{ fontSize: 12, color: "var(--status-danger)" }}>{error}</span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SpaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, orgId, can } = useAuth();
  const { t } = useLocale();
  const canCreateProject = can("project.create");

  const spaceId = params.spaceId as Id<"spaces">;

  const space    = useQuery(api.spaces.getById, orgId ? { spaceId } : "skip");
  const projects = useQuery(
    api.projects.listBySpace,
    orgId && user?.memberId ? { spaceId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];

  const allMembers = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];

  // Gather all tasks for this space's projects (for board view & calendar)
  const allProjectIds = projects.filter((p) => p.status !== "archived").map((p) => p._id);
  const allTasks = useQuery(api.tasks.listAllTasks, orgId ? { orgId } : "skip") ?? [];
  const spaceTasks = allTasks.filter((tk) => tk.projectId && allProjectIds.includes(tk.projectId));
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);

  const handleBoardDrop = async (taskId: string, toStatus: StatusKey) => {
    await updateTaskStatus({ taskId: taskId as Id<"tasks">, status: toStatus });
  };

  const [view,          setView]          = useState<"list" | "board" | "calendar">("list");
  const [addingProject, setAddingProject] = useState(false);

  if (!space || !user) {
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{t.loading}…</p>
        </main>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status !== "archived");

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar />

      {/* Inner layout: mini-sidebar + main area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Mini sidebar */}
        <MiniSidebar
          currentSpaceId={spaceId}
          currentSpaceName={space.name}
        />

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* View tab bar */}
          <div style={{
            display: "flex", alignItems: "center",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)", flexShrink: 0,
            padding: "0 20px",
          }}>
            {/* Space icon + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 0", marginRight: 20 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                background: space.color ? `${space.color}18` : "var(--surface3)",
                border: `1px solid ${space.color ? `${space.color}40` : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: space.color ?? "var(--text-muted)",
              }}>
                {space.icon && space.icon.trim() ? space.icon.trim()[0] : space.name[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{space.name}</span>
            </div>

            {/* Tabs */}
            {([
              { id: "list",     label: t.spaceDetailPage.list,     icon: <LayoutList  size={13} /> },
              { id: "board",    label: t.spaceDetailPage.board,    icon: <LayoutGrid  size={13} /> },
              { id: "calendar", label: t.spaceDetailPage.calendar, icon: <Calendar    size={13} /> },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setView(tab.id as "list" | "board" | "calendar");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "14px 14px", fontSize: 13, fontWeight: 500,
                  background: "none", border: "none", cursor: "pointer",
                  color: view === tab.id ? "var(--text)" : "var(--text-dim)",
                  borderBottom: view === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: "-1px",
                  transition: "color 0.15s",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

            {/* ── LIST VIEW ──────────────────────────────────────────────── */}
            {view === "list" && (
              <>
                {/* Bulk import */}
                {user?.memberId && (
                  <BulkImportSection projects={activeProjects.map((p) => ({ _id: p._id, name: p.name }))} />
                )}

                {activeProjects.length === 0 && !addingProject ? (
                  <div style={{ textAlign: "center", padding: "80px 20px" }}>
                    <p style={{ fontSize: 14, color: "var(--text-dim)", margin: "0 0 6px" }}>{t.spaceDetailPage.noProjectsYet}</p>
                    {canCreateProject && (
                      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
                        {t.spaceDetailPage.addProjectHint}
                      </p>
                    )}
                  </div>
                ) : (
                  activeProjects.map((project) => (
                    <ProjectCard
                      key={project._id}
                      project={project}
                      spaceName={space.name}
                    />
                  ))
                )}

                {/* Inline add project */}
                {addingProject && (
                  <AddProjectInline
                    spaceId={spaceId}
                    onDone={() => setAddingProject(false)}
                  />
                )}

                {/* Add Project button */}
                {canCreateProject && !addingProject && (
                  <button
                    onClick={() => setAddingProject(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "12px 16px",
                      background: "none",
                      border: "1px dashed var(--border2)",
                      borderRadius: 10, cursor: "pointer",
                      color: "var(--text-dim)", fontSize: 13,
                      transition: "border-color 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-muted)";
                      e.currentTarget.style.color = "var(--accent-light)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border2)";
                      e.currentTarget.style.color = "var(--text-dim)";
                    }}
                  >
                    <Plus size={14} />
                    {t.spaceDetailPage.addProject}
                  </button>
                )}
              </>
            )}

            {/* ── BOARD VIEW ─────────────────────────────────────────────── */}
            {view === "board" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12, alignItems: "start",
              }}>
                {(["draft", "in_progress", "submitted", "completed"] as const).map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    allTasks={spaceTasks}
                    onDrop={handleBoardDrop}
                  />
                ))}
              </div>
            )}

            {view === "calendar" && (
              <ProjectCalendar
                tasks={spaceTasks.map((t) => ({
                  _id: t._id,
                  title: t.title,
                  status: t.status,
                  priority: t.priority,
                  memberId: t.memberId,
                  memberName: t.memberName,
                  submissionDate: t.submissionDate,
                }))}
                members={allMembers.map((m) => ({ _id: m._id, name: m.name }))}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
