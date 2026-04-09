"use client";

import { useState, useRef, useCallback } from "react";
import {
  X, Calendar, Tag, User, Clock, ArrowRight,
  Trash2, AlertTriangle, Send, CheckCircle, XCircle,
  MessageSquare, Edit2, UserPlus, AtSign, Link as LinkIcon, Check,
  ListChecks, Plus, Trash, Circle, CheckCircle2,
  Paperclip, FileText, Image as ImageIcon, File, Download, Loader2,
} from "lucide-react";
import { BottleneckSection } from "./BottleneckPrompt";
import DependencySection from "./DependencySection";
import CustomFieldsSection from "./CustomFieldsSection";
import RecurrenceSection from "./RecurrenceSection";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { TeamTask, TaskPriority } from "@/lib/task-types";
import { useAuth } from "@/components/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";

const TIME_FULL = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

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

interface Props {
  task:            TeamTask;
  isAdmin:         boolean;
  isOwn:           boolean;
  currentUser:     { memberId: string; name: string };
  onClose:         () => void;
  onDelete?:       (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onSubmit?:       (id: string) => void;
  onApprove?:      (id: string) => void;
  onReject?:       (id: string, reason?: string) => void;
}

const TIME_SHORT = (ts: number, t: any) => {
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return t.notificationsPage.justNow;
  if (mins < 60)  return `${mins}${t.notificationsPage.mAgo}`;
  if (hours < 24) return `${hours}${t.notificationsPage.hAgo}`;
  return `${days}${t.notificationsPage.dAgo}`;
};

export default function TaskModal({
  task, isAdmin, isOwn, currentUser, onClose,
  onDelete, onStatusChange, onSubmit, onApprove, onReject,
}: Props) {
  const { t } = useLocale();

  const PRIORITY_COLOR: Record<string, { bg: string; text: string; border: string; label: string }> = {
    high:   { bg: "rgba(239,68,68,0.12)",  text: "var(--status-danger)", border: "rgba(239,68,68,0.25)",  label: t.priority.high   },
    medium: { bg: "rgba(245,158,11,0.12)", text: "var(--status-warning)", border: "rgba(245,158,11,0.25)", label: t.priority.medium },
    low:    { bg: "rgba(34,197,94,0.12)",  text: "var(--status-success)", border: "rgba(34,197,94,0.25)",  label: t.priority.low    },
  };

  // Status options members can move between
  const MEMBER_STATUS_OPTIONS = [
    { id: "draft",       label: t.status.draft       },
    { id: "in_progress", label: t.status.in_progress },
  ];

  const [confirming,     setConfirming]     = useState(false);
  const [rejectOpen,     setRejectOpen]     = useState(false);
  const [rejectReason,   setRejectReason]   = useState("");
  const [selectedStatus, setSelectedStatus] = useState(task.status);
  const [commentBody,    setCommentBody]    = useState("");
  const [mentionedIds,   setMentionedIds]   = useState<Id<"members">[]>([]);
  const [mentionQuery,   setMentionQuery]   = useState<string | null>(null);
  const [inviteOpen,     setInviteOpen]     = useState(false);
  const [linkCopied,     setLinkCopied]     = useState(false);
  const commentRef = useRef<HTMLInputElement>(null);

  const copyTaskLink = useCallback(() => {
    const url = `${window.location.origin}/tasks/${task.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [task.id]);

  const [editing,  setEditing]  = useState(false);
  const initialSubmissionDate = task.submissionDate
    ? new Date(task.submissionDate).toISOString().split("T")[0]
    : "";
  const [editForm, setEditForm] = useState({
    title:          task.title,
    desc:           task.description ?? "",
    tag:            task.tag ?? "",
    priority:       task.priority ?? "medium",
    submissionDate: initialSubmissionDate,
  });

  const { orgId } = useAuth();
  const comments      = useQuery(api.comments.listByTask, { taskId: task.id as Id<"tasks"> }) ?? [];
  const subtasks      = useQuery(api.subtasks.listByTask, { taskId: task.id as Id<"tasks"> }) ?? [];
  const bottlenecks   = useQuery(api.bottlenecks.listByTask, { taskId: task.id as Id<"tasks"> }) ?? [];
  const attachments   = useQuery(api.taskAttachments.listByTask, { taskId: task.id as Id<"tasks"> }) ?? [];
  const generateUploadUrl = useMutation(api.taskAttachments.generateUploadUrl);
  const saveAttachment    = useMutation(api.taskAttachments.saveAttachment);
  const deleteAttachment  = useMutation(api.taskAttachments.deleteAttachment);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const members       = useQuery(api.members.listMembers, orgId ? { orgId } : "skip") ?? [];
  const addComment    = useMutation(api.comments.addComment);
  const inviteToTask  = useMutation(api.comments.inviteToTask);
  const updateTask    = useMutation(api.tasks.updateTask);
  const createSubtask = useMutation(api.subtasks.create);
  const toggleSubtask = useMutation(api.subtasks.toggleComplete);
  const removeSubtask = useMutation(api.subtasks.remove);

  const [newSubtask,   setNewSubtask]   = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    await createSubtask({
      taskId:    task.id as Id<"tasks">,
      title:     newSubtask.trim(),
      createdBy: currentUser.memberId as Id<"members">,
    });
    setNewSubtask("");
    setTimeout(() => subtaskInputRef.current?.focus(), 0);
  };

  const completedSubtasks = subtasks.filter((s) => s.status === "completed").length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await addComment({
      taskId:       task.id as Id<"tasks">,
      memberId:     currentUser.memberId as Id<"members">,
      memberName:   currentUser.name,
      body:         commentBody.trim(),
      mentionedIds: mentionedIds.length > 0 ? mentionedIds : undefined,
    });
    setCommentBody("");
    setMentionedIds([]);
    setMentionQuery(null);
  };

  // Detect @ in comment input and build mention query
  const handleCommentChange = (val: string) => {
    setCommentBody(val);
    const cursor = commentRef.current?.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@(\w*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  // Insert a mention into the comment text
  const insertMention = (member: { _id: Id<"members">; name: string }) => {
    const cursor = commentRef.current?.selectionStart ?? commentBody.length;
    const before = commentBody.slice(0, cursor);
    const after  = commentBody.slice(cursor);
    const replaced = before.replace(/@(\w*)$/, `@${member.name} `);
    setCommentBody(replaced + after);
    setMentionQuery(null);
    if (!mentionedIds.includes(member._id)) {
      setMentionedIds((ids) => [...ids, member._id]);
    }
    setTimeout(() => commentRef.current?.focus(), 0);
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        await saveAttachment({
          taskId:      task.id as Id<"tasks">,
          storageId,
          fileName:    file.name,
          contentType: file.type,
          size:        file.size,
          memberId:    currentUser.memberId as Id<"members">,
        });
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return <ImageIcon size={13} style={{ color: "#8b5cf6" }} />;
    if (contentType.includes("pdf")) return <FileText size={13} style={{ color: "var(--status-danger)" }} />;
    if (contentType.includes("word") || contentType.includes("document")) return <FileText size={13} style={{ color: "#3b82f6" }} />;
    return <File size={13} style={{ color: "var(--text-dim)" }} />;
  };

  const filteredMentions = mentionQuery !== null
    ? members.filter(
        (m) =>
          m._id !== (currentUser.memberId as Id<"members">) &&
          m.name.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  const handleInvite = async (memberId: Id<"members">) => {
    await inviteToTask({
      taskId:        task.id        as Id<"tasks">,
      invitedById:   currentUser.memberId as Id<"members">,
      invitedByName: currentUser.name,
      memberId,
    });
    setInviteOpen(false);
  };

  const p = PRIORITY_COLOR[task.priority ?? "medium"] ?? PRIORITY_COLOR.medium;

  const canMove   = isOwn && (task.status === "draft" || task.status === "in_progress" || task.status === "rejected");
  const canSubmit = isOwn && (task.status === "draft" || task.status === "in_progress" || task.status === "rejected");
  const canReview = isAdmin && task.status === "submitted";
  const canEdit   = (isOwn || isAdmin) && (task.status === "draft" || task.status === "in_progress");

  const EDIT_PRIORITY_OPTIONS = [
    { value: "high",   label: t.priority.high,   color: "var(--status-danger)" },
    { value: "medium", label: t.priority.medium, color: "var(--status-warning)" },
    { value: "low",    label: t.priority.low,    color: "var(--status-success)" },
  ];

  const handleSave = async () => {
    // Only send submissionDate if the user actually changed it, to avoid
    // the date-string roundtrip producing a different timestamp and
    // triggering the "Due date cannot be changed once set" backend check.
    const dateChanged = editForm.submissionDate !== initialSubmissionDate;
    await updateTask({
      taskId:         task.id as Id<"tasks">,
      title:          editForm.title.trim() || undefined,
      description:    editForm.desc.trim() || undefined,
      tag:            editForm.tag.trim() || undefined,
      priority:       editForm.priority || undefined,
      ...(dateChanged && editForm.submissionDate
        ? { submissionDate: new Date(editForm.submissionDate).getTime() }
        : {}),
    });
    setEditing(false);
  };

  const handleStatusChange = (s: string) => {
    setSelectedStatus(s as any);
    onStatusChange?.(task.id, s);
  };

  return (
    <>
      <div
        onClick={confirming || rejectOpen ? undefined : onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
      >
        {/* Delete confirmation */}
        {confirming && (
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            borderRadius: 16, padding: "28px 28px 24px", width: 340,
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            animation: "popIn 0.15s ease",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
            }}>
              <AlertTriangle size={20} color="var(--status-danger)" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5", marginBottom: 8 }}>{t.taskModal.deleteTask}</p>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.5 }}>
              <span style={{ color: "#a1a1aa", fontWeight: 500 }}>"{task.title}"</span> will be permanently removed.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirming(false)} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: "pointer", background: "#262626", border: "1px solid #333", color: "#a1a1aa",
              }}>{t.cancel}</button>
              <button onClick={() => { onDelete?.(task.id); onClose(); }} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", background: "var(--status-danger)", border: "none", color: "#fff",
              }}>{t.delete}</button>
            </div>
          </div>
        )}

        {/* Reject with reason dialog */}
        {rejectOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            borderRadius: 16, padding: "28px 28px 24px", width: 380,
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            animation: "popIn 0.15s ease",
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5", marginBottom: 6 }}>{t.taskModal.sendBackTitle}</p>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
              Add an optional note for <strong style={{ color: "#a1a1aa" }}>{task.memberName}</strong>.
            </p>
            <textarea
              autoFocus
              placeholder={t.taskModal.feedbackPlaceholder}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              style={{
                width: "100%", background: "#262626", border: "1px solid #333",
                borderRadius: 8, padding: "8px 12px", fontSize: 13,
                color: "#e4e4e7", outline: "none", resize: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setRejectOpen(false)} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
                cursor: "pointer", background: "#262626", border: "1px solid #333", color: "#a1a1aa",
              }}>{t.cancel}</button>
              <button onClick={() => { onReject?.(task.id, rejectReason || undefined); onClose(); }} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: "pointer", background: "var(--status-danger)", border: "none", color: "#fff",
              }}>{t.taskModal.sendBack}</button>
            </div>
          </div>
        )}

        {/* Main modal */}
        {!confirming && !rejectOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid var(--border2)",
            borderRadius: 18, width: "100%", maxWidth: 520,
            boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
            animation: "popIn 0.18s ease", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 20px 0", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1 }}>
                {!editing && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, flexShrink: 0, marginTop: 2,
                    background: p.bg, color: p.text, border: `1px solid ${p.border}`,
                  }}>
                    {p.label}
                  </span>
                )}
                {editing ? (
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    style={{
                      flex: 1, fontSize: 15, fontWeight: 700, color: "var(--text)",
                      background: "var(--surface2)", border: "1px solid var(--accent)",
                      borderRadius: 8, padding: "5px 10px", outline: "none",
                    }}
                  />
                ) : (
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.35, margin: 0 }}>
                    {task.title}
                  </h2>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                {canEdit && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    title={t.taskModal.editTask}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-light)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <Edit2 size={15} />
                  </button>
                )}

                {/* Copy link button */}
                <button
                  onClick={copyTaskLink}
                  title={t.taskModal.copyLink}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                    background: linkCopied ? "rgba(34,197,94,0.10)" : "var(--surface2)",
                    border: `1px solid ${linkCopied ? "rgba(34,197,94,0.25)" : "var(--border2)"}`,
                    color: linkCopied ? "var(--status-success)" : "var(--text-muted)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {linkCopied ? <Check size={11} /> : <LinkIcon size={11} />}
                  {linkCopied ? t.copied : t.link}
                </button>

                {/* Invite button */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setInviteOpen((o) => !o)}
                    title={t.taskModal.inviteTeammate}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                      background: inviteOpen ? "var(--accent-bg)" : "var(--surface2)",
                      border: "1px solid var(--border2)",
                      color: inviteOpen ? "var(--accent-light)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <UserPlus size={12} /> {t.add}
                  </button>
                  {inviteOpen && (
                    <div style={{
                      position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
                      background: "var(--surface)", border: "1px solid var(--border2)",
                      borderRadius: 10, minWidth: 180, overflow: "hidden",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    }}>
                      <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", padding: "8px 12px 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {t.taskModal.notifyTeammate}
                      </p>
                      {members
                        .filter((m) => m._id !== (currentUser.memberId as string))
                        .map((m) => (
                          <button
                            key={m._id}
                            onClick={() => handleInvite(m._id as Id<"members">)}
                            style={{
                              width: "100%", textAlign: "left", padding: "8px 12px",
                              display: "flex", alignItems: "center", gap: 8,
                              background: "none", border: "none", cursor: "pointer",
                              fontSize: 12, color: "var(--text)",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            <div style={{
                              width: 22, height: 22, borderRadius: "50%",
                              background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 9, fontWeight: 700, color: "var(--accent-light)", flexShrink: 0,
                            }}>
                              {m.name[0]?.toUpperCase()}
                            </div>
                            {m.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", maxHeight: "70vh" }}>

              {/* Description + Meta — read or edit mode */}
              {editing ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Description */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t.taskModal.description}</p>
                    <textarea
                      value={editForm.desc}
                      onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })}
                      rows={4}
                      style={{
                        width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 8, padding: "8px 10px", fontSize: 13.5,
                        color: "var(--text)", outline: "none", resize: "vertical",
                        lineHeight: 1.6, boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
                    />
                  </div>

                  {/* Tag */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t.taskModal.tag}</p>
                    <input
                      value={editForm.tag}
                      onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
                      placeholder={t.taskModal.tagPlaceholder}
                      style={{
                        width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 8, padding: "7px 10px", fontSize: 13,
                        color: "var(--text)", outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
                    />
                  </div>

                  {/* Due date */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t.taskModal.dueDate}</p>
                    <input
                      type="date"
                      value={editForm.submissionDate}
                      onChange={(e) => setEditForm({ ...editForm, submissionDate: e.target.value })}
                      style={{
                        width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                        borderRadius: 8, padding: "7px 10px", fontSize: 13,
                        color: "var(--text)", outline: "none", boxSizing: "border-box",
                        colorScheme: "dark",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e)  => (e.currentTarget.style.borderColor = "var(--border2)")}
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{t.taskModal.priority}</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {EDIT_PRIORITY_OPTIONS.map((opt) => (
                        <button key={opt.value} onClick={() => setEditForm({ ...editForm, priority: opt.value as TaskPriority })} style={{
                          flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11,
                          fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                          background: editForm.priority === opt.value ? opt.color + "22" : "var(--surface2)",
                          border:     editForm.priority === opt.value ? `1px solid ${opt.color}66` : "1px solid var(--border2)",
                          color:      editForm.priority === opt.value ? opt.color : "var(--text-muted)",
                        }}>
                          ● {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Save / Cancel */}
                  <div style={{ display: "flex", gap: 8, paddingTop: 2 }}>
                    <button onClick={handleSave} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                    }}>
                      {t.save}
                    </button>
                    <button onClick={() => setEditing(false)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
                      background: "var(--surface2)", color: "var(--text-muted)",
                      border: "1px solid var(--border2)", cursor: "pointer",
                    }}>
                      {t.cancel}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Description */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{t.taskModal.description}</p>
                    <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.6 }}>
                      {task.description || <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>{t.taskModal.noDescription}</span>}
                    </p>
                  </div>

                  {/* Rejection reason */}
                  {task.status === "rejected" && task.rejectionReason && (
                    <div style={{
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 10, padding: "10px 14px",
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--status-danger)", marginBottom: 4 }}>{t.taskModal.revisionFeedback}</p>
                      <p style={{ fontSize: 13, color: "#fca5a5", margin: 0 }}>{task.rejectionReason}</p>
                    </div>
                  )}

                  {/* Meta grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <User size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.taskModal.assignedTo}</span>
                      </div>
                      {isAdmin && task.status !== "submitted" && task.status !== "completed" ? (
                        <select
                          defaultValue={task.memberId}
                          onChange={async (e) => {
                            const selected = members.find((m) => m._id === e.target.value);
                            if (!selected) return;
                            await updateTask({
                              taskId:     task.id as Id<"tasks">,
                              memberId:   selected._id as Id<"members">,
                              memberName: selected.name,
                            });
                          }}
                          style={{
                            width: "100%", fontSize: 13, fontWeight: 600,
                            color: "var(--text)", background: "var(--surface3)",
                            border: "1px solid var(--border2)", borderRadius: 6,
                            padding: "3px 6px", cursor: "pointer", outline: "none",
                          }}
                        >
                          {members.map((m) => (
                            <option key={m._id} value={m._id}>{m.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{task.memberName}</span>
                      )}
                    </div>

                    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Tag size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tag</span>
                      </div>
                      {task.tag
                        ? <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-light)" }}>{task.tag}</span>
                        : <span style={{ fontSize: 13, color: "var(--text-dim)", fontStyle: "italic" }}>{t.none}</span>}
                    </div>

                    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Calendar size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Due</span>
                      </div>
                      {task.submissionDate
                        ? <span style={{ fontSize: 12, color: "var(--text)" }}>{new Date(task.submissionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        : <span style={{ fontSize: 13, color: "var(--text-dim)", fontStyle: "italic" }}>{t.taskModal.noDeadline}</span>}
                    </div>

                    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Clock size={12} color="var(--text-muted)" />
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.taskModal.updated}</span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text)" }}>{TIME_AGO(task.updatedAt, t)}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Move to (members only, own tasks in draft/in_progress/rejected) */}
              {canMove && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <ArrowRight size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.taskModal.moveTo}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {MEMBER_STATUS_OPTIONS.map((s) => {
                      const isActive = selectedStatus === s.id;
                      return (
                        <button key={s.id} onClick={() => handleStatusChange(s.id)} style={{
                          padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                          cursor: "pointer", transition: "all 0.15s",
                          background: isActive ? "var(--accent)"         : "var(--surface2)",
                          color:      isActive ? "#fff"            : "var(--text-muted)",
                          border:     isActive ? "1px solid var(--accent)" : "1px solid var(--border2)",
                        }}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Subtasks checklist ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <ListChecks size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {t.taskModal.subtasks} {subtasks.length > 0 && `(${completedSubtasks}/${subtasks.length})`}
                  </span>
                  {subtasks.length > 0 && (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        flex: 1, height: 3, borderRadius: 2, background: "var(--surface3)",
                        overflow: "hidden", maxWidth: 100,
                      }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          background: subtaskProgress === 100 ? "var(--status-success)" : "var(--accent)",
                          width: `${subtaskProgress}%`,
                          transition: "width 0.3s ease, background 0.3s",
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500 }}>{subtaskProgress}%</span>
                    </div>
                  )}
                </div>

                {/* Subtask list */}
                {subtasks.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
                    {subtasks.map((st) => {
                      const done = st.status === "completed";
                      return (
                        <div
                          key={st._id}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "6px 8px", borderRadius: 7,
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <button
                            onClick={() => toggleSubtask({ subtaskId: st._id })}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              padding: 0, display: "flex", flexShrink: 0,
                              color: done ? "var(--status-success)" : "var(--text-dim)",
                              transition: "color 0.15s",
                            }}
                            title={done ? t.taskModal.markIncomplete : t.taskModal.markComplete}
                          >
                            {done
                              ? <CheckCircle2 size={16} strokeWidth={2} />
                              : <Circle size={16} strokeWidth={1.5} />}
                          </button>
                          <span style={{
                            flex: 1, fontSize: 13, lineHeight: 1.4,
                            color: done ? "var(--text-dim)" : "var(--text)",
                            textDecoration: done ? "line-through" : "none",
                            transition: "color 0.15s",
                          }}>
                            {st.title}
                          </span>
                          {(isAdmin || isOwn) && (
                            <button
                              onClick={() => removeSubtask({ subtaskId: st._id })}
                              title={t.taskModal.removeSubtask}
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: "var(--text-dim)", padding: 2, display: "flex",
                                opacity: 0, transition: "opacity 0.1s, color 0.1s",
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--status-danger)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.color = "var(--text-dim)"; }}
                              ref={(el) => {
                                // Show delete on parent hover
                                const parent = el?.parentElement;
                                if (!parent || !el) return;
                                parent.addEventListener("mouseenter", () => { el.style.opacity = "1"; });
                                parent.addEventListener("mouseleave", () => { el.style.opacity = "0"; });
                              }}
                            >
                              <Trash size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add subtask */}
                {(isAdmin || isOwn) && (
                  addingSubtask ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        ref={subtaskInputRef}
                        autoFocus
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddSubtask();
                          if (e.key === "Escape") { setAddingSubtask(false); setNewSubtask(""); }
                        }}
                        placeholder={t.taskModal.subtaskPlaceholder}
                        style={{
                          flex: 1, background: "var(--surface2)",
                          border: "1px solid var(--border2)", borderRadius: 7,
                          padding: "6px 10px", fontSize: 12.5, color: "var(--text)",
                          outline: "none", fontFamily: "inherit",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
                      />
                      <button
                        onClick={handleAddSubtask}
                        disabled={!newSubtask.trim()}
                        style={{
                          padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                          background: newSubtask.trim() ? "var(--accent)" : "var(--surface3)",
                          color: newSubtask.trim() ? "#fff" : "var(--text-dim)",
                          border: "none", cursor: newSubtask.trim() ? "pointer" : "not-allowed",
                          fontFamily: "inherit",
                        }}
                      >
                        {t.add}
                      </button>
                      <button
                        onClick={() => { setAddingSubtask(false); setNewSubtask(""); }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-dim)", display: "flex", padding: 2,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSubtask(true)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: "none", border: "1px dashed var(--border2)",
                        borderRadius: 7, padding: "6px 10px", cursor: "pointer",
                        color: "var(--text-dim)", fontSize: 12, fontWeight: 500,
                        fontFamily: "inherit", width: "100%",
                        transition: "border-color 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text-dim)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text-dim)"; }}
                    >
                      <Plus size={12} /> {t.taskModal.addSubtask}
                    </button>
                  )
                )}
              </div>

              {/* ── Custom Fields ── */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <CustomFieldsSection taskId={task.id} orgId={orgId ?? null} />
              </div>

              {/* ── Dependencies ── */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <DependencySection
                  taskId={task.id}
                  orgId={orgId ?? null}
                  memberId={currentUser.memberId}
                  projectId={task.projectId}
                />
              </div>

              {/* ── Recurrence ── */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <RecurrenceSection
                  taskId={task.id}
                  isRecurring={task.isRecurring}
                  recurrenceRule={task.recurrenceRule}
                  recurrenceInterval={task.recurrenceInterval}
                  nextRecurrenceAt={task.nextRecurrenceAt}
                />
              </div>

              {/* ── Bottlenecks ── */}
              <div style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 14,
              }}>
                <BottleneckSection
                  taskId={task.id}
                  memberId={currentUser.memberId}
                  stage={task.status}
                  bottlenecks={bottlenecks.map((b) => ({
                    _id:        b._id,
                    body:       b.body,
                    stage:      b.stage,
                    category:   b.category,
                    resolvedAt: b.resolvedAt,
                    createdAt:  b.createdAt,
                  }))}
                />
              </div>

              {/* Attachments */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Paperclip size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {t.taskModal.attachments} {attachments.length > 0 && `(${attachments.length})`}
                  </span>
                </div>

                {/* Attachment list */}
                {attachments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                    {attachments.map((a) => (
                      <div
                        key={a._id}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px", borderRadius: 8,
                          background: "var(--surface2)", border: "1px solid var(--border)",
                        }}
                      >
                        {getFileIcon(a.contentType)}
                        <span style={{
                          flex: 1, fontSize: 12, color: "var(--text)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {a.fileName}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>
                          {formatFileSize(a.size)}
                        </span>
                        {a.url && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "flex", color: "var(--accent-light)", padding: 2 }}
                            title={t.taskModal.download}
                          >
                            <Download size={13} />
                          </a>
                        )}
                        {(isAdmin || currentUser.memberId === a.uploadedBy) && (
                          <button
                            onClick={() => deleteAttachment({ attachmentId: a._id })}
                            style={{
                              display: "flex", background: "none", border: "none",
                              cursor: "pointer", color: "var(--text-dim)", padding: 2,
                            }}
                            title={t.taskModal.removeAttachment}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button — available before submission */}
                {(task.status === "draft" || task.status === "in_progress") && (isOwn || isAdmin) && (
                  <label style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: "var(--surface2)", border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    cursor: uploading ? "wait" : "pointer",
                    opacity: uploading ? 0.6 : 1,
                    transition: "border-color 0.15s, color 0.15s",
                  }}>
                    {uploading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Paperclip size={12} />}
                    {uploading ? t.taskModal.uploading : t.taskModal.addAttachment}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.pptx,.txt,.csv"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>

              {/* Comments thread */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <MessageSquare size={12} color="var(--text-muted)" />
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {t.taskModal.comments} {comments.length > 0 && `(${comments.length})`}
                  </span>
                </div>

                {/* Existing comments */}
                {comments.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                    {comments.map((c) => (
                      <div key={c._id} style={{ display: "flex", gap: 8 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                          background: c.memberId === currentUser.memberId ? "var(--accent-bg)" : "var(--surface3)",
                          border: c.memberId === currentUser.memberId ? "1px solid rgba(99,102,241,0.3)" : "1px solid var(--border2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700,
                          color: c.memberId === currentUser.memberId ? "var(--accent-light)" : "var(--text-muted)",
                        }}>
                          {c.memberName[0]?.toUpperCase()}
                        </div>
                        <div style={{
                          flex: 1,
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          borderRadius: 8, padding: "7px 10px",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{c.memberName}</span>
                            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{TIME_SHORT(c.createdAt, t)}</span>
                          </div>
                          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>{c.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add comment */}
                <div style={{ position: "relative" }}>
                  {/* @ mention dropdown */}
                  {mentionQuery !== null && filteredMentions.length > 0 && (
                    <div style={{
                      position: "absolute", bottom: "calc(100% + 6px)", left: 0, zIndex: 200,
                      background: "var(--surface)", border: "1px solid var(--border2)",
                      borderRadius: 10, overflow: "hidden", minWidth: 180,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                    }}>
                      <div style={{ padding: "6px 10px 4px", display: "flex", alignItems: "center", gap: 5 }}>
                        <AtSign size={10} style={{ color: "var(--accent-light)" }} />
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{t.taskModal.mention}</span>
                      </div>
                      {filteredMentions.map((m) => (
                        <button
                          key={m._id}
                          onMouseDown={(e) => { e.preventDefault(); insertMention({ _id: m._id as Id<"members">, name: m.name }); }}
                          style={{
                            width: "100%", textAlign: "left", padding: "7px 10px",
                            display: "flex", alignItems: "center", gap: 8,
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 12, color: "var(--text)",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                        >
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: "var(--accent-bg)", border: "1px solid rgba(99,102,241,0.3)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 8, fontWeight: 700, color: "var(--accent-light)",
                          }}>
                            {m.name[0]?.toUpperCase()}
                          </div>
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleComment} style={{ display: "flex", gap: 8 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        ref={commentRef}
                        placeholder={t.taskModal.commentPlaceholder}
                        value={commentBody}
                        onChange={(e) => handleCommentChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setMentionQuery(null);
                        }}
                        style={{
                          width: "100%", background: "var(--surface2)", border: "1px solid var(--border2)",
                          borderRadius: 8, padding: "7px 10px", fontSize: 12.5,
                          color: "var(--text)", outline: "none", boxSizing: "border-box",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border2)")}
                      />
                    </div>
                    <button type="submit" disabled={!commentBody.trim()} style={{
                      padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: commentBody.trim() ? "var(--accent)" : "var(--surface3)",
                      color: commentBody.trim() ? "#fff" : "var(--text-dim)",
                      border: "none", cursor: commentBody.trim() ? "pointer" : "default",
                      display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                    }}>
                      <Send size={12} /> {t.send}
                    </button>
                  </form>
                </div>
              </div>

              {/* Footer actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Delete (admin/manager only) */}
                  {isAdmin && onDelete && (
                    <button onClick={() => setConfirming(true)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "none", border: "1px solid var(--border2)",
                      borderRadius: 8, padding: "7px 12px", fontSize: 12,
                      color: "var(--text-muted)", cursor: "pointer",
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)"; e.currentTarget.style.color = "var(--status-danger)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                      <Trash2 size={13} /> {t.delete}
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {/* Submit for approval */}
                  {canSubmit && onSubmit && (
                    <button onClick={() => { onSubmit(task.id); onClose(); }} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
                    }}>
                      <Send size={13} /> {t.send}
                    </button>
                  )}

                  {/* Admin — approve */}
                  {canReview && onApprove && (
                    <button onClick={() => { onApprove(task.id); onClose(); }} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "var(--status-success)", color: "#fff", border: "none", cursor: "pointer",
                    }}>
                      <CheckCircle size={13} /> {t.status.approved}
                    </button>
                  )}

                  {/* Admin — reject */}
                  {canReview && onReject && (
                    <button onClick={() => setRejectOpen(true)} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: "rgba(239,68,68,0.15)", color: "var(--status-danger)",
                      border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer",
                    }}>
                      <XCircle size={13} /> {t.status.rejected}
                    </button>
                  )}

                  <button onClick={onClose} style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                    background: "var(--surface2)", color: "var(--text-muted)",
                    border: "1px solid var(--border2)", cursor: "pointer",
                  }}>
                    {t.close}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.96) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </>
  );
}
