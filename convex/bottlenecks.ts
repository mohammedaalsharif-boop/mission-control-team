import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return [];
    if (task.orgId) await getCallerMember(ctx, task.orgId);
    return ctx.db
      .query("bottlenecks")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
  },
});

export const getActive = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return null;
    if (task.orgId) await getCallerMember(ctx, task.orgId);
    const all = await ctx.db
      .query("bottlenecks")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
    return all.find((b) => !b.resolvedAt) ?? null;
  },
});

export const add = mutation({
  args: {
    orgId:    v.id("organizations"),
    taskId:   v.id("tasks"),
    body:     v.string(),
    stage:    v.string(),
    category: v.optional(v.string()),
    memberId: v.id("members"),
  },
  handler: async (ctx, args) => {
    await getCallerMember(ctx, args.orgId);
    return await ctx.db.insert("bottlenecks", {
      orgId:     args.orgId,
      taskId:    args.taskId,
      body:      args.body.trim(),
      stage:     args.stage,
      category:  args.category,
      createdBy: args.memberId,
      createdAt: now(),
    });
  },
});

export const resolveAll = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);
    const active = await ctx.db
      .query("bottlenecks")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
    for (const b of active) {
      if (!b.resolvedAt) {
        await ctx.db.patch(b._id, { resolvedAt: now() });
      }
    }
  },
});

export const resolve = mutation({
  args: { bottleneckId: v.id("bottlenecks") },
  handler: async (ctx, { bottleneckId }) => {
    const bn = await ctx.db.get(bottleneckId);
    if (!bn) throw new Error("Bottleneck not found");
    if (bn.orgId) await getCallerMember(ctx, bn.orgId);
    await ctx.db.patch(bottleneckId, { resolvedAt: now() });
  },
});

export const analytics = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    const all = await ctx.db
      .query("bottlenecks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const total    = all.length;
    const active   = all.filter((b) => !b.resolvedAt);
    const resolved = all.filter((b) => !!b.resolvedAt);

    const avgResolveMs: number | null = (() => {
      if (resolved.length === 0) return null;
      const sum = resolved.reduce(
        (acc, b) => acc + (b.resolvedAt! - b.createdAt),
        0,
      );
      return sum / resolved.length;
    })();

    const byCat: Record<string, { total: number; active: number }> = {};
    for (const b of all) {
      const cat = b.category ?? "uncategorized";
      if (!byCat[cat]) byCat[cat] = { total: 0, active: 0 };
      byCat[cat].total += 1;
      if (!b.resolvedAt) byCat[cat].active += 1;
    }

    const WEEK_MS    = 7 * 24 * 60 * 60 * 1000;
    const nowMs      = Date.now();
    const thisSunday = (() => {
      const d = new Date(nowMs);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay());
      return d.getTime();
    })();

    const weekStarts: number[] = [];
    for (let i = 5; i >= 0; i--) weekStarts.push(thisSunday - i * WEEK_MS);

    const weeklyCreated = weekStarts.map((wStart) => {
      const wEnd = wStart + WEEK_MS;
      return {
        weekStart: wStart,
        count: all.filter((b) => b.createdAt >= wStart && b.createdAt < wEnd).length,
      };
    });

    const weeklyResolved = weekStarts.map((wStart) => {
      const wEnd = wStart + WEEK_MS;
      return {
        weekStart: wStart,
        count: resolved.filter(
          (b) => b.resolvedAt! >= wStart && b.resolvedAt! < wEnd,
        ).length,
      };
    });

    const topActive = active
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((b) => ({
        id: b._id,
        taskId: b.taskId,
        body: b.body,
        category: b.category ?? null,
        stage: b.stage,
        createdAt: b.createdAt,
      }));

    return {
      total,
      activeCount: active.length,
      resolvedCount: resolved.length,
      avgResolveMs,
      byCategory: byCat,
      weeklyCreated,
      weeklyResolved,
      topActive,
    };
  },
});

export const update = mutation({
  args: {
    bottleneckId: v.id("bottlenecks"),
    body:         v.optional(v.string()),
    category:     v.optional(v.string()),
  },
  handler: async (ctx, { bottleneckId, ...fields }) => {
    const bn = await ctx.db.get(bottleneckId);
    if (!bn) throw new Error("Bottleneck not found");
    if (bn.orgId) await getCallerMember(ctx, bn.orgId);
    const patch: Record<string, unknown> = {};
    if (fields.body     !== undefined) patch.body     = fields.body.trim();
    if (fields.category !== undefined) patch.category = fields.category;
    await ctx.db.patch(bottleneckId, patch);
  },
});
