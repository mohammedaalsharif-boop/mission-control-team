import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getCallerMember, requireAdminOrManager } from "./helpers";

const now = () => Date.now();

// ── Available triggers and actions ───────────────────────────────────────────

export const TRIGGERS = [
  { id: "task.status_changed",   label: "Task status changes" },
  { id: "task.created",          label: "Task is created" },
  { id: "task.completed",        label: "Task is completed" },
  { id: "task.overdue",          label: "Task becomes overdue" },
  { id: "subtasks.all_completed", label: "All subtasks completed" },
  { id: "task.assigned",         label: "Task is assigned" },
] as const;

export const ACTIONS = [
  { id: "notify_owner",     label: "Notify project owner" },
  { id: "notify_assignee",  label: "Notify assigned member" },
  { id: "notify_admins",    label: "Notify all admins" },
  { id: "change_status",    label: "Change task status" },
  { id: "assign_member",    label: "Assign to member" },
  { id: "add_comment",      label: "Add automated comment" },
] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all automations for an org. */
export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    return ctx.db
      .query("automations")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(50);
  },
});

/** Get metadata about available triggers and actions (for the UI). */
export const getMetadata = query({
  args: {},
  handler: async () => ({
    triggers: TRIGGERS.map((t) => ({ ...t })),
    actions:  ACTIONS.map((a) => ({ ...a })),
  }),
});

// ── CRUD Mutations ────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId:        v.id("organizations"),
    name:         v.string(),
    trigger:      v.string(),
    condition:    v.optional(v.string()),
    action:       v.string(),
    actionConfig: v.optional(v.string()),
    createdBy:    v.id("members"),
  },
  handler: async (ctx, args) => {
    await requireAdminOrManager(ctx, args.orgId);

    if (!args.name.trim()) throw new Error("Automation name is required.");

    return ctx.db.insert("automations", {
      orgId:        args.orgId,
      name:         args.name.trim(),
      enabled:      true,
      trigger:      args.trigger,
      condition:    args.condition,
      action:       args.action,
      actionConfig: args.actionConfig,
      createdBy:    args.createdBy,
      createdAt:    now(),
      updatedAt:    now(),
    });
  },
});

export const update = mutation({
  args: {
    automationId: v.id("automations"),
    name:         v.optional(v.string()),
    enabled:      v.optional(v.boolean()),
    trigger:      v.optional(v.string()),
    condition:    v.optional(v.string()),
    action:       v.optional(v.string()),
    actionConfig: v.optional(v.string()),
  },
  handler: async (ctx, { automationId, ...fields }) => {
    const auto = await ctx.db.get(automationId);
    if (!auto) throw new Error("Automation not found");
    await requireAdminOrManager(ctx, auto.orgId);

    const patch: Record<string, unknown> = { updatedAt: now() };
    for (const [k, val] of Object.entries(fields)) {
      if (val !== undefined) patch[k] = typeof val === "string" ? val.trim() : val;
    }
    await ctx.db.patch(automationId, patch);
  },
});

export const remove = mutation({
  args: { automationId: v.id("automations") },
  handler: async (ctx, { automationId }) => {
    const auto = await ctx.db.get(automationId);
    if (!auto) throw new Error("Automation not found");
    await requireAdminOrManager(ctx, auto.orgId);
    await ctx.db.delete(automationId);
  },
});

// ── Automation execution engine (called internally by task mutations) ─────────

/**
 * Fire automations for a given trigger.
 * Called internally after task mutations (e.g. status change, creation).
 */
export const fireAutomations = internalMutation({
  args: {
    orgId:   v.id("organizations"),
    trigger: v.string(),
    taskId:  v.id("tasks"),
    payload: v.optional(v.string()),  // JSON-encoded context (e.g. {"newStatus":"submitted"})
  },
  handler: async (ctx, { orgId, trigger, taskId, payload }) => {
    const automations = await ctx.db
      .query("automations")
      .withIndex("by_org_and_trigger", (q) => q.eq("orgId", orgId).eq("trigger", trigger))
      .take(20);

    const enabled = automations.filter((a) => a.enabled);
    const task    = await ctx.db.get(taskId);
    if (!task) return { fired: 0 };

    const parsedPayload = payload ? JSON.parse(payload) : {};
    let fired = 0;

    for (const auto of enabled) {
      // Check condition (if any)
      if (auto.condition) {
        try {
          const cond = JSON.parse(auto.condition);
          // Simple condition matching: {"status": "submitted"} checks if task.status === "submitted"
          const condMet = Object.entries(cond).every(
            ([key, val]) => (task as Record<string, unknown>)[key] === val || parsedPayload[key] === val,
          );
          if (!condMet) continue;
        } catch {
          continue; // malformed condition, skip
        }
      }

      // Execute action
      const config = auto.actionConfig ? JSON.parse(auto.actionConfig) : {};

      switch (auto.action) {
        case "notify_owner": {
          const project = task.projectId ? await ctx.db.get(task.projectId) : null;
          if (project?.ownerId) {
            await ctx.db.insert("notifications", {
              orgId,
              type:        "task_mention",
              title:       `Automation: ${auto.name}`,
              message:     `"${task.title}" triggered rule: ${auto.name}`,
              forRole:     "admin",
              forMemberId: project.ownerId,
              taskId,
              read:        false,
              createdAt:   Date.now(),
            });
          }
          break;
        }
        case "notify_assignee": {
          await ctx.db.insert("notifications", {
            orgId,
            type:        "task_mention",
            title:       `Automation: ${auto.name}`,
            message:     `"${task.title}" triggered rule: ${auto.name}`,
            forRole:     "member",
            forMemberId: task.memberId,
            taskId,
            read:        false,
            createdAt:   Date.now(),
          });
          break;
        }
        case "notify_admins": {
          const admins = await ctx.db
            .query("members")
            .withIndex("by_org", (q) => q.eq("orgId", orgId))
            .take(50);
          for (const admin of admins.filter((m) => m.role === "admin")) {
            await ctx.db.insert("notifications", {
              orgId,
              type:        "task_mention",
              title:       `Automation: ${auto.name}`,
              message:     `"${task.title}" triggered rule: ${auto.name}`,
              forRole:     "admin",
              forMemberId: admin._id,
              taskId,
              read:        false,
              createdAt:   Date.now(),
            });
          }
          break;
        }
        case "change_status": {
          if (config.status) {
            await ctx.db.patch(taskId, { status: config.status, updatedAt: Date.now() });
          }
          break;
        }
        case "assign_member": {
          if (config.memberId) {
            const memberId = config.memberId as Id<"members">;
            const member = await ctx.db.get(memberId);
            if (member) {
              await ctx.db.patch(taskId, {
                memberId: member._id,
                memberName: member.name,
                updatedAt: Date.now(),
              });
            }
          }
          break;
        }
        case "add_comment": {
          if (config.body) {
            await ctx.db.insert("comments", {
              taskId,
              memberId:   task.memberId,
              memberName: "Automation",
              body:       config.body,
              createdAt:  Date.now(),
            });
          }
          break;
        }
      }

      fired++;
    }

    return { fired };
  },
});
