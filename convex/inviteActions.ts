import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCallerMember, requireAdmin } from "./helpers";

const now = () => Date.now();
const INVITE_EXPIRY_DAYS = 7;

/** Generate a cryptographically-random-ish token (good enough for invites). */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// ── Create an invite and trigger the email ──────────────────────────────────
export const createInvite = mutation({
  args: {
    orgId: v.id("organizations"),
    name:  v.string(),
    email: v.string(),
    role:  v.optional(v.string()),
  },
  handler: async (ctx, { orgId, name, email, role }) => {
    const admin = await requireAdmin(ctx, orgId);
    const normalised = email.trim().toLowerCase();

    // Check if already a member
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_org_and_email", (q) => q.eq("orgId", orgId).eq("email", normalised))
      .first();
    if (existingMember) throw new Error("This person is already a member of this organization.");

    // Check for existing pending invite
    const existingInvite = await ctx.db
      .query("invites")
      .withIndex("by_org_and_email", (q) => q.eq("orgId", orgId).eq("email", normalised))
      .first();
    if (existingInvite && existingInvite.status === "pending" && existingInvite.expiresAt > now()) {
      throw new Error("An invite has already been sent to this email. It has not yet expired.");
    }
    // If there's an expired invite, delete it so we can create a fresh one
    if (existingInvite) {
      await ctx.db.delete(existingInvite._id);
    }

    const token = generateToken();
    const expiresAt = now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    const inviteId = await ctx.db.insert("invites", {
      orgId,
      email:     normalised,
      name:      name.trim(),
      role:      role === "manager" ? "manager" : "member",
      token,
      status:    "pending",
      invitedBy: admin._id,
      expiresAt,
      createdAt: now(),
    });

    // Fetch org name for the email
    const org = await ctx.db.get(orgId);
    const orgName = org?.name ?? "your organization";

    // Schedule the email send (runs as an action)
    await ctx.scheduler.runAfter(0, internal.invites.sendInviteEmail, {
      to:          normalised,
      inviteeName: name.trim(),
      orgName,
      inviterName: admin.name,
      token,
    });

    // Activity log
    await ctx.db.insert("activities", {
      orgId,
      type:        "invite_sent",
      memberId:    admin._id,
      memberName:  admin.name,
      description: `Invited ${name.trim()} (${normalised}) to join`,
      createdAt:   now(),
    });

    return { inviteId, token };
  },
});

// ── List pending invites for an org ─────────────────────────────────────────
export const listInvites = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(50);
    return invites;
  },
});

// ── Look up an invite by token (public — used on the /invite page) ─────────
export const getInviteByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!invite) return null;

    // Fetch org name for display
    const org = await ctx.db.get(invite.orgId);
    return {
      _id:       invite._id,
      email:     invite.email,
      name:      invite.name,
      role:      invite.role,
      status:    invite.status,
      orgId:     invite.orgId,
      orgName:   org?.name ?? "Unknown",
      expiresAt: invite.expiresAt,
      expired:   invite.expiresAt < Date.now(),
    };
  },
});

// ── Accept an invite (creates the member record) ────────────────────────────
export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!invite) throw new Error("Invite not found.");
    if (invite.status !== "pending") throw new Error("This invite has already been used.");
    if (invite.expiresAt < now()) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new Error("This invite has expired. Ask your admin to send a new one.");
    }

    // Verify the authenticated user matches the invite email
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("You must be signed in to accept an invite.");

    // Check if already a member (edge case: invited after they joined another way)
    const existing = await ctx.db
      .query("members")
      .withIndex("by_org_and_email", (q) => q.eq("orgId", invite.orgId).eq("email", invite.email))
      .first();
    if (existing) {
      await ctx.db.patch(invite._id, { status: "accepted" });
      return { memberId: existing._id, orgId: invite.orgId };
    }

    // Create the member record
    const memberId = await ctx.db.insert("members", {
      orgId:     invite.orgId,
      name:      invite.name,
      email:     invite.email,
      role:      invite.role,
      createdAt: now(),
    });

    // Mark invite as accepted
    await ctx.db.patch(invite._id, { status: "accepted" });

    // Activity log
    await ctx.db.insert("activities", {
      orgId:       invite.orgId,
      type:        "member_joined",
      memberId,
      memberName:  invite.name,
      description: `${invite.name} accepted their invite and joined`,
      createdAt:   now(),
    });

    // Notify admins that a new member joined
    await ctx.db.insert("notifications", {
      orgId:     invite.orgId,
      type:      "invite_accepted",
      title:     "New Member Joined",
      message:   `${invite.name} (${invite.email}) accepted the invite and joined as ${invite.role}.`,
      forRole:   "admin",
      read:      false,
      createdAt: now(),
    });

    return { memberId, orgId: invite.orgId };
  },
});

// ── Revoke a pending invite (admin only) ────────────────────────────────────
export const revokeInvite = mutation({
  args: {
    orgId:    v.id("organizations"),
    inviteId: v.id("invites"),
  },
  handler: async (ctx, { orgId, inviteId }) => {
    await requireAdmin(ctx, orgId);
    const invite = await ctx.db.get(inviteId);
    if (!invite) throw new Error("Invite not found.");
    if (invite.orgId !== orgId) throw new Error("Invite does not belong to this organization.");
    await ctx.db.delete(inviteId);
  },
});

// ── Resend an invite email ──────────────────────────────────────────────────
export const resendInvite = mutation({
  args: {
    orgId:    v.id("organizations"),
    inviteId: v.id("invites"),
  },
  handler: async (ctx, { orgId, inviteId }) => {
    const admin = await requireAdmin(ctx, orgId);
    const invite = await ctx.db.get(inviteId);
    if (!invite) throw new Error("Invite not found.");
    if (invite.orgId !== orgId) throw new Error("Invite does not belong to this organization.");
    if (invite.status !== "pending") throw new Error("Can only resend pending invites.");

    // Refresh expiry
    const newExpiry = now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    await ctx.db.patch(inviteId, { expiresAt: newExpiry });

    const org = await ctx.db.get(orgId);
    await ctx.scheduler.runAfter(0, internal.invites.sendInviteEmail, {
      to:          invite.email,
      inviteeName: invite.name,
      orgName:     org?.name ?? "your organization",
      inviterName: admin.name,
      token:       invite.token,
    });
  },
});
