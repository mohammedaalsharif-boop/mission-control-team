import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Queries ───────────────────────────────────────────────────────────────────

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return [];
    if (task.orgId) await getCallerMember(ctx, task.orgId);
    return ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .order("asc")
      .collect();
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    taskId:     v.id("tasks"),
    title:      v.string(),
    assigneeId: v.optional(v.id("members")),
    dueDate:    v.optional(v.number()),
    createdBy:  v.id("members"),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    if (!args.title.trim()) throw new Error("Title is required");
    return ctx.db.insert("subtasks", {
      taskId:     args.taskId,
      title:      args.title.trim(),
      status:     "to_do",
      assigneeId: args.assigneeId,
      dueDate:    args.dueDate,
      createdBy:  args.createdBy,
      createdAt:  now(),
      updatedAt:  now(),
    });
  },
});

export const update = mutation({
  args: {
    subtaskId:  v.id("subtasks"),
    title:      v.optional(v.string()),
    status:     v.optional(v.string()),
    assigneeId: v.optional(v.id("members")),
    dueDate:    v.optional(v.number()),
  },
  handler: async (ctx, { subtaskId, ...fields }) => {
    const subtask = await ctx.db.get(subtaskId);
    if (!subtask) throw new Error("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    const patch: Record<string, unknown> = { updatedAt: now() };
    if (fields.title      !== undefined) patch.title      = fields.title.trim();
    if (fields.status     !== undefined) patch.status     = fields.status;
    if (fields.assigneeId !== undefined) patch.assigneeId = fields.assigneeId;
    if (fields.dueDate    !== undefined) patch.dueDate    = fields.dueDate;

    // If marking completed, record timestamp
    if (fields.status === "completed") patch.completedAt = now();
    if (fields.status === "to_do" || fields.status === "in_progress") patch.completedAt = undefined;

    await ctx.db.patch(subtaskId, patch);
  },
});

// Toggle completion — convenience shorthand
export const toggleComplete = mutation({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, { subtaskId }) => {
    const subtask = await ctx.db.get(subtaskId);
    if (!subtask) throw new Error("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    const completed = subtask.status !== "completed";
    await ctx.db.patch(subtaskId, {
      status:      completed ? "completed" : "to_do",
      completedAt: completed ? now() : undefined,
      updatedAt:   now(),
    });
  },
});

export const remove = mutation({
  args: { subtaskId: v.id("subtasks") },
  handler: async (ctx, { subtaskId }) => {
    const subtask = await ctx.db.get(subtaskId);
    if (!subtask) throw new Error("Subtask not found");
    const task = await ctx.db.get(subtask.taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    await ctx.db.delete(subtaskId);
  },
});
