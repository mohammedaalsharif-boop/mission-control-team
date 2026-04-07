import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCallerMember, requireAdmin } from "./helpers";

const now = () => Date.now();

// ── Transfer admin role to another member ────────────────────────────────────
// The current admin can hand over admin rights to any other member.
// The old admin becomes a "manager" so they still have elevated access.
export const transferAdmin = mutation({
  args: {
    orgId:       v.id("organizations"),
    newAdminId:  v.id("members"),
  },
  handler: async (ctx, { orgId, newAdminId }) => {
    const currentAdmin = await requireAdmin(ctx, orgId);

    const newAdmin = await ctx.db.get(newAdminId);
    if (!newAdmin) throw new Error("Member not found.");
    if (newAdmin.orgId !== orgId) throw new Error("Member does not belong to this organization.");
    if (newAdmin._id === currentAdmin._id) throw new Error("You are already the admin.");

    // Promote the new admin
    await ctx.db.patch(newAdminId, { role: "admin" });
    // Demote the old admin to manager
    await ctx.db.patch(currentAdmin._id, { role: "manager" });

    await ctx.db.insert("activities", {
      orgId,
      type:        "admin_transferred",
      memberId:    currentAdmin._id,
      memberName:  currentAdmin.name,
      description: `Admin role transferred from ${currentAdmin.name} to ${newAdmin.name}`,
      createdAt:   now(),
    });

    return { oldAdmin: currentAdmin._id, newAdmin: newAdminId };
  },
});

// ── Set a backup admin ───────────────────────────────────────────────────────
// Designates a member as backup admin. If the primary admin is ever removed
// or loses access, this member can be promoted.
export const setBackupAdmin = mutation({
  args: {
    orgId:    v.id("organizations"),
    memberId: v.id("members"),
  },
  handler: async (ctx, { orgId, memberId }) => {
    await requireAdmin(ctx, orgId);

    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found.");
    if (member.orgId !== orgId) throw new Error("Member does not belong to this organization.");
    if (member.role === "admin") throw new Error("This member is already the admin.");

    // Store backup admin in org settings
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org_and_key", (q) => q.eq("orgId", orgId).eq("key", "backup_admin"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { value: memberId, updatedAt: now() });
    } else {
      await ctx.db.insert("settings", {
        orgId,
        key:       "backup_admin",
        value:     memberId,
        updatedAt: now(),
      });
    }

    await ctx.db.insert("activities", {
      orgId,
      type:        "backup_admin_set",
      memberId,
      memberName:  member.name,
      description: `${member.name} designated as backup admin`,
      createdAt:   now(),
    });

    return memberId;
  },
});

// ── Get the current backup admin ─────────────────────────────────────────────
export const getBackupAdmin = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    try { await getCallerMember(ctx, orgId); } catch { return null; }

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_org_and_key", (q) => q.eq("orgId", orgId).eq("key", "backup_admin"))
      .first();

    if (!setting) return null;

    const member = await ctx.db.get(setting.value as any);
    return member ?? null;
  },
});

// ── Emergency recovery: promote backup admin ─────────────────────────────────
// This can be called by the backup admin themselves if the current admin
// account is inaccessible. It verifies the caller IS the designated backup.
export const activateBackupAdmin = mutation({
  args: {
    orgId: v.id("organizations"),
  },
  handler: async (ctx, { orgId }) => {
    const caller = await getCallerMember(ctx, orgId);

    // Verify the caller is the designated backup
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_org_and_key", (q) => q.eq("orgId", orgId).eq("key", "backup_admin"))
      .first();

    if (!setting || setting.value !== caller._id) {
      throw new Error("You are not the designated backup admin for this organization.");
    }

    // Find the current admin
    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(200);
    const currentAdmin = members.find((m) => m.role === "admin");

    // Demote current admin to manager (if they still exist)
    if (currentAdmin) {
      await ctx.db.patch(currentAdmin._id, { role: "manager" });
    }

    // Promote backup to admin
    await ctx.db.patch(caller._id, { role: "admin" });

    // Clear the backup setting
    await ctx.db.delete(setting._id);

    await ctx.db.insert("activities", {
      orgId,
      type:        "backup_admin_activated",
      memberId:    caller._id,
      memberName:  caller.name,
      description: `${caller.name} activated backup admin recovery${currentAdmin ? `, replacing ${currentAdmin.name}` : ""}`,
      createdAt:   now(),
    });

    return caller._id;
  },
});
