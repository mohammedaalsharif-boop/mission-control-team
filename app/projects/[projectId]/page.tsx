"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import TaskCard from "@/components/tasks/TaskCard";
import {
  Plus, ChevronRight, ChevronLeft, X,
  LayoutGrid, List, Users, Search,
  Calendar, AlertTriangle, Sparkles, Pencil, UserCircle2, ChevronDown, Activity, PieChart,
} from "lucide-react";
import { TeamTask } from "@/lib/task-types";
import ListView from "@/components/tasks/ListView";
import ProjectCalendar from "@/components/tasks/ProjectCalendar";
import ProjectTimeline from "@/components/tasks/ProjectTimeline";
import ProjectOverview from "@/components/tasks/ProjectOverview";

const EMPTY_FORM = { title: "", desc: "", tag: "", priority: "medium", dueDate: "", visibility: "public", assigneeId: "", assigneeName: "" };

function toTeamTask(tk: any): TeamTask {
  return {
    id:              tk._id,
    title:           tk.title,
    description:     tk.description,
    status:          tk.status,
    memberId:        tk.memberId,
    memberName:      tk.memberName || "?",
    priority:        tk.priority ?? "medium",
    tag:             tk.tag,
    submissionDate:  tk.submissionDate ? new Date(tk.submissionDate) : undefined,
    submittedAt:     tk.submittedAt    ? new Date(tk.submittedAt)    : undefined,
    approvedAt:      tk.approvedAt     ? new Date(tk.approvedAt)     : undefined,
    rejectedAt:      tk.rejectedAt     ? new Date(tk.rejectedAt)     : undefined,
    rejectionReason: tk.rejectionReason,
    createdAt:       new Date(tk.createdAt),
    updatedAt:       new Date(tk.updatedAt),
    isRecurring:        tk.isRecurring,
    recurrenceRule:     tk.recurrenceRule,
    recurrenceInterval: tk.recurrenceInterval,
    recurrenceDays:     tk.recurrenceDays,
    nextRecurrenceAt:   tk.nextRecurrenceAt,
    parentRecurringId:  tk.parentRecurringId,
  };
}

// ── Project Members Panel ─────────────────────────────────────────────────────

function MembersPanel({
  projectId,
  onClose,
}: {
  projectId: Id<"projects">;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { orgId, can } = useAuth();
  const members         = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const projectMembersArgs = orgId ? { projectId } : "skip" as const;
  const projectMembers  = useQuery(api.projects.listMembers, projectMembersArgs) ?? [];
  const addMember       = useMutation(api.projects.addMember);
  const removeMember    = useMutation(api.projects.removeMember);

  const memberIds = new Set(projectMembers.map((mk: any) => mk._id));
  const nonMembers = members.filter((m) => !memberIds.has(m._id));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border2)",
        borderRadius: 16, padding: "24px 28px", width: 420,
        boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {t.projectPage.projectMembers}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </div>

        {/* Current members */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            {t.projectPage.members} ({projectMembers.length})
          </p>
          {projectMembers.map((m: any) => (
            <div key={m._id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 10px", borderRadius: 8, marginBottom: 2,
              background: "var(--surface2)",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
              }}>
                {m.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", margin: 0 }}>{m.name}</p>
                <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0 }}>{m.role}</p>
              </div>
              {can("member.remove") && m.role !== "admin" && (
                <button
                  onClick={() => removeMember({ projectId, memberId: m._id })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add members */}
        {can("member.invite") && nonMembers.length > 0 && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              {t.projectPage.addMembers}
            </p>
            {nonMembers.map((m) => (
              <div key={m._id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 10px", borderRadius: 8, marginBottom: 2,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, color: "var(--text)", margin: 0 }}>{m.name}</p>
                </div>
                <button
                  onClick={() => addMember({ projectId, memberId: m._id })}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px",
                    borderRadius: 6, background: "var(--accent-bg)",
                    border: "1px solid rgba(99,102,241,0.3)", color: "var(--accent-light)",
                    cursor: "pointer",
                  }}
                >
                  {t.add}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── User Picker ───────────────────────────────────────────────────────────────

function UserPicker({
  label,
  selectedId,
  members,
  canEdit,
  onSelect,
}: {
  label:      string;
  selectedId: string | undefined;
  members:    { _id: string; name: string; role: string }[];
  canEdit:    boolean;
  onSelect:   (id: string | null) => void;
}) {
  const { t } = useLocale();
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");

  const selected  = members.find((m) => m._id === selectedId);
  const filtered  = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name: string) => name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ position: "relative" }}>
      <span style={{
        fontSize: 10, fontWeight: 600, color: "var(--text-dim)",
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 4, display: "block",
      }}>
        {label}
      </span>

      <button
        onClick={() => canEdit && setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: open ? "var(--surface2)" : "none",
          border: "1px solid " + (open ? "var(--accent-muted)" : "transparent"),
          borderRadius: 8, padding: "4px 8px 4px 4px",
          cursor: canEdit ? "pointer" : "default",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { if (canEdit) e.currentTarget.style.background = "var(--surface2)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "none"; }}
      >
        {selected ? (
          <>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: label === t.projectPage.owner ? "var(--accent-bg)" : "rgba(20,184,166,0.15)",
              border:     label === t.projectPage.owner ? "1.5px solid rgba(99,102,241,0.35)" : "1.5px solid rgba(20,184,166,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
              color: label === t.projectPage.owner ? "var(--accent-light)" : "#2dd4bf",
            }}>
              {initials(selected.name)}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{selected.name}</span>
          </>
        ) : (
          <>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: "var(--surface2)", border: "1.5px dashed var(--border2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <UserCircle2 size={14} style={{ color: "var(--text-muted)", opacity: 0.6 }} />
            </div>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.projectPage.unassigned}</span>
          </>
        )}
        {canEdit && <ChevronDown size={11} style={{ color: "var(--text-muted)", marginLeft: 2 }} />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
            onClick={() => { setOpen(false); setSearch(""); }}
          />
          {/* Dropdown */}
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border2)",
            borderRadius: 12, width: 220,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}>
            {/* Search */}
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
              <input
                autoFocus
                placeholder={t.projectPage.searchMembers}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", background: "var(--surface2)", border: "none",
                  borderRadius: 6, padding: "5px 10px", fontSize: 12,
                  color: "var(--text)", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            {/* Options */}
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {/* Unassign option */}
              {selected && (
                <button
                  onClick={() => { onSelect(null); setOpen(false); setSearch(""); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <X size={14} /> {t.projectPage.removeAssignment}
                </button>
              )}
              {filtered.map((m) => (
                <button
                  key={m._id}
                  onClick={() => { onSelect(m._id); setOpen(false); setSearch(""); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 12px", background: m._id === selectedId ? "var(--surface2)" : "none",
                    border: "none", cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface2)"}
                  onMouseLeave={(e) => { e.currentTarget.style.background = m._id === selectedId ? "var(--surface2)" : "none"; }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: label === t.projectPage.owner ? "rgba(99,102,241,0.2)" : "rgba(20,184,166,0.2)",
                    border: label === t.projectPage.owner ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(20,184,166,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 700,
                    color: label === t.projectPage.owner ? "var(--accent-light)" : "#2dd4bf",
                  }}>
                    {initials(m.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, textTransform: "capitalize" }}>{m.role}</p>
                  </div>
                  {m._id === selectedId && (
                    <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 12px", margin: 0 }}>{t.projectPage.noMembersFound}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const { t, locale } = useLocale();
  const params = useParams();
  const router = useRouter();
  const { user, orgId, can } = useAuth();
  const canApproveTask = can("task.approve");

  const projectId = params.projectId as Id<"projects">;

  const project = useQuery(api.projects.getById, orgId ? { projectId } : "skip");
  const space   = useQuery(
    api.spaces.getById,
    orgId && project?.spaceId ? { spaceId: project.spaceId } : "skip"
  );
  const tasks = useQuery(
    api.tasks.listByProjectForViewer,
    orgId && user?.memberId ? { projectId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];
  const members = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const activities = useQuery(
    api.tasks.getProjectActivities,
    orgId ? { projectId } : "skip"
  ) ?? [];

  const createTask     = useMutation(api.tasks.createTask);
  const moveTask       = useMutation(api.tasks.updateTaskStatus);
  const submitTask     = useMutation(api.tasks.submitTask);
  const approveTask    = useMutation(api.tasks.approveTask);
  const rejectTask     = useMutation(api.tasks.rejectTask);
  const deleteTask     = useMutation(api.tasks.deleteTask);
  const updateProject  = useMutation(api.projects.update);

  const COLUMNS = [
    { id: "draft",       label: t.projectPage.toDo,       dot: "var(--text-muted)" },
    { id: "in_progress", label: t.projectPage.inProgress, dot: "var(--status-info)" },
    { id: "submitted",   label: t.projectPage.submitted,  dot: "var(--status-warning)" },
    { id: "completed",   label: t.projectPage.completedLabel, dot: "var(--status-success)" },
  ];

  const PRIORITY_OPTIONS = [
    { value: "high",   label: t.projectPage.high,   color: "var(--status-danger)" },
    { value: "medium", label: t.projectPage.medium, color: "var(--status-warning)" },
    { value: "low",    label: t.projectPage.low,    color: "var(--status-success)" },
  ];

  const [view,            setView]            = useState<"overview" | "kanban" | "list" | "calendar" | "activity">("kanban");
  const [addingCol,       setAddingCol]       = useState<string | null>(null);
  const [form,            setForm]            = useState(EMPTY_FORM);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [dragOver,        setDragOver]        = useState<string | null>(null);
  const [search,          setSearch]          = useState("");
  const [filter,          setFilter]          = useState<"all" | "mine">("all");
  const [showMembers,     setShowMembers]     = useState(false);
  const [listTrigger,     setListTrigger]     = useState<string | null>(null);
  const [northStarOpen,   setNorthStarOpen]   = useState(false);
  const [northStarDraft,  setNorthStarDraft]  = useState("");
  const [editingECD,      setEditingECD]      = useState(false);

  if (!project || !user) {
    return (
      <div style={{ display: "flex", height: "100vh", background: "var(--bg)" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>{t.loading}</p>
        </main>
      </div>
    );
  }

  // Filter tasks
  const visible = tasks.filter((t) => {
    if (filter === "mine" && t.memberId !== user.memberId) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const colTasks = (colId: string) => visible.filter((t) => t.status === colId);

  // Stats
  const total      = tasks.length;
  const completed  = tasks.filter((t) => t.status === "completed").length;
  const submitted  = tasks.filter((t) => t.status === "submitted").length;
  const overdue    = tasks.filter((t) => {
    if (!t.dueDate || t.status === "completed") return false;
    const eod = new Date(t.dueDate); eod.setHours(23, 59, 59, 999);
    return eod.getTime() < Date.now();
  }).length;
  const progress   = total > 0 ? Math.round((completed / total) * 100) : 0;

  const canAssignTask = can("task.assign");

  const handleAdd = async (colId: string, overrideForm?: { title: string; desc: string; priority: string; dueDate: string; tag: string }) => {
    const f = overrideForm ?? form;
    if (!f.title.trim() || !orgId) return;
    if (!f.dueDate) {
      setFormError("Due date is required");
      return;
    }
    setFormError(null);
    const assigneeId   = (canAssignTask && form.assigneeId)   ? form.assigneeId   : user.memberId;
    const assigneeName = (canAssignTask && form.assigneeName) ? form.assigneeName : user.name;
    try {
      await createTask({
        orgId,
        projectId,
        title:          f.title.trim(),
        description:    f.desc.trim(),
        memberId:       assigneeId as Id<"members">,
        memberName:     assigneeName,
        priority:       f.priority,
        tag:            f.tag.trim() || undefined,
        dueDate:        new Date(f.dueDate).getTime(),
        submissionDate: new Date(f.dueDate).getTime(),
        visibility:     "public",
      });
      if (!overrideForm) {
        setForm(EMPTY_FORM);
        setAddingCol(null);
      }
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to create task. Please try again.");
    }
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(colId);
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOver(null);
    const taskId = e.dataTransfer.getData("taskId");
    if (!taskId) return;
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === colId) return;
    const canMove = can("task.edit") || task.memberId === user.memberId;
    if (!canMove) return;
    await moveTask({ taskId: task._id as Id<"tasks">, status: colId });
  };

  const STATUS_COLORS: Record<string, string> = {
    active:    "var(--status-success)",
    on_hold:   "var(--status-warning)",
    completed: "var(--accent-light)",
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Project header */}
        <div style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)", flexShrink: 0,
        }}>
          {/* Row 1: Breadcrumb + Members button */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 28px 0",
          }}>
            <button
              onClick={() => router.push(space ? `/spaces/${space._id}` : "/spaces")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", padding: "4px 0",
                display: "flex", alignItems: "center", gap: 5, fontSize: 12,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              <ChevronLeft size={14} />
              {space?.name ?? t.projectPage.spaces}
            </button>
            <button
              onClick={() => setShowMembers(true)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: "none", border: "1px solid var(--border2)",
                color: "var(--text-muted)", cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "var(--border2)"; }}
            >
              <Users size={13} /> {t.projectPage.members}
            </button>
          </div>

          {/* Row 2: Title + Status + Priority */}
          <div style={{ padding: "8px 28px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0, letterSpacing: "-0.01em" }}>
              {project.name}
            </h1>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
              background: `${STATUS_COLORS[project.status] ?? "#6b7280"}14`,
              color: STATUS_COLORS[project.status] ?? "#6b7280",
              letterSpacing: "0.02em",
            }}>
              {project.status.replace("_", " ")}
            </span>
            {project.priority && (
              <span style={{
                fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20,
                background: "var(--surface2)", color: "var(--text-muted)",
              }}>
                {project.priority}
              </span>
            )}
          </div>

          {/* Row 3: Meta strip — Owner · Supporter · Stats · ECD */}
          <div style={{
            display: "flex", alignItems: "center", gap: 0,
            padding: "12px 28px 14px",
          }}>
            {/* Owner + Supporter */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <UserPicker
                label={t.projectPage.owner}
                selectedId={(project as any).ownerId}
                members={members}
                canEdit={can("project.edit")}
                onSelect={(id) => updateProject({ projectId, ownerId: id ? id as Id<"members"> : undefined })}
              />
              <UserPicker
                label={t.projectPage.supporter}
                selectedId={(project as any).supporterId}
                members={members}
                canEdit={can("project.edit")}
                onSelect={(id) => updateProject({ projectId, supporterId: id ? id as Id<"members"> : undefined })}
              />
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 24px" }} />

            {/* Stats */}
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {[
                { label: t.projectPage.tasks,     value: total,           color: "var(--text)" },
                { label: t.projectPage.done,      value: `${progress}%`,  color: "var(--status-success)"     },
                { label: t.projectPage.submitted, value: submitted,        color: "var(--status-warning)"     },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ textAlign: "center", minWidth: 44 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color, margin: 0, lineHeight: 1.2 }}>{value}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0", fontWeight: 500 }}>{label}</p>
                </div>
              ))}
              {overdue > 0 && (
                <div style={{ textAlign: "center", minWidth: 44 }}>
                  <p style={{ fontSize: 17, fontWeight: 700, color: "var(--status-danger)", margin: 0, lineHeight: 1.2, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <AlertTriangle size={13} /> {overdue}
                  </p>
                  <p style={{ fontSize: 10, color: "var(--status-danger)", margin: "2px 0 0", fontWeight: 500 }}>{t.projectPage.overdue}</p>
                </div>
              )}
            </div>

            {/* ECD — pushed to far right */}
            {(() => {
              const ecd = (project as any).estimatedCompletionDate as number | undefined;
              const ecdEod = ecd ? new Date(ecd) : null;
              if (ecdEod) ecdEod.setHours(23,59,59,999);
              const isOverdueProject = ecdEod && ecdEod.getTime() < Date.now() && progress < 100;
              if (!ecd && !can("project.edit")) return null;
              return (
                <>
                  <div style={{ width: 1, height: 28, background: "var(--border)", margin: "0 24px" }} />
                  <div style={{ textAlign: "center" }}>
                    {editingECD ? (
                      <input
                        type="date"
                        autoFocus
                        defaultValue={ecd ? new Date(ecd).toISOString().split("T")[0] : ""}
                        onBlur={async (e) => {
                          const val = e.target.value;
                          await updateProject({ projectId, estimatedCompletionDate: val ? new Date(val).getTime() : undefined });
                          setEditingECD(false);
                        }}
                        onKeyDown={(e) => { if (e.key === "Escape") setEditingECD(false); }}
                        style={{
                          fontSize: 12, background: "var(--surface2)", border: "1px solid rgba(99,102,241,0.4)",
                          borderRadius: 6, color: "var(--text)", outline: "none", padding: "3px 8px",
                          fontFamily: "inherit",
                        }}
                      />
                    ) : (
                      <p
                        onClick={() => can("project.edit") && setEditingECD(true)}
                        style={{
                          fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.2,
                          color: isOverdueProject ? "var(--status-danger)" : "var(--text)",
                          cursor: can("project.edit") ? "pointer" : "default",
                          display: "flex", alignItems: "center", gap: 4,
                        }}
                      >
                        {isOverdueProject && <AlertTriangle size={12} />}
                        {ecd
                          ? new Date(ecd).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { day: "numeric", month: "short", year: "numeric" })
                          : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.projectPage.setDate}</span>}
                      </p>
                    )}
                    <p style={{ fontSize: 10, color: isOverdueProject ? "var(--status-danger)" : "var(--text-muted)", margin: "2px 0 0", fontWeight: 500 }}>
                      {isOverdueProject ? t.projectPage.overdue : t.projectPage.estCompletion}
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          display: "flex",
          alignItems: "center", gap: 12, padding: "10px 24px",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          {/* New Task + Search + Filter — hidden in overview mode */}
          {view !== "overview" && (
            <>
              <button
                onClick={() => {
                  if (view === "list") {
                    setListTrigger("draft");
                  } else {
                    setAddingCol("draft");
                    setForm(EMPTY_FORM);
                    setFormError(null);
                  }
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: "pointer", border: "none", background: "var(--accent)", color: "#fff",
                }}
              >
                <Plus size={14} /> {t.projectPage.newTask}
              </button>

              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{
                  position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-muted)", pointerEvents: "none",
                }} />
                <input
                  type="text" placeholder={t.projectPage.searchTasks}
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: "5px 10px 5px 28px", width: 180, borderRadius: 8, fontSize: 12,
                    background: "var(--surface2)", border: "1px solid var(--border2)",
                    color: "var(--text)", outline: "none",
                  }}
                />
              </div>
            </>
          )}

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {/* Filter — hidden in overview mode */}
            {view !== "overview" && (
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {(["all", "mine"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                    cursor: "pointer", textTransform: "capitalize",
                    border:     filter === f ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                    background: filter === f ? "var(--accent-bg)" : "transparent",
                    color:      filter === f ? "var(--accent-light)" : "var(--text-muted)",
                  }}>
                    {f === "all" ? t.projectPage.all : t.projectPage.mine}
                  </button>
                ))}
              </div>
            )}

            {/* View toggle — always visible */}
            <div style={{
              display: "flex", alignItems: "center", gap: 2,
              background: "var(--surface2)", border: "1px solid var(--border2)",
              borderRadius: 8, padding: 3,
            }}>
              {([
                { id: "overview",  icon: <PieChart   size={13} />, label: t.projectPage.overview ?? "Overview" },
                { id: "kanban",    icon: <LayoutGrid size={13} />, label: t.projectPage.kanban   },
                { id: "list",      icon: <List       size={13} />, label: t.projectPage.list     },
                { id: "calendar",  icon: <Calendar   size={13} />, label: t.projectPage.calendar },
                { id: "activity",  icon: <Activity   size={13} />, label: t.projectPage.activity ?? "Activity" },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", border: "none",
                    background: view === v.id ? "var(--surface)"    : "transparent",
                    color:      view === v.id ? "var(--text)"       : "var(--text-muted)",
                    boxShadow:  view === v.id ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── North Star banner — hidden in overview mode ──────────────── */}
        <div style={{
          flexShrink: 0,
          padding: "0 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: view === "overview" ? "none" : "block",
        }}>
          {project.northStar ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", margin: "10px 0",
              background: "var(--accent-subtle)",
              border: "1px solid rgba(99,102,241,0.18)",
              borderLeft: "3px solid var(--accent)",
              borderRadius: 10,
            }}>
              <Sparkles size={14} style={{ color: "var(--accent-light)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent-light)", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 2 }}>
                  {t.projectPage.northStar}
                </span>
                <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.4, fontStyle: "italic" }}>
                  "{project.northStar}"
                </span>
              </div>
              {can("project.edit") && (
                <button
                  onClick={() => { setNorthStarDraft(project.northStar ?? ""); setNorthStarOpen(true); }}
                  title="Edit North Star"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", padding: 4, borderRadius: 6,
                    display: "flex", flexShrink: 0, transition: "color 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-light)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
          ) : can("project.edit") ? (
            <button
              onClick={() => { setNorthStarDraft(""); setNorthStarOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 12px", margin: "8px 0",
                background: "none",
                border: "1px dashed var(--border2)",
                borderRadius: 10, cursor: "pointer",
                color: "var(--text-muted)", fontSize: 12, fontWeight: 500,
                transition: "all 0.15s", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-muted)";
                e.currentTarget.style.color = "var(--accent-light)";
                e.currentTarget.style.background = "rgba(99,102,241,0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.background = "none";
              }}
            >
              <Sparkles size={13} />
              {t.projectPage.setNorthStar}
            </button>
          ) : null}

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 14px" }}>
              <div style={{ flex: 1, height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  width: `${progress}%`,
                  background: progress === 100 ? "var(--status-success)" : "var(--accent)",
                  transition: "width 0.5s ease",
                  minWidth: progress > 0 ? 6 : 0,
                }} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 36, textAlign: "right",
                color: progress === 100 ? "var(--status-success)" : "var(--text-muted)",
              }}>
                {progress}%
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {completed}/{total} {t.projectPage.doneCount}
              </span>
            </div>
          )}
        </div>

        {/* ── North Star edit modal ───────────────────────────────────────── */}
        {northStarOpen && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
            onClick={(e) => { if (e.target === e.currentTarget) setNorthStarOpen(false); }}
          >
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border2)",
              borderRadius: 16, padding: "28px", width: 520, maxWidth: "calc(100vw - 32px)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={16} style={{ color: "var(--accent-light)" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                    {t.projectPage.editNorthStar}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                    {t.projectPage.northStarQuestion}
                  </p>
                </div>
                <button
                  onClick={() => setNorthStarOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 6, display: "flex" }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Input */}
              <textarea
                autoFocus
                rows={3}
                placeholder={t.projectPage.northStarPlaceholder}
                value={northStarDraft}
                onChange={(e) => setNorthStarDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setNorthStarOpen(false);
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    updateProject({ projectId, northStar: northStarDraft.trim() });
                    setNorthStarOpen(false);
                  }
                }}
                style={{
                  background: "var(--surface2)", border: "1px solid var(--border2)",
                  borderRadius: 10, padding: "12px 14px", fontSize: 13,
                  color: "var(--text)", outline: "none", resize: "none",
                  lineHeight: 1.55, fontFamily: "inherit", width: "100%", boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; }}
              />

              <p style={{ fontSize: 11, color: "var(--text-dim)", margin: 0 }}>
                {t.projectPage.northStarTip}
              </p>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                {project.northStar && (
                  <button
                    onClick={async () => {
                      await updateProject({ projectId, northStar: "" });
                      setNorthStarOpen(false);
                    }}
                    style={{
                      marginRight: "auto", padding: "8px 14px", borderRadius: 8,
                      fontSize: 12, background: "none",
                      border: "1px solid var(--border2)", color: "var(--text-muted)",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {t.projectPage.clear}
                  </button>
                )}
                <button
                  onClick={() => setNorthStarOpen(false)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 12,
                    background: "var(--surface2)", border: "1px solid var(--border2)",
                    color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={async () => {
                    await updateProject({ projectId, northStar: northStarDraft.trim() });
                    setNorthStarOpen(false);
                  }}
                  disabled={!northStarDraft.trim()}
                  style={{
                    padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: northStarDraft.trim() ? "var(--accent)" : "var(--surface3)",
                    color: northStarDraft.trim() ? "#fff" : "var(--text-dim)",
                    border: "none", cursor: northStarDraft.trim() ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overview dashboard */}
        {view === "overview" && (
          <ProjectOverview
            project={project as any}
            tasks={tasks as any}
            members={members as any}
            projectId={projectId as string}
            onSwitchView={(v: string) => setView(v as any)}
          />
        )}

        {/* Activity timeline view */}
        {view === "activity" && (
          <ProjectTimeline activities={activities as any} />
        )}

        {/* Calendar view */}
        {view === "calendar" && (
          <ProjectCalendar
            tasks={visible.map((t) => ({
              _id: t._id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              memberId: t.memberId,
              memberName: t.memberName,
              submissionDate: t.submissionDate,
            }))}
            members={members}
          />
        )}

        {/* List view */}
        {view === "list" && (
          <ListView
            tasks={visible.map(toTeamTask)}
            isAdmin={canApproveTask}
            currentUserId={user.memberId}
            triggerAddStatus={listTrigger}
            onTriggerConsumed={() => setListTrigger(null)}
            onCreateTask={(statusId, data) => handleAdd(statusId, data)}
            onSubmit={(id) => submitTask({ taskId: id as any })}
            onApprove={(id) => approveTask({ taskId: id as any })}
            onReject={(id, reason) => rejectTask({ taskId: id as any, reason })}
            onDelete={(id) => deleteTask({ taskId: id as any })}
            onTaskClick={() => {}}
          />
        )}

        {/* Kanban board */}
        <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", display: view === "kanban" ? "flex" : "none", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
            gridTemplateRows: "1fr",
            gap: 1, flex: 1, minHeight: 0, minWidth: 800,
          }}>
            {COLUMNS.map((col) => {
              const colItems = colTasks(col.id);
              const isAdding = addingCol === col.id;
              const isDragTarget = dragOver === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  style={{
                    display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
                    borderRight: "1px solid var(--border)",
                    background: isDragTarget ? "rgba(99,102,241,0.04)" : "transparent",
                    overflow: "hidden",
                    transition: "background 0.15s",
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    padding: "14px 14px 8px",
                    display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: col.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{col.label}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, marginLeft: "auto",
                      background: "var(--surface2)", color: "var(--text-muted)",
                      borderRadius: 10, padding: "1px 7px",
                    }}>
                      {colItems.length}
                    </span>
                    <button
                      onClick={() => { setAddingCol(isAdding ? null : col.id); setFormError(null); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, marginLeft: 2 }}
                    >
                      <Plus size={14} strokeWidth={1.8} />
                    </button>
                  </div>

                  {/* Tasks list */}
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "0 8px 12px" }}>
                    {isAdding && (
                      <div style={{
                        background: "var(--surface)", border: "1px solid var(--border2)",
                        borderRadius: 10, padding: 12, marginBottom: 8,
                        display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        <input
                          autoFocus placeholder={t.projectPage.taskTitle}
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(col.id); if (e.key === "Escape") { setAddingCol(null); setFormError(null); } }}
                          style={{
                            background: "var(--surface2)", border: "1px solid var(--border2)",
                            borderRadius: 7, padding: "7px 10px", fontSize: 13,
                            color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box",
                          }}
                        />
                        <textarea
                          placeholder={t.projectPage.descriptionOptional}
                          rows={2}
                          value={form.desc}
                          onChange={(e) => setForm({ ...form, desc: e.target.value })}
                          style={{
                            background: "var(--surface2)", border: "1px solid var(--border2)",
                            borderRadius: 7, padding: "7px 10px", fontSize: 12,
                            color: "var(--text)", outline: "none", width: "100%",
                            boxSizing: "border-box", resize: "none", fontFamily: "inherit",
                          }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          {PRIORITY_OPTIONS.map((p) => {
                            const active = form.priority === p.value;
                            return (
                              <button
                                key={p.value}
                                onClick={() => setForm({ ...form, priority: p.value })}
                                style={{
                                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                  padding: "5px 0", borderRadius: 7, fontSize: 11, fontWeight: 600,
                                  cursor: "pointer", transition: "all 0.12s",
                                  background: active ? `${p.color}20` : "var(--surface2)",
                                  border:     active ? `1px solid ${p.color}55` : "1px solid var(--border2)",
                                  color:      active ? p.color : "var(--text-muted)",
                                }}
                              >
                                <span style={{
                                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                  background: active ? p.color : "var(--text-dim)",
                                  transition: "background 0.12s",
                                }} />
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                        <div>
                          <input
                            type="date"
                            value={form.dueDate}
                            onChange={(e) => { setForm({ ...form, dueDate: e.target.value }); setFormError(null); }}
                            style={{ background: "var(--surface2)", border: `1px solid ${formError ? "var(--status-danger)" : "var(--border2)"}`, borderRadius: 7, padding: "6px 8px", fontSize: 11, color: "var(--text)", outline: "none", width: "100%", boxSizing: "border-box" }}
                          />
                          {formError && (
                            <p style={{ color: "var(--status-danger)", fontSize: 11, margin: "4px 0 0", fontWeight: 500 }}>
                              {formError}
                            </p>
                          )}
                        </div>
                        {/* Assign to (admin/manager only) */}
                        {canAssignTask && members.length > 0 && (
                          <select
                            value={form.assigneeId || user.memberId}
                            onChange={(e) => {
                              const m = members.find((m) => m._id === e.target.value);
                              setForm({ ...form, assigneeId: e.target.value, assigneeName: m?.name ?? "" });
                            }}
                            style={{
                              background: "var(--surface2)", border: "1px solid var(--border2)",
                              borderRadius: 7, padding: "6px 10px", fontSize: 12,
                              color: "var(--text)", outline: "none", width: "100%",
                              boxSizing: "border-box", cursor: "pointer",
                            }}
                          >
                            {members.map((m) => (
                              <option key={m._id} value={m._id}>
                                {m._id === user.memberId ? `${m.name} (me)` : m.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleAdd(col.id)}
                            style={{
                              flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                              background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                            }}
                          >
                            {t.projectPage.addTask}
                          </button>
                          <button
                            onClick={() => { setAddingCol(null); setFormError(null); }}
                            style={{
                              padding: "7px 10px", borderRadius: 7, background: "var(--surface2)",
                              border: "1px solid var(--border2)", cursor: "pointer", color: "var(--text-muted)",
                            }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    )}

                    {colItems.map((task) => (
                      <TaskCard
                        key={task._id}
                        task={toTeamTask(task)}
                        isAdmin={canApproveTask}
                        isOwn={task.memberId === user.memberId}
                        currentUser={user}
                        onSubmit={(id) => submitTask({ taskId: id as Id<"tasks"> })}
                        onApprove={(id) => approveTask({ taskId: id as Id<"tasks"> })}
                        onReject={(id, reason) => rejectTask({ taskId: id as Id<"tasks">, reason })}
                        onDelete={(id) => deleteTask({ taskId: id as Id<"tasks"> })}
                        onStatusChange={(id, status) => moveTask({ taskId: id as Id<"tasks">, status })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showMembers && (
        <MembersPanel projectId={projectId} onClose={() => setShowMembers(false)} />
      )}
    </div>
  );
}
