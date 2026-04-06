import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Get notifications for admin in an org ────────────────────────────────────
export const listAdminNotifications = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    // Use compound index to fetch only admin notifications directly
    const result = [];
    for await (const n of ctx.db
      .query("notifications")
      .withIndex("by_org_and_role_and_read", (q) =>
        q.eq("orgId", orgId).eq("forRole", "admin"))
      .order("desc")) {
      result.push(n);
      if (result.length >= 100) break;
    }
    return result;
  },
});

// ── Get notifications for a member ────────────────────────────────────────────
export const listMemberNotifications = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    if (!member) return [];
    if (member.orgId) await getCallerMember(ctx, member.orgId);
    return ctx.db
      .query("notifications")
      .withIndex("by_member", (q) => q.eq("forMemberId", memberId))
      .order("desc")
      .take(50);
  },
});

// ── Count unread for admin in org ─────────────────────────────────────────────
export const countUnreadAdmin = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    // Use compound index to count only unread admin notifications
    let count = 0;
    for await (const _ of ctx.db
      .query("notifications")
      .withIndex("by_org_and_role_and_read", (q) =>
        q.eq("orgId", orgId).eq("forRole", "admin").eq("read", false))) {
      count++;
    }
    return count;
  },
});

// ── Count unread for member ────────────────────────────────────────────────────
export const countUnreadMember = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    if (!member) return 0;
    if (member.orgId) await getCallerMember(ctx, member.orgId);
    // Use compound index to count only unread member notifications
    let count = 0;
    for await (const _ of ctx.db
      .query("notifications")
      .withIndex("by_member_and_read", (q) =>
        q.eq("forMemberId", memberId).eq("read", false))) {
      count++;
    }
    return count;
  },
});

// ── Mark a notification as read ────────────────────────────────────────────────
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, { notificationId }) => {
    const notif = await ctx.db.get(notificationId);
    if (!notif) throw new Error("Notification not found");
    if (notif.orgId) await getCallerMember(ctx, notif.orgId);
    await ctx.db.patch(notificationId, { read: true });
  },
});

// ── Mark all as read ───────────────────────────────────────────────────────────
export const markAllRead = mutation({
  args: {
    orgId:    v.id("organizations"),
    role:     v.string(),
    memberId: v.optional(v.id("members")),
  },
  handler: async (ctx, { orgId, role, memberId }) => {
    await getCallerMember(ctx, orgId);

    // Use compound indexes to fetch only unread notifications directly
    if (memberId) {
      const unread = await ctx.db
        .query("notifications")
        .withIndex("by_member_and_read", (q) =>
          q.eq("forMemberId", memberId).eq("read", false))
        .take(500);
      for (const n of unread) {
        await ctx.db.patch(n._id, { read: true });
      }
    } else {
      const unread = await ctx.db
        .query("notifications")
        .withIndex("by_org_and_role_and_read", (q) =>
          q.eq("orgId", orgId).eq("forRole", role).eq("read", false))
        .take(500);
      for (const n of unread) {
        await ctx.db.patch(n._id, { read: true });
      }
    }
  },
});
