import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Generate a signed upload URL ────────────────────────────────────────────
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// ── Save an attachment record after upload ──────────────────────────────────
export const saveAttachment = mutation({
  args: {
    taskId:      v.id("tasks"),
    storageId:   v.id("_storage"),
    fileName:    v.string(),
    contentType: v.string(),
    size:        v.number(),
    memberId:    v.id("members"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found.");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    return await ctx.db.insert("taskAttachments", {
      taskId:      args.taskId,
      storageId:   args.storageId,
      fileName:    args.fileName,
      contentType: args.contentType,
      size:        args.size,
      uploadedBy:  args.memberId,
      uploadedAt:  now(),
    });
  },
});

// ── List attachments for a task ─────────────────────────────────────────────
export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return [];
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    const attachments = await ctx.db
      .query("taskAttachments")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("desc")
      .take(100);

    // Resolve download URLs
    const withUrls = await Promise.all(
      attachments.map(async (a) => ({
        ...a,
        url: await ctx.storage.getUrl(a.storageId),
      }))
    );

    return withUrls;
  },
});

// ── List all attachments for every task in a project ──────────────────────────
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    // Gather all tasks belonging to this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(500);

    const allAttachments: Array<{
      _id: any;
      taskId: any;
      storageId: any;
      fileName: string;
      contentType: string;
      size: number;
      uploadedBy: any;
      uploadedAt: number;
      url: string | null;
      taskTitle: string;
    }> = [];

    for (const task of tasks) {
      const attachments = await ctx.db
        .query("taskAttachments")
        .withIndex("by_task", (q) => q.eq("taskId", task._id))
        .order("desc")
        .take(20);

      for (const a of attachments) {
        allAttachments.push({
          ...a,
          url: await ctx.storage.getUrl(a.storageId),
          taskTitle: task.title,
        });
      }
    }

    // Sort by upload date descending, limit to 50
    allAttachments.sort((a, b) => b.uploadedAt - a.uploadedAt);
    return allAttachments.slice(0, 50);
  },
});

// ── Delete an attachment (owner, admin, or manager) ─────────────────────────
export const deleteAttachment = mutation({
  args: { attachmentId: v.id("taskAttachments") },
  handler: async (ctx, { attachmentId }) => {
    const attachment = await ctx.db.get(attachmentId);
    if (!attachment) throw new Error("Attachment not found.");

    const task = await ctx.db.get(attachment.taskId);
    if (!task) throw new Error("Task not found.");

    const caller = task.orgId ? await getCallerMember(ctx, task.orgId) : null;
    const isAdminOrManager = caller && (caller.role === "admin" || caller.role === "manager");
    const isUploader = caller && caller._id === attachment.uploadedBy;

    if (!isAdminOrManager && !isUploader) {
      throw new Error("Only the uploader, an admin, or a manager can delete this attachment.");
    }

    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(attachmentId);
  },
});
