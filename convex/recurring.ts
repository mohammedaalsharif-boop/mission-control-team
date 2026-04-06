import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();
const DAY_MS  = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all recurring task templates in a project. */
export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .take(200);
    return tasks.filter((t) => t.isRecurring === true);
  },
});

/** Get all instances spawned from a recurring template. */
export const getInstances = query({
  args: { parentRecurringId: v.id("tasks") },
  handler: async (ctx, { parentRecurringId }) => {
    // We query by member index and filter — for now this works at small scale.
    // A dedicated index could be added if this grows.
    const parent = await ctx.db.get(parentRecurringId);
    if (!parent?.orgId) return [];
    const all = await ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", parent.orgId))
      .take(500);
    return all.filter((t) => t.parentRecurringId === parentRecurringId);
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Set a task as recurring. */
export const setRecurrence = mutation({
  args: {
    taskId:             v.id("tasks"),
    recurrenceRule:     v.string(),           // "daily" | "weekly" | "biweekly" | "monthly" | "custom"
    recurrenceInterval: v.optional(v.number()),
    recurrenceDays:     v.optional(v.array(v.number())),
  },
  handler: async (ctx, { taskId, recurrenceRule, recurrenceInterval, recurrenceDays }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    const validRules = ["daily", "weekly", "biweekly", "monthly", "custom"];
    if (!validRules.includes(recurrenceRule)) {
      throw new Error(`Invalid recurrence rule. Must be: ${validRules.join(", ")}`);
    }

    const nextAt = computeNextRecurrence(Date.now(), recurrenceRule, recurrenceInterval);

    await ctx.db.patch(taskId, {
      isRecurring:        true,
      recurrenceRule,
      recurrenceInterval: recurrenceInterval,
      recurrenceDays:     recurrenceDays,
      nextRecurrenceAt:   nextAt,
      updatedAt:          now(),
    });
  },
});

/** Remove recurrence from a task. */
export const removeRecurrence = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    await ctx.db.patch(taskId, {
      isRecurring:        false,
      recurrenceRule:     undefined,
      recurrenceInterval: undefined,
      recurrenceDays:     undefined,
      nextRecurrenceAt:   undefined,
      updatedAt:          now(),
    });
  },
});

/** Internal mutation called by the cron to spawn due recurring tasks. */
export const spawnDueRecurring = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rightNow = Date.now();
    // Find all tasks where nextRecurrenceAt <= now
    const allRecurring = await ctx.db.query("tasks").take(2000);
    const due = allRecurring.filter(
      (t) => t.isRecurring && t.nextRecurrenceAt && t.nextRecurrenceAt <= rightNow,
    );

    let spawned = 0;
    for (const template of due.slice(0, 50)) {
      // Create the new task instance
      await ctx.db.insert("tasks", {
        orgId:             template.orgId,
        projectId:         template.projectId,
        title:             template.title,
        description:       template.description,
        status:            "draft",
        visibility:        template.visibility,
        memberId:          template.memberId,
        memberName:        template.memberName,
        priority:          template.priority,
        tag:               template.tag,
        dueDate:           template.nextRecurrenceAt! + (template.dueDate && template.createdAt
          ? template.dueDate - template.createdAt : WEEK_MS),
        parentRecurringId: template._id,
        createdAt:         rightNow,
        updatedAt:         rightNow,
      });

      // Advance the nextRecurrenceAt
      const nextAt = computeNextRecurrence(
        template.nextRecurrenceAt!,
        template.recurrenceRule ?? "weekly",
        template.recurrenceInterval,
      );
      await ctx.db.patch(template._id, { nextRecurrenceAt: nextAt, updatedAt: rightNow });
      spawned++;
    }

    return { spawned };
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeNextRecurrence(
  fromMs: number,
  rule: string,
  interval?: number,
): number {
  switch (rule) {
    case "daily":    return fromMs + DAY_MS;
    case "weekly":   return fromMs + WEEK_MS;
    case "biweekly": return fromMs + 2 * WEEK_MS;
    case "monthly": {
      const d = new Date(fromMs);
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
    }
    case "custom":
      return fromMs + (interval ?? 7) * DAY_MS;
    default:
      return fromMs + WEEK_MS;
  }
}
