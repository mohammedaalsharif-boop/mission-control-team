import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember, requireAdminOrManager } from "./helpers";

const now = () => Date.now();

const VALID_FIELD_TYPES = ["text", "number", "select", "date", "checkbox"];

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all custom field definitions for an org. */
export const listDefs = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    return ctx.db
      .query("customFieldDefs")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(50);
  },
});

/** Get all field values for a task. */
export const getTaskValues = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return ctx.db
      .query("customFieldValues")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .take(50);
  },
});

// ── Field definition mutations ────────────────────────────────────────────────

/** Create a new custom field definition (admin/manager only). */
export const createDef = mutation({
  args: {
    orgId:     v.id("organizations"),
    name:      v.string(),
    fieldType: v.string(),
    options:   v.optional(v.array(v.string())),
    required:  v.optional(v.boolean()),
    createdBy: v.id("members"),
  },
  handler: async (ctx, args) => {
    await requireAdminOrManager(ctx, args.orgId);

    if (!VALID_FIELD_TYPES.includes(args.fieldType)) {
      throw new Error(`Invalid field type "${args.fieldType}". Must be one of: ${VALID_FIELD_TYPES.join(", ")}`);
    }
    if (!args.name.trim()) throw new Error("Field name is required.");

    // Get current count for sort order
    const existing = await ctx.db
      .query("customFieldDefs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .take(50);

    return ctx.db.insert("customFieldDefs", {
      orgId:     args.orgId,
      name:      args.name.trim(),
      fieldType: args.fieldType,
      options:   args.fieldType === "select" ? args.options : undefined,
      required:  args.required ?? false,
      sortOrder: existing.length,
      createdBy: args.createdBy,
      createdAt: now(),
    });
  },
});

/** Update a custom field definition. */
export const updateDef = mutation({
  args: {
    fieldId:   v.id("customFieldDefs"),
    name:      v.optional(v.string()),
    options:   v.optional(v.array(v.string())),
    required:  v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { fieldId, ...fields }) => {
    const def = await ctx.db.get(fieldId);
    if (!def) throw new Error("Field definition not found");
    await requireAdminOrManager(ctx, def.orgId);

    const patch: Record<string, unknown> = {};
    if (fields.name      !== undefined) patch.name      = fields.name.trim();
    if (fields.options   !== undefined) patch.options   = fields.options;
    if (fields.required  !== undefined) patch.required  = fields.required;
    if (fields.sortOrder !== undefined) patch.sortOrder = fields.sortOrder;
    await ctx.db.patch(fieldId, patch);
  },
});

/** Delete a custom field definition and all its values. */
export const deleteDef = mutation({
  args: { fieldId: v.id("customFieldDefs") },
  handler: async (ctx, { fieldId }) => {
    const def = await ctx.db.get(fieldId);
    if (!def) throw new Error("Field definition not found");
    await requireAdminOrManager(ctx, def.orgId);

    // Delete all values for this field
    const values = await ctx.db
      .query("customFieldValues")
      .withIndex("by_field", (q) => q.eq("fieldId", fieldId))
      .take(500);
    for (const val of values) {
      await ctx.db.delete(val._id);
    }
    await ctx.db.delete(fieldId);
  },
});

// ── Field value mutations ─────────────────────────────────────────────────────

/** Set a custom field value on a task (upsert). */
export const setValue = mutation({
  args: {
    taskId:  v.id("tasks"),
    fieldId: v.id("customFieldDefs"),
    value:   v.string(),
  },
  handler: async (ctx, { taskId, fieldId, value }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    // Upsert: find existing value for this task+field
    const existing = await ctx.db
      .query("customFieldValues")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .take(50);
    const found = existing.find((v) => v.fieldId === fieldId);

    if (found) {
      await ctx.db.patch(found._id, { value, updatedAt: now() });
      return found._id;
    } else {
      return ctx.db.insert("customFieldValues", {
        taskId,
        fieldId,
        value,
        updatedAt: now(),
      });
    }
  },
});

/** Remove a custom field value from a task. */
export const removeValue = mutation({
  args: { valueId: v.id("customFieldValues") },
  handler: async (ctx, { valueId }) => {
    const val = await ctx.db.get(valueId);
    if (!val) throw new Error("Value not found");
    const task = await ctx.db.get(val.taskId);
    if (task?.orgId) await getCallerMember(ctx, task.orgId);
    await ctx.db.delete(valueId);
  },
});
