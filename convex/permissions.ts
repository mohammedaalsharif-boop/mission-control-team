import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember, requireAdmin } from "./helpers";

const now = () => Date.now();

// ── All available permissions in the system ──────────────────────────────────
export const ALL_PERMISSIONS = [
  "space.create", "space.edit", "space.delete", "space.archive",
  "project.create", "project.edit", "project.delete",
  "task.create", "task.edit", "task.delete", "task.approve", "task.assign",
  "member.invite", "member.remove", "member.role_change",
  "settings.edit",
  "goal.create", "goal.edit", "goal.delete",
  "automation.create", "automation.edit", "automation.delete",
  "custom_field.create", "custom_field.edit", "custom_field.delete",
] as const;

// ── Default role templates ───────────────────────────────────────────────────
const SYSTEM_ROLES: Record<string, string[]> = {
  Admin: [...ALL_PERMISSIONS],
  Manager: [
    "space.create", "space.edit", "space.archive",
    "project.create", "project.edit",
    "task.create", "task.edit", "task.delete", "task.approve", "task.assign",
    "member.invite",
    "goal.create", "goal.edit",
    "automation.create", "automation.edit",
    "custom_field.create", "custom_field.edit",
  ],
  Member: [
    "task.create", "task.edit",
  ],
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** List all roles for an org. */
export const listRoles = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    return ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(20);
  },
});

/** Get permissions for a specific member (by their role name). */
export const getMemberPermissions = query({
  args: {
    orgId:    v.id("organizations"),
    roleName: v.string(),
  },
  handler: async (ctx, { orgId, roleName }) => {
    await getCallerMember(ctx, orgId);
    const role = await ctx.db
      .query("roles")
      .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId).eq("name", roleName))
      .first();
    return role?.permissions ?? [];
  },
});

/** Get all available permissions (for the settings UI). */
export const getAllPermissions = query({
  args: {},
  handler: async () => {
    return [...ALL_PERMISSIONS];
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Seed the default system roles for an org (call once when org is created). */
export const seedDefaultRoles = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    // Check if roles already exist
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(1);
    if (existing.length > 0) return; // already seeded

    for (const [name, perms] of Object.entries(SYSTEM_ROLES)) {
      await ctx.db.insert("roles", {
        orgId,
        name,
        isSystem: true,
        permissions: perms,
        createdAt: now(),
        updatedAt: now(),
      });
    }
  },
});

/** Create a custom role. */
export const createRole = mutation({
  args: {
    orgId:       v.id("organizations"),
    name:        v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, { orgId, name, permissions }) => {
    await requireAdmin(ctx, orgId);

    if (!name.trim()) throw new Error("Role name is required.");

    // Check for duplicate name
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId).eq("name", name.trim()))
      .first();
    if (existing) throw new Error(`Role "${name}" already exists.`);

    return ctx.db.insert("roles", {
      orgId,
      name: name.trim(),
      isSystem: false,
      permissions,
      createdAt: now(),
      updatedAt: now(),
    });
  },
});

/** Update a role's permissions. */
export const updateRole = mutation({
  args: {
    roleId:      v.id("roles"),
    name:        v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { roleId, ...fields }) => {
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Role not found");
    await requireAdmin(ctx, role.orgId);

    // Can't rename system roles
    if (role.isSystem && fields.name && fields.name !== role.name) {
      throw new Error("Cannot rename system roles.");
    }

    const patch: Record<string, unknown> = { updatedAt: now() };
    if (fields.name        !== undefined) patch.name        = fields.name.trim();
    if (fields.permissions !== undefined) patch.permissions = fields.permissions;
    await ctx.db.patch(roleId, patch);
  },
});

/** Delete a custom role (system roles can't be deleted). */
export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, { roleId }) => {
    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Role not found");
    await requireAdmin(ctx, role.orgId);
    if (role.isSystem) throw new Error("Cannot delete system roles.");
    await ctx.db.delete(roleId);
  },
});
