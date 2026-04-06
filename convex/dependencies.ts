import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Queries ───────────────────────────────────────────────────────────────────

/** Get all tasks that block a given task (its prerequisites). */
export const getBlockers = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const deps = await ctx.db
      .query("taskDependencies")
      .withIndex("by_dependent", (q) => q.eq("dependentTaskId", taskId))
      .take(50);
    const blockers = await Promise.all(
      deps.map(async (d) => {
        const task = await ctx.db.get(d.blockerTaskId);
        return task ? { dep: d, task } : null;
      }),
    );
    return blockers.filter(Boolean);
  },
});

/** Get all tasks that a given task is blocking (downstream). */
export const getBlocking = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const deps = await ctx.db
      .query("taskDependencies")
      .withIndex("by_blocker", (q) => q.eq("blockerTaskId", taskId))
      .take(50);
    const blocking = await Promise.all(
      deps.map(async (d) => {
        const task = await ctx.db.get(d.dependentTaskId);
        return task ? { dep: d, task } : null;
      }),
    );
    return blocking.filter(Boolean);
  },
});

/** Check if a task has any unresolved blockers (not completed). */
export const isBlocked = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const deps = await ctx.db
      .query("taskDependencies")
      .withIndex("by_dependent", (q) => q.eq("dependentTaskId", taskId))
      .take(50);
    for (const d of deps) {
      const blocker = await ctx.db.get(d.blockerTaskId);
      if (blocker && blocker.status !== "completed") {
        return { blocked: true, blockerTitle: blocker.title, blockerStatus: blocker.status };
      }
    }
    return { blocked: false, blockerTitle: null, blockerStatus: null };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Add a dependency: blockerTaskId must finish before dependentTaskId. */
export const addDependency = mutation({
  args: {
    orgId:           v.id("organizations"),
    blockerTaskId:   v.id("tasks"),
    dependentTaskId: v.id("tasks"),
    createdBy:       v.id("members"),
  },
  handler: async (ctx, args) => {
    await getCallerMember(ctx, args.orgId);

    if (args.blockerTaskId === args.dependentTaskId) {
      throw new Error("A task cannot depend on itself.");
    }

    // Prevent duplicate
    const existing = await ctx.db
      .query("taskDependencies")
      .withIndex("by_dependent", (q) => q.eq("dependentTaskId", args.dependentTaskId))
      .take(50);
    if (existing.some((d) => d.blockerTaskId === args.blockerTaskId)) {
      throw new Error("This dependency already exists.");
    }

    // Prevent circular: check if dependentTask already blocks blockerTask (direct cycle)
    const reverse = await ctx.db
      .query("taskDependencies")
      .withIndex("by_dependent", (q) => q.eq("dependentTaskId", args.blockerTaskId))
      .take(50);
    if (reverse.some((d) => d.blockerTaskId === args.dependentTaskId)) {
      throw new Error("Cannot create a circular dependency.");
    }

    return ctx.db.insert("taskDependencies", {
      orgId:           args.orgId,
      blockerTaskId:   args.blockerTaskId,
      dependentTaskId: args.dependentTaskId,
      createdBy:       args.createdBy,
      createdAt:       now(),
    });
  },
});

/** Remove a dependency. */
export const removeDependency = mutation({
  args: { dependencyId: v.id("taskDependencies") },
  handler: async (ctx, { dependencyId }) => {
    const dep = await ctx.db.get(dependencyId);
    if (!dep) throw new Error("Dependency not found");
    if (dep.orgId) await getCallerMember(ctx, dep.orgId);
    await ctx.db.delete(dependencyId);
  },
});
