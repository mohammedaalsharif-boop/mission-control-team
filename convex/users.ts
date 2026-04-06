import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Returns the members-table record for the currently signed-in user
// in a specific organization.
export const currentMember = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject.split("|")[0] as Id<"users">;
    const authUser = await ctx.db.get(userId);
    if (!authUser?.email) return null;

    return ctx.db
      .query("members")
      .withIndex("by_org_and_email", (q) => q.eq("orgId", orgId).eq("email", authUser.email!))
      .first();
  },
});

// Returns the authenticated user's email (for org selection screen).
export const currentEmail = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Try the identity email directly first (Convex Auth sets this)
    if (identity.email) return identity.email;

    // Fallback: look up user record
    try {
      const userId = identity.subject.split("|")[0] as Id<"users">;
      const authUser = await ctx.db.get(userId);
      return authUser?.email ?? null;
    } catch {
      return null;
    }
  },
});
