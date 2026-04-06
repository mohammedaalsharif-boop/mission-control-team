import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ── Queries ──────────────────────────────────────────────────────────────────

/** Get streak for a single member. */
export const getForMember = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    return await ctx.db
      .query("streaks")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .unique();
  },
});

/** Get all streaks for an org (for analytics). */
export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query("streaks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(200);
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

/** Increment a member's streak (called when a task is completed before deadline). */
export const increment = internalMutation({
  args: {
    orgId:    v.id("organizations"),
    memberId: v.id("members"),
  },
  handler: async (ctx, { orgId, memberId }) => {
    const existing = await ctx.db
      .query("streaks")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .unique();

    if (existing) {
      const newCurrent = existing.current + 1;
      const newBest    = Math.max(existing.best, newCurrent);
      await ctx.db.patch(existing._id, {
        current:   newCurrent,
        best:      newBest,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("streaks", {
        orgId,
        memberId,
        current:   1,
        best:      1,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Reset a member's streak to zero (called when a deadline is missed). */
export const reset = internalMutation({
  args: {
    orgId:    v.id("organizations"),
    memberId: v.id("members"),
  },
  handler: async (ctx, { orgId, memberId }) => {
    const existing = await ctx.db
      .query("streaks")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .unique();

    if (existing) {
      if (existing.current > 0) {
        await ctx.db.patch(existing._id, {
          current:   0,
          updatedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert("streaks", {
        orgId,
        memberId,
        current:   0,
        best:      0,
        updatedAt: Date.now(),
      });
    }
  },
});
