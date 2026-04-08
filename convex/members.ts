import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember, requireAdmin, requirePermission, requireSameOrg } from "./helpers";

const now = () => Date.now();

// ── Validate login — called from the login page ────────────────────────────────
// Looks up the email in the members table for a specific org.
// Returns the member record or null.
export const validateLogin = mutation({
  args: {
    email: v.string(),
    orgId: v.id("organizations"),
  },
  handler: async (ctx, { email, orgId }) => {
    const normalised = email.trim().toLowerCase();

    const member = await ctx.db
      .query("members")
      .withIndex("by_org_and_email", (q) => q.eq("orgId", orgId).eq("email", normalised))
      .first();

    return member ?? null;
  },
});

// ── List all members in an org ────────────────────────────────────────────────
export const listMembers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    try { await getCallerMember(ctx, orgId); } catch { return []; }
    return ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("asc")
      .collect();
  },
});

// ── [DEPRECATED] Direct member addition ──────────────────────────────────────
// Kept for backward compatibility. Use inviteActions.createInvite instead,
// which sends an email invitation and requires the invitee to sign up.
export const addMember = mutation({
  args: {
    orgId: v.id("organizations"),
    name:  v.string(),
    email: v.string(),
    role:  v.optional(v.string()),
  },
  handler: async (_ctx, _args) => {
    throw new Error(
      "Direct member addition is disabled. Use the invite system instead " +
      "(inviteActions.createInvite) which sends an email invitation."
    );
  },
});

// ── Remove a member ────────────────────────────────────────────────────────────
export const removeMember = mutation({
  args: {
    orgId:    v.id("organizations"),
    memberId: v.id("members"),
  },
  handler: async (ctx, { orgId, memberId }) => {
    await requirePermission(ctx, orgId, "member.remove");
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");
    if (member.orgId !== orgId) throw new Error("Member does not belong to this organization.");
    if (member.role === "admin") throw new Error("Cannot remove the admin.");

    // ── Invalidate auth sessions ──────────────────────────────────────────
    // Find the auth user by email (using the built-in email index), then
    // expire all their sessions so they are immediately signed out.
    const authUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", member.email.toLowerCase()))
      .first();
    if (authUser) {
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", authUser._id))
        .take(100);
      for (const session of sessions) {
        // Set expirationTime to now so the session is immediately invalid
        await ctx.db.patch(session._id, { expirationTime: Date.now() });
      }
    }

    // ── Count tasks that belong to this member (never delete them) ─────────
    const memberTasks = await ctx.db
      .query("tasks")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .take(500);
    const openTasks = memberTasks.filter(
      (t) => t.status !== "completed"
    );

    await ctx.db.delete(memberId);

    await ctx.db.insert("activities", {
      orgId,
      type:        "member_removed",
      memberId,
      memberName:  member.name,
      description: `Removed team member: ${member.name}`,
      createdAt:   now(),
    });

    // ── Notify all admins to reassign open tasks ────────────────────────
    if (openTasks.length > 0) {
      const admins = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      for (const admin of admins) {
        if (admin.role === "admin" || admin.role === "manager") {
          await ctx.db.insert("notifications", {
            orgId,
            type:        "reassign_tasks",
            title:       "Tasks Need Reassignment",
            message:     `${member.name} was removed and has ${openTasks.length} open task${openTasks.length > 1 ? "s" : ""} that need to be reassigned.`,
            forRole:     admin.role,
            forMemberId: admin._id,
            read:        false,
            createdAt:   now(),
          });
        }
      }
    }
  },
});

// ── Get single member by ID ────────────────────────────────────────────────────
export const getMember = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    return requireSameOrg(ctx, member, "Member");
  },
});

// ── Update member role (admin only) ───────────────────────────────────────────
export const updateMemberRole = mutation({
  args: {
    orgId:    v.id("organizations"),
    memberId: v.id("members"),
    role:     v.string(),
  },
  handler: async (ctx, { orgId, memberId, role }) => {
    await requirePermission(ctx, orgId, "member.role_change");
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found");
    if (member.orgId !== orgId) throw new Error("Member does not belong to this organization.");
    if (member.role === "admin") throw new Error("Cannot change the admin's role.");
    await ctx.db.patch(memberId, { role });
    await ctx.db.insert("activities", {
      orgId,
      type:        "role_changed",
      memberId,
      memberName:  member.name,
      description: `${member.name}'s role changed to ${role}`,
      createdAt:   now(),
    });
  },
});
