import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Get notifications for admin in an org ────────────────────────────────────
export const listAdminNotifications = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(100);
    return all.filter((n) => n.forRole === "admin");
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
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return all.filter((n) => n.forRole === "admin" && !n.read).length;
  },
});

// ── Count unread for member ────────────────────────────────────────────────────
export const countUnreadMember = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    if (!member) return 0;
    if (member.orgId) await getCallerMember(ctx, member.orgId);
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_member", (q) => q.eq("forMemberId", memberId))
      .collect();
    return all.filter((n) => !n.read).length;
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
    const all = memberId
      ? await ctx.db.query("notifications").withIndex("by_member", (q) => q.eq("forMemberId", memberId)).collect()
      : await ctx.db.query("notifications").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();

    const unread = memberId
      ? all.filter((n) => !n.read)
      : all.filter((n) => n.forRole === role && !n.read);

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});
