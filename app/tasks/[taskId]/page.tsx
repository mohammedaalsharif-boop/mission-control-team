"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import Sidebar from "@/components/Sidebar";
import TaskModal from "@/components/tasks/TaskModal";
import { TeamTask } from "@/lib/task-types";
import { ArrowLeft, Link as LinkIcon, Check, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";

export default function TaskPermalinkPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const router = useRouter();
  const { user, isAdmin, isManager, orgId } = useAuth();
  const { t, locale } = useLocale();

  const task = useQuery(api.tasks.getById, { taskId: taskId as Id<"tasks"> });
  const project = useQuery(
    api.projects.getById,
    task?.projectId ? { projectId: task.projectId } : "skip"
  );

  const submitTask  = useMutation(api.tasks.submitTask);
  const approveTask = useMutation(api.tasks.approveTask);
  const rejectTask  = useMutation(api.tasks.rejectTask);
  const deleteTask  = useMutation(api.tasks.deleteTask);
  const moveTask    = useMutation(api.tasks.updateTaskStatus);

  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/tasks/${taskId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [taskId]);

  const handleDelete = async (id: string) => {
    await deleteTask({ taskId: id as Id<"tasks"> });
    // Navigate back: if task had a project go there, otherwise dashboard
    if (task?.projectId) {
      router.push(`/projects/${task.projectId}`);
    } else {
      router.push("/");
    }
  };

  // Loading state
  if (task === undefined) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Loader2 size={24} role="status" aria-label={t.taskPage.loadingTask} style={{ color: "var(--text-dim)", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t.taskPage.loadingTask}</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </main>
      </div>
    );
  }

  // Not found
  if (task === null) {
    return (
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 380 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 24 }}>?</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>{t.taskPage.taskNotFound}</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              {t.taskPage.taskNotFoundDesc}
            </p>
            <button
              onClick={() => router.push("/")}
              style={{
                marginTop: 8, padding: "9px 20px", borderRadius: 10,
                background: "var(--text)", color: "var(--bg)", border: "none",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {t.taskPage.backToDashboard}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Map Convex doc to TeamTask
  const teamTask: TeamTask = {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status as TeamTask["status"],
    memberId: task.memberId,
    memberName: task.memberName,
    priority: (task.priority ?? "medium") as TeamTask["priority"],
    tag: task.tag,
    dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    projectId: task.projectId,
    submissionDate: task.submissionDate ? new Date(task.submissionDate) : undefined,
    submittedAt: task.submittedAt ? new Date(task.submittedAt) : undefined,
    approvedAt: task.approvedAt ? new Date(task.approvedAt) : undefined,
    rejectedAt: task.rejectedAt ? new Date(task.rejectedAt) : undefined,
    rejectionReason: task.rejectionReason,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    isRecurring:        task.isRecurring,
    recurrenceRule:     task.recurrenceRule,
    recurrenceInterval: task.recurrenceInterval,
    recurrenceDays:     task.recurrenceDays,
    nextRecurrenceAt:   task.nextRecurrenceAt,
    parentRecurringId:  task.parentRecurringId,
  };

  const isOwn = user?.memberId === task.memberId;

  const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
    draft:       { bg: "rgba(113,113,122,0.10)", text: "var(--text-muted)", label: t.taskPage.draft       },
    in_progress: { bg: "rgba(59,130,246,0.10)",  text: "var(--status-info)", label: t.taskPage.inProgress },
    submitted:   { bg: "rgba(245,158,11,0.10)",  text: "var(--status-warning)", label: t.taskPage.submitted   },
    approved:    { bg: "rgba(34,197,94,0.10)",   text: "var(--status-success)", label: t.taskPage.approved    },
    rejected:    { bg: "rgba(239,68,68,0.10)",   text: "var(--status-danger)", label: t.taskPage.rejected    },
    completed:   { bg: "rgba(34,197,94,0.10)",   text: "var(--status-success)", label: t.taskPage.completed   },
  };

  const status = STATUS_COLOR[task.status] ?? STATUS_COLOR.draft;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
        {/* Top bar with breadcrumb, copy link, and status */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 28px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <button
            onClick={() => {
              if (task.projectId) router.push(`/projects/${task.projectId}`);
              else router.push("/");
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", fontSize: 13, fontFamily: "inherit",
              padding: "4px 8px", borderRadius: 6,
              transition: "color 0.1s, background 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <ArrowLeft size={14} />
            {project ? project.name : "Dashboard"}
          </button>

          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title}
          </span>

          {/* Status badge */}
          <span style={{
            fontSize: 11, fontWeight: 600,
            padding: "3px 10px", borderRadius: 20,
            background: status.bg, color: status.text,
          }}>
            {status.label}
          </span>

          {/* Copy link button */}
          <button
            onClick={copyLink}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8,
              background: copied ? "rgba(34,197,94,0.08)" : "var(--surface2)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
              cursor: "pointer", fontSize: 12, fontWeight: 500,
              color: copied ? "var(--status-success)" : "var(--text-muted)",
              fontFamily: "inherit", transition: "all 0.15s",
            }}
          >
            {copied ? <Check size={13} /> : <LinkIcon size={13} />}
            {copied ? t.copied : t.taskPage.copyLink}
          </button>
        </div>

        {/* Full task detail — reuse TaskModal as an inline panel (no portal/overlay) */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "32px 28px 64px" }}>
          <div style={{ width: "100%", maxWidth: 720 }}>
            <TaskModal
              task={teamTask}
              isAdmin={isAdmin || isManager}
              isOwn={isOwn}
              currentUser={{ memberId: user?.memberId ?? "", name: user?.name ?? "" }}
              onClose={() => {
                if (task.projectId) router.push(`/projects/${task.projectId}`);
                else router.push("/");
              }}
              onSubmit={(id) => submitTask({ taskId: id as Id<"tasks"> })}
              onApprove={(id) => approveTask({ taskId: id as Id<"tasks"> })}
              onReject={(id, reason) => rejectTask({ taskId: id as Id<"tasks">, reason })}
              onDelete={handleDelete}
              onStatusChange={(id, status) => moveTask({ taskId: id as Id<"tasks">, status })}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
