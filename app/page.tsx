"use client";

import { useState, useEffect } from "react";
import { Plus, X, Bookmark, Trash2, LayoutGrid, List, Users, Search, RotateCcw, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import TaskCard from "@/components/tasks/TaskCard";
import WorkloadView from "@/components/WorkloadView";
import ProjectListView from "@/components/tasks/ProjectListView";
import BottleneckPrompt from "@/components/tasks/BottleneckPrompt";
import { TeamTask } from "@/lib/task-types";

const getColumns = (t: any) => [
  { id: "draft",       label: t.status.todo,       dot: "bg-zinc-500"   },
  { id: "in_progress", label: t.status.in_progress, dot: "bg-blue-500"   },
  { id: "submitted",   label: t.status.submitted,   dot: "bg-yellow-500" },
  { id: "completed",   label: t.status.completed,   dot: "bg-green-500"  },
];

const getPriorityOptions = (t: any) => [
  { value: "high",   label: t.priority.high,   color: "var(--status-danger)" },
  { value: "medium", label: t.priority.medium, color: "var(--status-warning)" },
  { value: "low",    label: t.priority.low,    color: "var(--status-success)" },
];

const EMPTY_FORM = { title: "", desc: "", tag: "", priority: "medium", submissionDate: "", visibility: "public", assigneeId: "", assigneeName: "" };

export default function Dashboard() {
  const { user, isAdmin, isLoading, orgId } = useAuth();
  const { t } = useLocale();

  const allTasks = useQuery(
    api.tasks.listAllTasksForViewer,
    orgId && user ? { orgId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];
  const createTask     = useMutation(api.tasks.createTask);
  const deleteTask     = useMutation(api.tasks.deleteTask);
  const moveTask       = useMutation(api.tasks.updateTaskStatus);
  const submitTask     = useMutation(api.tasks.submitTask);
  const approveTask    = useMutation(api.tasks.approveTask);
  const rejectTask     = useMutation(api.tasks.rejectTask);
  const saveTemplate   = useMutation(api.templates.saveTemplate);
  const deleteTemplate = useMutation(api.templates.deleteTemplate);

  const templates = useQuery(
    api.templates.listByMember,
    user ? { memberId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];

  const members = useQuery(
    api.members.listMembers,
    orgId ? { orgId } : "skip"
  ) ?? [];

  const projects = useQuery(
    api.projects.listForViewer,
    orgId && user ? { orgId, viewerId: user.memberId as Id<"members"> } : "skip"
  ) ?? [];

  const spaces = useQuery(api.spaces.list, orgId ? { orgId } : "skip") ?? [];

  const [view,       setView]       = useState<"kanban" | "list" | "workload">("kanban");
  const [filter,     setFilter]     = useState<"all" | "mine">("all");
  const [search,     setSearch]     = useState("");
  const [addingCol,  setAddingCol]  = useState<string | null>(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [dragOver,   setDragOver]   = useState<string | null>(null);
  const [prevSeen,   setPrevSeen]   = useState<number | null>(null);
  const [resumeOpen, setResumeOpen] = useState(true);

  // Bottleneck prompt: shows after task creation
  const [bottleneckTask, setBottleneckTask] = useState<{ id: string; col: string } | null>(null);

  // Track last-seen per user so we can detect "away" on return
  useEffect(() => {
    if (!user?.memberId) return;
    const key    = `mc-team-last-seen-${user.memberId}`;
    const stored = localStorage.getItem(key);
    if (stored) setPrevSeen(parseInt(stored, 10));
    localStorage.setItem(key, Date.now().toString());
  }, [user?.memberId]);

  const activities = useQuery(
    api.tasks.getActivities,
    orgId ? { orgId } : "skip"
  ) ?? [];

  if (isLoading || !user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div role="status" aria-label="Loading" style={{ width: 32, height: 32, border: "3px solid #3a3a3a", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Filter tasks
  const visible = allTasks.filter((t) => {
    if (filter === "mine" && t.memberId !== user.memberId) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const colTasks = (colId: string) =>
    visible.filter((t) => t.status === colId);

  // Stats
  const total       = allTasks.length;
  const submitted   = allTasks.filter((t) => t.status === "submitted").length;
  const completed   = allTasks.filter((t) => t.status === "completed").length;
  const myTasks     = allTasks.filter((t) => t.memberId === user.memberId).length;
  const completion  = total > 0 ? Math.round((completed / total) * 100) : 0;

  // ── Resume section data ────────────────────────────────────────────────────
  const awayMs    = prevSeen ? Date.now() - prevSeen : 0;
  const awayHours = awayMs / 3_600_000;
  const awayLabel = awayHours < 1  ? null
                  : awayHours < 24 ? `${Math.round(awayHours)}h`
                  : awayHours < 48 ? "yesterday"
                  : `${Math.floor(awayHours / 24)} days`;

  // Tasks I'm working on right now — in_progress first, then draft, newest first
  const myOpenTasks = allTasks
    .filter((t) => t.memberId === user.memberId && (t.status === "in_progress" || t.status === "draft"))
    .sort((a, b) => {
      if (a.status === "in_progress" && b.status !== "in_progress") return -1;
      if (b.status === "in_progress" && a.status !== "in_progress") return 1;
      return b.updatedAt - a.updatedAt;
    })
    .slice(0, 5);

  // Approvals / rejections on my tasks since I was last here
  const myTaskIds = new Set(allTasks.filter((t) => t.memberId === user.memberId).map((t) => t._id));
  const awayActivities = awayHours >= 1 && prevSeen != null
    ? activities.filter((a) =>
        a.taskId !== undefined &&
        myTaskIds.has(a.taskId as Id<"tasks">) &&
        (a.type === "task_approved" || a.type === "task_rejected") &&
        a.createdAt > prevSeen!
      ).slice(0, 4)
    : [];

  // My non-completed tasks with a due date, soonest first
  const dueSoonTasks = allTasks
    .filter((t) => t.memberId === user.memberId && t.status !== "completed" && t.dueDate)
    .sort((a, b) => (a.dueDate ?? 0) - (b.dueDate ?? 0))
    .slice(0, 3);


  const handleAdd = async (colId: string) => {
    if (!form.title.trim() || !orgId) return;
    if (!form.submissionDate) return; // Due date is mandatory
    const assigneeId   = (isAdmin && form.assigneeId)   ? form.assigneeId   : user.memberId;
    const assigneeName = (isAdmin && form.assigneeName) ? form.assigneeName : user.name;
    const taskId = await createTask({
      orgId,
      title:          form.title.trim(),
      description:    form.desc.trim(),
      memberId:       assigneeId as Id<"members">,
      memberName:     assigneeName,
      priority:       form.priority,
      tag:            form.tag.trim() || undefined,
      submissionDate: new Date(form.submissionDate).getTime(),
      visibility:     form.visibility,
    });
    setForm(EMPTY_FORM);
    setAddingCol(null);
    // Show bottleneck prompt for the newly created task
    setBottleneckTask({ id: taskId, col: colId });
  };

  const handleSaveTemplate = async () => {
    if (!form.title.trim() || !orgId) return;
    await saveTemplate({
      orgId,
      memberId:    user.memberId as Id<"members">,
      memberName:  user.name,
      title:       form.title.trim(),
      description: form.desc.trim(),
      priority:    form.priority || undefined,
      tag:         form.tag.trim() || undefined,
    });
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
    const task = allTasks.find((t) => t._id === taskId);
    if (!task || task.status === colId) return;
    // Only the task owner can move their own tasks
    if (task.memberId !== user.memberId) return;
    if (["draft", "in_progress"].includes(colId)) {
      await moveTask({ taskId: task._id, status: colId });
    }
  };

  const toTeamTask = (t: any): TeamTask => ({
    id:              t._id,
    title:           t.title,
    description:     t.description,
    status:          t.status,
    memberId:        t.memberId,
    memberName:      t.memberName,
    priority:        t.priority ?? "medium",
    tag:             t.tag,
    dueDate:         t.dueDate        ? new Date(t.dueDate)        : undefined,
    projectId:       t.projectId,
    submissionDate:  t.submissionDate ? new Date(t.submissionDate) : undefined,
    submittedAt:     t.submittedAt    ? new Date(t.submittedAt)    : undefined,
    approvedAt:      t.approvedAt     ? new Date(t.approvedAt)     : undefined,
    rejectedAt:      t.rejectedAt     ? new Date(t.rejectedAt)     : undefined,
    rejectionReason: t.rejectionReason,
    createdAt:       new Date(t.createdAt),
    updatedAt:       new Date(t.updatedAt),
    isRecurring:        t.isRecurring,
    recurrenceRule:     t.recurrenceRule,
    recurrenceInterval: t.recurrenceInterval,
    recurrenceDays:     t.recurrenceDays,
    nextRecurrenceAt:   t.nextRecurrenceAt,
    parentRecurringId:  t.parentRecurringId,
  });

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-b flex-shrink-0 topbar"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {[
            { label: t.dashboard.totalTasks,  value: total,       color: "var(--accent)" },
            { label: t.dashboard.submitted,    value: submitted,   color: "var(--status-warning)" },
            { label: t.status.completed,    value: completed,   color: "var(--status-success)" },
            { label: "My tasks",     value: myTasks,     color: "var(--accent)" },
            { label: t.dashboard.completionRate,   value: `${completion}%`, color: "var(--status-success)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span style={{ fontSize: 19, fontWeight: 700, color }}>{value}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
              <span style={{ width: 1, height: 16, background: "var(--border)", marginLeft: 6 }} />
            </div>
          ))}

          {/* Filter */}
          <div className="ml-auto flex items-center gap-1">
            {(["all", "mine"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                cursor: "pointer", textTransform: "capitalize",
                border:     filter === f ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                background: filter === f ? "var(--accent-bg)" : "transparent",
                color:      filter === f ? "var(--accent-light)" : "var(--text-muted)",
              }}>
                {f === "all" ? "All" : "Mine"}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => { setAddingCol("draft"); setForm(EMPTY_FORM); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 8, fontSize: 13,
              fontWeight: 500, cursor: "pointer", border: "none",
              background: "var(--accent)", color: "#fff",
            }}
          >
            <Plus size={14} /> {t.create}
          </button>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={13} style={{
              position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)", pointerEvents: "none",
            }} />
            <input
              type="text"
              placeholder={`${t.search} tasks…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
              style={{
                padding: "5px 10px 5px 28px", width: 200, borderRadius: 8,
                fontSize: 12, background: "var(--surface2)",
                border: "1px solid var(--border2)", color: "var(--text)", outline: "none",
              }}
            />
          </div>

          {/* View toggle */}
          <div className="ml-auto flex items-center" style={{
            background: "var(--surface2)", borderRadius: 8,
            border: "1px solid var(--border2)", padding: 3, gap: 2, display: "flex",
          }}>
            {([
              { id: "kanban",   icon: <LayoutGrid size={13} />, label: "Kanban"   },
              { id: "list",     icon: <List size={13} />,        label: "List"     },
              { id: "workload", icon: <Users size={13} />,       label: "Workload" },
            ]).map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id as "list" | "kanban" | "workload")}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  cursor: "pointer", border: "none", transition: "all 0.15s",
                  background: view === v.id ? "var(--surface)"  : "transparent",
                  color:      view === v.id ? "var(--text)"     : "var(--text-muted)",
                  boxShadow:  view === v.id ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Resume: where you left off ────────────────────────────────── */}
        <div style={{
            flexShrink: 0,
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
          }}>
            {/* Header — click anywhere to collapse */}
            <button
              onClick={() => setResumeOpen(!resumeOpen)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "7px 20px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <RotateCcw size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                {awayLabel ? `Back after ${awayLabel}` : "Resume: Where you left off"}
              </span>
              {awayLabel && prevSeen && (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  · last here {new Date(prevSeen).toLocaleString("en-GB", {
                    weekday: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              )}
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", display: "flex" }}>
                {resumeOpen
                  ? <ChevronDown  size={13} />
                  : <ChevronRight size={13} />}
              </span>
            </button>

            {resumeOpen && (
              <div style={{
                display: "grid",
                gridTemplateColumns: awayActivities.length > 0 ? "1fr 1fr 1fr" : "1fr 1fr",
                padding: "0 20px 12px",
              }}>

                {/* ── Col 1: Pick up here ─────────────────────────────── */}
                <div style={{ paddingRight: 20, borderRight: "1px solid var(--border)" }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    margin: "0 0 8px",
                  }}>
                    Resuming
                  </p>
                  {myOpenTasks.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>All clear</p>
                  ) : myOpenTasks.map((tk) => {
                    const isIP = tk.status === "in_progress";
                    return (
                      <div key={tk._id} style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background:  isIP ? "#2563eb" : "transparent",
                          border:      isIP ? "none"    : "2px dashed #52525b",
                        }} />
                        <span style={{
                          fontSize: 12, color: "var(--text)", flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {tk.title}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, flexShrink: 0,
                          color:      isIP ? "#2563eb"                      : "var(--text-muted)",
                          background: isIP ? "rgba(37,99,235,0.12)"         : "rgba(113,113,122,0.12)",
                          borderRadius: 4, padding: "1px 6px",
                        }}>
                          {isIP ? t.status.in_progress.toUpperCase() : t.status.todo.toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* ── Col 2: While you were away (conditional) ────────── */}
                {awayActivities.length > 0 && (
                  <div style={{
                    paddingLeft: 20, paddingRight: 20,
                    borderRight: "1px solid var(--border)",
                  }}>
                    <p style={{
                      fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                      textTransform: "uppercase", letterSpacing: "0.07em",
                      margin: "0 0 8px",
                    }}>
                      Updates
                    </p>
                    {awayActivities.map((a) => {
                      const approved = a.type === "task_approved";
                      return (
                        <div key={a._id} style={{
                          display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 6,
                        }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: approved ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                            fontSize: 9, fontWeight: 700,
                            color: approved ? "var(--status-success)" : "var(--status-danger)",
                          }}>
                            {approved ? "✓" : "↩"}
                          </div>
                          <span style={{
                            fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4,
                            overflow: "hidden", display: "-webkit-box",
                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                          }}>
                            {a.description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Col 3 (or 2): Due soon ──────────────────────────── */}
                <div style={{ paddingLeft: 20 }}>
                  <p style={{
                    fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.07em",
                    margin: "0 0 8px",
                  }}>
                    {t.taskModal.dueDate}
                  </p>
                  {dueSoonTasks.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>Nothing due</p>
                  ) : dueSoonTasks.map((dt) => {
                    const now       = Date.now();
                    const isOverdue = (dt.dueDate ?? 0) < now;
                    const daysUntil = Math.ceil(((dt.dueDate ?? 0) - now) / 86_400_000);
                    const dueLabel  = isOverdue    ? t.taskCard.overdue
                                    : daysUntil === 0 ? t.taskCard.dueToday
                                    : daysUntil === 1 ? "Tomorrow"
                                    : `${daysUntil}d`;
                    return (
                      <div key={dt._id} style={{
                        display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                      }}>
                        {isOverdue
                          ? <AlertCircle size={10} style={{ color: "var(--status-danger)", flexShrink: 0 }} />
                          : <div style={{
                              width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                              border: "1px solid rgba(255,255,255,0.2)",
                            }} />
                        }
                        <span style={{
                          fontSize: 12, color: "var(--text)", flex: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {dt.title}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, flexShrink: 0,
                          color: isOverdue     ? "var(--status-danger)"
                               : daysUntil <= 1 ? "var(--status-warning)"
                               : "var(--text-muted)",
                        }}>
                          {dueLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        {/* Project list view */}
        {view === "list" && (
          <ProjectListView
            projects={projects}
            tasks={visible.map(toTeamTask)}
            spaces={spaces}
            isAdmin={isAdmin}
            currentUserId={user.memberId}
            onAddTask={(projectId, statusId) => { setAddingCol("draft"); setForm(EMPTY_FORM); setView("kanban"); }}
            onSubmit={(id) => submitTask({ taskId: id as Id<"tasks"> })}
            onApprove={(id) => approveTask({ taskId: id as Id<"tasks"> })}
            onReject={(id, reason) => rejectTask({ taskId: id as Id<"tasks">, reason })}
            onDelete={(id) => deleteTask({ taskId: id as Id<"tasks"> })}
            onTaskClick={() => {}}
            onProjectClick={(projectId) => {
              window.location.href = `/projects/${projectId}`;
            }}
          />
        )}

        {/* Workload view */}
        {view === "workload" && (
          <WorkloadView tasks={visible.map(toTeamTask)} members={members} />
        )}

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ display: view === "kanban" ? "flex" : "none", flexDirection: "column" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1, height: "100%", minWidth: 800,
          }}>
            {getColumns(t).map((col) => {
              const colItems     = colTasks(col.id);
              const isAdding     = addingCol === col.id;
              const isDragTarget = dragOver === col.id;
              const canAddHere   = col.id === "draft";

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  style={{
                    display: "flex", flexDirection: "column", height: "100%",
                    borderRight: "1px solid var(--border)", overflow: "hidden",
                    background: isDragTarget ? "var(--accent-subtle)" : "transparent",
                    outline: isDragTarget ? "2px dashed rgba(99,102,241,0.5)" : "none",
                    outlineOffset: -2,
                    transition: "background 0.15s",
                  }}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                    style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{col.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2 }}>{colItems.length}</span>
                    </div>
                    {canAddHere && (
                      <button
                        onClick={() => { setAddingCol(isAdding ? null : col.id); setForm(EMPTY_FORM); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                      >
                        {isAdding ? <X size={13} /> : <Plus size={13} />}
                      </button>
                    )}
                    {/* Admin: show pending count on Submitted */}
                    {col.id === "submitted" && isAdmin && colItems.length > 0 && (
                      <span style={{
                        fontSize: 9.5, fontWeight: 700,
                        background: "var(--status-warning)", color: "#000",
                        borderRadius: 8, padding: "2px 6px",
                      }}>
                        {t.sidebar.review}
                      </span>
                    )}
                  </div>

                  {/* Column body */}
                  <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>

                    {/* Inline add form */}
                    {isAdding && (
                      <div style={{
                        background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        {/* Template chips */}
                        {templates.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {templates.map((tpl) => (
                              <div key={tpl._id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <button
                                  onClick={() => setForm({
                                    title: tpl.title,
                                    desc:  tpl.description,
                                    tag:   tpl.tag ?? "",
                                    priority: tpl.priority ?? "medium",
                                    submissionDate: "",
                                    visibility: "public",
                                    assigneeId: "",
                                    assigneeName: "",
                                  })}
                                  style={{
                                    padding: "3px 8px", borderRadius: 5, fontSize: 10.5, fontWeight: 500,
                                    background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.25)",
                                    color: "var(--accent-light)", cursor: "pointer",
                                  }}
                                >
                                  {tpl.title}
                                </button>
                                <button
                                  onClick={() => deleteTemplate({ templateId: tpl._id })}
                                  style={{
                                    background: "none", border: "none", cursor: "pointer",
                                    color: "var(--text-dim)", padding: 0, display: "flex",
                                  }}
                                  title="Delete template"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          autoFocus
                          placeholder={t.listView.taskTitlePlaceholder}
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(col.id); if (e.key === "Escape") setAddingCol(null); }}
                          style={{
                            background: "var(--surface3)", border: "1px solid var(--border2)",
                            borderRadius: 6, padding: "6px 10px", fontSize: 12.5,
                            color: "var(--text)", outline: "none", width: "100%",
                          }}
                        />
                        <textarea
                          placeholder={t.listView.descriptionPlaceholder}
                          value={form.desc}
                          onChange={(e) => setForm({ ...form, desc: e.target.value })}
                          rows={2}
                          style={{
                            background: "var(--surface3)", border: "1px solid var(--border2)",
                            borderRadius: 6, padding: "6px 10px", fontSize: 12,
                            color: "var(--text)", outline: "none", width: "100%", resize: "none",
                          }}
                        />
                        <input
                          placeholder={t.listView.tagPlaceholder}
                          value={form.tag}
                          onChange={(e) => setForm({ ...form, tag: e.target.value })}
                          style={{
                            background: "var(--surface3)", border: "1px solid var(--border2)",
                            borderRadius: 6, padding: "6px 10px", fontSize: 12,
                            color: "var(--text)", outline: "none", width: "100%",
                          }}
                        />
                        <input
                          type="date"
                          value={form.submissionDate}
                          onChange={(e) => setForm({ ...form, submissionDate: e.target.value })}
                          placeholder={`${t.taskModal.dueDate} (optional)`}
                          style={{
                            background: "var(--surface3)", border: "1px solid var(--border2)",
                            borderRadius: 6, padding: "6px 10px", fontSize: 12,
                            color: "var(--text)", outline: "none", width: "100%",
                          }}
                        />

                        {/* Priority */}
                        <div style={{ display: "flex", gap: 6 }}>
                          {getPriorityOptions(t).map((p) => {
                            const active = form.priority === p.value;
                            return (
                              <button
                                key={p.value}
                                onClick={() => setForm({ ...form, priority: p.value })}
                                style={{
                                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                                  padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  cursor: "pointer", transition: "all 0.15s",
                                  background: active ? p.color + "22" : "var(--surface3)",
                                  border:     active ? `1px solid ${p.color}66` : "1px solid var(--border2)",
                                  color:      active ? p.color : "var(--text-muted)",
                                }}
                              >
                                <span style={{
                                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                  background: active ? p.color : "var(--text-dim)",
                                  transition: "background 0.15s",
                                }} />
                                {p.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Visibility */}
                        <div style={{ display: "flex", gap: 6 }}>
                          {(["public", "private"] as const).map((v) => (
                            <button
                              key={v}
                              onClick={() => setForm({ ...form, visibility: v })}
                              style={{
                                flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11,
                                fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                                background: form.visibility === v ? (v === "private" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)") : "var(--surface3)",
                                border: form.visibility === v ? `1px solid ${v === "private" ? "rgba(239,68,68,0.4)" : "rgba(34,197,94,0.4)"}` : "1px solid var(--border2)",
                                color: form.visibility === v ? (v === "private" ? "var(--status-danger)" : "var(--status-success)") : "var(--text-muted)",
                              }}
                            >
                              {v === "public" ? `🌐 ${t.workspaceTab.public}` : `🔒 ${t.workspaceTab.private}`}
                            </button>
                          ))}
                        </div>

                        {/* Assign to (admin only) */}
                        {isAdmin && members.length > 0 && (
                          <select
                            value={form.assigneeId || user.memberId}
                            onChange={(e) => {
                              const m = members.find((m) => m._id === e.target.value);
                              setForm({ ...form, assigneeId: e.target.value, assigneeName: m?.name ?? "" });
                            }}
                            style={{
                              background: "var(--surface3)", border: "1px solid var(--border2)",
                              borderRadius: 6, padding: "6px 10px", fontSize: 12,
                              color: "var(--text)", outline: "none", width: "100%", cursor: "pointer",
                            }}
                          >
                            {members.map((m) => (
                              <option key={m._id} value={m._id}>
                                {m._id === user.memberId ? `${m.name} (me)` : m.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                          <button onClick={() => handleAdd(col.id)} style={{
                            padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                            background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                          }}>{t.add}</button>
                          <button
                            onClick={handleSaveTemplate}
                            title="Save as template"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "5px 10px", borderRadius: 6, fontSize: 12,
                              background: "var(--surface3)", color: "var(--text-muted)",
                              border: "1px solid var(--border2)", cursor: "pointer",
                            }}
                          >
                            <Bookmark size={11} /> Save template
                          </button>
                          <button onClick={() => setAddingCol(null)} style={{
                            padding: "5px 10px", borderRadius: 6, fontSize: 12,
                            background: "var(--surface3)", color: "var(--text-muted)",
                            border: "1px solid var(--border2)", cursor: "pointer",
                          }}>{t.cancel}</button>
                        </div>
                      </div>
                    )}

                    {/* Drop indicator */}
                    {isDragTarget && (
                      <div style={{
                        border: "2px dashed rgba(99,102,241,0.6)", borderRadius: 10, height: 52,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        background: "var(--accent-subtle)",
                        animation: "pulse 1s ease infinite",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-light)" }}>Dragging...</span>
                      </div>
                    )}

                    {/* Bottleneck prompt — appears after task creation */}
                    {bottleneckTask && bottleneckTask.col === col.id && (
                      <BottleneckPrompt
                        taskId={bottleneckTask.id}
                        stage={col.id}
                        memberId={user.memberId}
                        onDone={() => setBottleneckTask(null)}
                      />
                    )}

                    {/* Task cards */}
                    {colItems.length === 0 && !isAdding && !isDragTarget && !bottleneckTask ? (
                      <div className="col-empty" style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                        border: "1px dashed var(--border2)", borderRadius: 10, minHeight: 80,
                      }}>
                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{t.noResults}</span>
                      </div>
                    ) : (
                      colItems.map((t) => (
                        <TaskCard
                          key={t._id}
                          task={toTeamTask(t)}
                          isAdmin={isAdmin}
                          isOwn={t.memberId === user.memberId}
                          currentUser={{ memberId: user.memberId, name: user.name }}
                          onDelete={(id) => deleteTask({ taskId: id as Id<"tasks"> })}
                          onStatusChange={(id, status) => moveTask({ taskId: id as Id<"tasks">, status })}
                          onSubmit={(id) => submitTask({ taskId: id as Id<"tasks"> })}
                          onApprove={(id) => approveTask({ taskId: id as Id<"tasks"> })}
                          onReject={(id, reason) => rejectTask({ taskId: id as Id<"tasks">, reason })}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
