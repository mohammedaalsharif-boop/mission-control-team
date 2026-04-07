import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember, requireAdminOrManager, requirePermission } from "./helpers";

const now = () => Date.now();

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all goals for an org. */
export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    try { await getCallerMember(ctx, orgId); } catch { return []; }
    return ctx.db
      .query("goals")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(50);
  },
});

/** Get a single goal by ID. */
export const getById = query({
  args: { goalId: v.id("goals") },
  handler: async (ctx, { goalId }) => {
    const goal = await ctx.db.get(goalId);
    if (!goal) return null;
    try { await getCallerMember(ctx, goal.orgId); } catch { return null; }
    return goal;
  },
});

/** Get all projects linked to a goal, with their completion stats. */
export const getGoalProjects = query({
  args: { goalId: v.id("goals") },
  handler: async (ctx, { goalId }) => {
    const links = await ctx.db
      .query("goalProjects")
      .withIndex("by_goal", (q) => q.eq("goalId", goalId))
      .take(50);

    const projects = await Promise.all(
      links.map(async (link) => {
        const project = await ctx.db.get(link.projectId);
        if (!project) return null;

        // Stream and count instead of collecting all tasks into memory
        let total = 0;
        let completed = 0;
        for await (const t of ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))) {
          total++;
          if (t.status === "completed") completed++;
        }

        return {
          link,
          project,
          taskStats: { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 },
        };
      }),
    );
    return projects.filter(Boolean);
  },
});

/** Get the goal linked to a specific project (if any). */
export const getGoalForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const link = await ctx.db
      .query("goalProjects")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .first();
    if (!link) return null;
    return ctx.db.get(link.goalId);
  },
});

/** Compute auto-progress for a goal based on linked projects' task completion. */
export const getProgress = query({
  args: { goalId: v.id("goals") },
  handler: async (ctx, { goalId }) => {
    const links = await ctx.db
      .query("goalProjects")
      .withIndex("by_goal", (q) => q.eq("goalId", goalId))
      .take(50);

    if (links.length === 0) return { totalTasks: 0, completedTasks: 0, pct: 0 };

    let totalTasks    = 0;
    let completedTasks = 0;

    for (const link of links) {
      // Stream and count instead of collecting all tasks into memory
      for await (const t of ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", link.projectId))) {
        totalTasks++;
        if (t.status === "completed") completedTasks++;
      }
    }

    return {
      totalTasks,
      completedTasks,
      pct: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId:       v.id("organizations"),
    title:       v.string(),
    description: v.optional(v.string()),
    targetValue: v.optional(v.number()),
    unit:        v.optional(v.string()),
    dueDate:     v.optional(v.number()),
    color:       v.optional(v.string()),
    ownerId:     v.optional(v.id("members")),
    createdBy:   v.id("members"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.orgId, "goal.create");
    return ctx.db.insert("goals", {
      orgId:        args.orgId,
      title:        args.title.trim(),
      description:  args.description,
      targetValue:  args.targetValue,
      currentValue: 0,
      unit:         args.unit ?? "%",
      status:       "on_track",
      ownerId:      args.ownerId,
      dueDate:      args.dueDate,
      color:        args.color,
      createdBy:    args.createdBy,
      createdAt:    now(),
      updatedAt:    now(),
    });
  },
});

export const update = mutation({
  args: {
    goalId:       v.id("goals"),
    title:        v.optional(v.string()),
    description:  v.optional(v.string()),
    targetValue:  v.optional(v.number()),
    currentValue: v.optional(v.number()),
    unit:         v.optional(v.string()),
    status:       v.optional(v.string()),
    ownerId:      v.optional(v.id("members")),
    dueDate:      v.optional(v.number()),
    color:        v.optional(v.string()),
  },
  handler: async (ctx, { goalId, ...fields }) => {
    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");
    await requirePermission(ctx, goal.orgId, "goal.edit");

    const patch: Record<string, unknown> = { updatedAt: now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = typeof val === "string" ? val.trim() : val;
    }
    await ctx.db.patch(goalId, patch);
  },
});

export const remove = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, { goalId }) => {
    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");
    await requirePermission(ctx, goal.orgId, "goal.delete");

    // Remove all project links
    const links = await ctx.db
      .query("goalProjects")
      .withIndex("by_goal", (q) => q.eq("goalId", goalId))
      .take(200);
    for (const link of links) {
      await ctx.db.delete(link._id);
    }
    await ctx.db.delete(goalId);
  },
});

/** Link a project to a goal. */
export const linkProject = mutation({
  args: {
    goalId:    v.id("goals"),
    projectId: v.id("projects"),
  },
  handler: async (ctx, { goalId, projectId }) => {
    const goal = await ctx.db.get(goalId);
    if (!goal) throw new Error("Goal not found");
    await getCallerMember(ctx, goal.orgId);

    // Prevent duplicates
    const existing = await ctx.db
      .query("goalProjects")
      .withIndex("by_goal", (q) => q.eq("goalId", goalId))
      .take(50);
    if (existing.some((l) => l.projectId === projectId)) {
      throw new Error("Project is already linked to this goal.");
    }

    return ctx.db.insert("goalProjects", {
      goalId,
      projectId,
      addedAt: now(),
    });
  },
});

/** Unlink a project from a goal. */
export const unlinkProject = mutation({
  args: { linkId: v.id("goalProjects") },
  handler: async (ctx, { linkId }) => {
    const link = await ctx.db.get(linkId);
    if (!link) throw new Error("Link not found");
    const goal = await ctx.db.get(link.goalId);
    if (goal) await getCallerMember(ctx, goal.orgId);
    await ctx.db.delete(linkId);
  },
});
