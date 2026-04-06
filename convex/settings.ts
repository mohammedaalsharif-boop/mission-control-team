import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember, requireAdmin } from "./helpers";

const now = () => Date.now();

export const getSetting = query({
  args: {
    orgId: v.id("organizations"),
    key:   v.string(),
  },
  handler: async (ctx, { orgId, key }) => {
    await getCallerMember(ctx, orgId);
    const s = await ctx.db
      .query("settings")
      .withIndex("by_org_and_key", (q) => q.eq("orgId", orgId).eq("key", key))
      .first();
    return s?.value ?? null;
  },
});

export const getAllSettings = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await getCallerMember(ctx, orgId);
    return ctx.db
      .query("settings")
      .withIndex("by_org_and_key", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

export const setSetting = mutation({
  args: {
    orgId: v.id("organizations"),
    key:   v.string(),
    value: v.string(),
  },
  handler: async (ctx, { orgId, key, value }) => {
    await requireAdmin(ctx, orgId);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org_and_key", (q) => q.eq("orgId", orgId).eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value, updatedAt: now() });
    } else {
      await ctx.db.insert("settings", { orgId, key, value, updatedAt: now() });
    }
  },
});
