import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Submit a weekly reflection.
 * One per member per week (keyed by weekStart date string).
 */
export const submit = mutation({
  args: {
    orgId:          v.id("organizations"),
    memberId:       v.id("members"),
    weekStart:      v.string(),
    didLastWeek:    v.string(),
    needThisWeek:   v.string(),
    forgotLastWeek: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already submitted for this week
    const existing = await ctx.db
      .query("weeklyReflections")
      .withIndex("by_member_and_weekStart", (q) =>
        q.eq("memberId", args.memberId).eq("weekStart", args.weekStart)
      )
      .unique();

    if (existing) {
      // Update the existing reflection
      await ctx.db.patch(existing._id, {
        didLastWeek:    args.didLastWeek,
        needThisWeek:   args.needThisWeek,
        forgotLastWeek: args.forgotLastWeek,
      });
      return existing._id;
    }

    // Create new reflection
    return await ctx.db.insert("weeklyReflections", {
      orgId:          args.orgId,
      memberId:       args.memberId,
      weekStart:      args.weekStart,
      didLastWeek:    args.didLastWeek,
      needThisWeek:   args.needThisWeek,
      forgotLastWeek: args.forgotLastWeek,
      createdAt:      Date.now(),
    });
  },
});

/**
 * Check if the current member already submitted a reflection for a given week.
 */
export const getForWeek = query({
  args: {
    memberId:  v.id("members"),
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weeklyReflections")
      .withIndex("by_member_and_weekStart", (q) =>
        q.eq("memberId", args.memberId).eq("weekStart", args.weekStart)
      )
      .unique();
  },
});

/**
 * List all past reflections for a member (most recent first).
 */
export const listByMember = query({
  args: {
    memberId: v.id("members"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("weeklyReflections")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .order("desc")
      .take(52); // up to a year of weekly reflections
  },
});
