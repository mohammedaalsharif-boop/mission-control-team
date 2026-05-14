import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireSameOrg, requirePermission, getCallerMember } from "./helpers";
import { internal } from "./_generated/api";

const now = () => Date.now();

// ── List all spaces in an org (active only by default) ──────────────────────
export const list = query({
  args: {
    orgId:           v.id("organizations"),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, { orgId, includeArchived }) => {
    let isPrivileged = false;
    try {
      const caller = await getCallerMember(ctx, orgId);
      isPrivileged = caller.role === "admin" || caller.role === "manager";
    } catch {
      return [];
    }

    const result = [];
    for await (const s of ctx.db
      .query("spaces")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))) {
      if (!includeArchived && s.archivedAt) continue;
      if (!isPrivileged && s.isPrivate) continue;
      result.push(s);
      if (result.length >= 200) break;
    }
    return result;
  },
});

// ── Get single space ──────────────────────────────────────────────────────────
export const getById = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, { spaceId }) => {
    const space = await ctx.db.get(spaceId);
    return requireSameOrg(ctx, space, "Space");
  },
});

// ── Create space ──────────────────────────────────────────────────────────────
export const create = mutation({
  args: {
    orgId:       v.id("organizations"),
    name:        v.string(),
    description: v.optional(v.string()),
    color:       v.optional(v.string()),
    icon:        v.optional(v.string()),
    isPrivate:   v.optional(v.boolean()),
    permission:  v.optional(v.string()),
    createdBy:   v.id("members"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.orgId, "space.create");
    const spaceId = await ctx.db.insert("spaces", {
      orgId:       args.orgId,
      name:        args.name.trim(),
      description: args.description,
      color:       args.color ?? "#6366f1",
      icon:        args.icon,
      isPrivate:   args.isPrivate ?? false,
      permission:  args.permission ?? "full_edit",
      createdBy:   args.createdBy,
      createdAt:   now(),
    });
    await ctx.db.insert("activities", {
      orgId:       args.orgId,
      type:        "space_created",
      memberId:    args.createdBy,
      description: `Created space: ${args.name.trim()}`,
      createdAt:   now(),
    });
    return spaceId;
  },
});

// ── Update space ──────────────────────────────────────────────────────────────
export const update = mutation({
  args: {
    orgId:       v.id("organizations"),
    spaceId:     v.id("spaces"),
    name:        v.optional(v.string()),
    description: v.optional(v.string()),
    color:       v.optional(v.string()),
    icon:        v.optional(v.string()),
  },
  handler: async (ctx, { orgId, spaceId, ...fields }) => {
    await requirePermission(ctx, orgId, "space.edit");
    const patch: Record<string, unknown> = {};
    if (fields.name        !== undefined) patch.name        = fields.name.trim();
    if (fields.description !== undefined) patch.description = fields.description;
    if (fields.color       !== undefined) patch.color       = fields.color;
    if (fields.icon        !== undefined) patch.icon        = fields.icon;
    await ctx.db.patch(spaceId, patch);
  },
});

// ── Archive / restore space ───────────────────────────────────────────────────
export const archive = mutation({
  args: {
    orgId:   v.id("organizations"),
    spaceId: v.id("spaces"),
    archive: v.boolean(),
  },
  handler: async (ctx, { orgId, spaceId, archive }) => {
    await requirePermission(ctx, orgId, "space.archive");
    await ctx.db.patch(spaceId, { archivedAt: archive ? now() : undefined });
  },
});

// ── Permanently delete a space + all child data ──────────────────────────────
// Kicks off cascading deletion; self-schedules if there's more to clean up.
export const deleteSpace = mutation({
  args: {
    orgId:   v.id("organizations"),
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, { orgId, spaceId }) => {
    await requirePermission(ctx, orgId, "space.delete");

    // Start cascade: schedule the internal batch-delete worker
    await ctx.scheduler.runAfter(0, internal.spaces.deleteSpaceBatch, {
      orgId,
      spaceId,
    });
  },
});

// ── Internal: batch-delete children, then the space itself ──────────────────
import { internalMutation } from "./_generated/server";

export const deleteSpaceBatch = internalMutation({
  args: {
    orgId:   v.id("organizations"),
    spaceId: v.id("spaces"),
  },
  handler: async (ctx, { orgId, spaceId }) => {
    const BATCH = 200;

    // 1. Find projects belonging to this space
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
      .take(BATCH);

    for (const project of projects) {
      // For each project, delete child data in batches
      // ── tasks under this project ──
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .take(BATCH);

      for (const task of tasks) {
        // Subtasks
        const subtasks = await ctx.db
          .query("subtasks")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .take(BATCH);
        for (const st of subtasks) await ctx.db.delete(st._id);

        // Comments
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .take(BATCH);
        for (const c of comments) await ctx.db.delete(c._id);

        // Task access
        const access = await ctx.db
          .query("taskAccess")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .take(BATCH);
        for (const a of access) await ctx.db.delete(a._id);

        // Custom field values
        const cfv = await ctx.db
          .query("customFieldValues")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .take(BATCH);
        for (const c of cfv) await ctx.db.delete(c._id);

        // Bottlenecks
        const bottlenecks = await ctx.db
          .query("bottlenecks")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .take(BATCH);
        for (const b of bottlenecks) await ctx.db.delete(b._id);

        // Task dependencies (both sides)
        const blockers = await ctx.db
          .query("taskDependencies")
          .withIndex("by_blocker", (q) => q.eq("blockerTaskId", task._id))
          .take(BATCH);
        for (const d of blockers) await ctx.db.delete(d._id);

        const dependents = await ctx.db
          .query("taskDependencies")
          .withIndex("by_dependent", (q) => q.eq("dependentTaskId", task._id))
          .take(BATCH);
        for (const d of dependents) await ctx.db.delete(d._id);

        // Delete the task itself
        await ctx.db.delete(task._id);
      }

      // If there were BATCH tasks, there may be more — re-schedule
      if (tasks.length === BATCH) {
        await ctx.scheduler.runAfter(0, internal.spaces.deleteSpaceBatch, {
          orgId,
          spaceId,
        });
        return; // Exit early; next batch will continue
      }

      // ── Project members ──
      const pm = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .take(BATCH);
      for (const p of pm) await ctx.db.delete(p._id);

      // ── Goal-project links ──
      const gp = await ctx.db
        .query("goalProjects")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .take(BATCH);
      for (const g of gp) await ctx.db.delete(g._id);

      // Delete the project itself
      await ctx.db.delete(project._id);
    }

    // If we had a full batch of projects, re-schedule to continue
    if (projects.length === BATCH) {
      await ctx.scheduler.runAfter(0, internal.spaces.deleteSpaceBatch, {
        orgId,
        spaceId,
      });
      return;
    }

    // All children are gone — delete the space itself
    const space = await ctx.db.get(spaceId);
    if (space) {
      await ctx.db.delete(spaceId);
    }
  },
});
