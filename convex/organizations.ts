import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getCallerMember, requireAdmin, requirePermission } from "./helpers";

const now = () => Date.now();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Create a new organization + seed the creator as admin ────────────────────
export const create = mutation({
  args: {
    name:         v.string(),
    creatorName:  v.string(),
    creatorEmail: v.string(),
  },
  handler: async (ctx, { name, creatorName, creatorEmail }) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Organization name is required.");

    // Generate unique slug
    let slug = slugify(trimmed);
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const orgId = await ctx.db.insert("organizations", {
      name:      trimmed,
      slug,
      plan:      "free",
      createdBy: creatorEmail.trim().toLowerCase(),
      createdAt: now(),
    });

    // Seed creator as the admin of the new org
    const memberId = await ctx.db.insert("members", {
      orgId,
      name:      creatorName.trim(),
      email:     creatorEmail.trim().toLowerCase(),
      role:      "admin",
      createdAt: now(),
    });

    // Seed an activity
    await ctx.db.insert("activities", {
      orgId,
      type:        "org_created",
      memberId,
      memberName:  creatorName.trim(),
      description: `Created organization "${trimmed}"`,
      createdAt:   now(),
    });

    return { orgId, memberId };
  },
});

// ── List all organizations for the current user (by email) ──────────────────
export const listForUser = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalised = email.trim().toLowerCase();
    // Find all member records for this email
    const memberRecords = await ctx.db
      .query("members")
      .withIndex("by_email", (q) => q.eq("email", normalised))
      .collect();

    // Fetch the corresponding orgs, deduplicating by orgId
    const seen = new Set<string>();
    const orgs = [];

    for (const m of memberRecords) {
      if (!m.orgId || seen.has(m.orgId)) continue;
      seen.add(m.orgId);
      const org = await ctx.db.get(m.orgId);
      if (!org) continue;
      orgs.push({
        orgId:    org._id,
        orgName:  org.name,
        orgSlug:  org.slug,
        plan:     org.plan,
        memberId: m._id,
        role:     m.role,
      });
    }

    return orgs;
  },
});

// ── Get a single organization by ID ──────────────────────────────────────────
export const getById = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    // Verify caller is a member of this org
    await getCallerMember(ctx, orgId);
    return ctx.db.get(orgId);
  },
});

// ── Update organization (admin only) ─────────────────────────────────────────
export const update = mutation({
  args: {
    orgId: v.id("organizations"),
    name:  v.optional(v.string()),
  },
  handler: async (ctx, { orgId, name }) => {
    await requirePermission(ctx, orgId, "settings.edit");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name.trim();
    await ctx.db.patch(orgId, patch);
  },
});

// ── [DEPRECATED] Direct member addition ──────────────────────────────────────
// This mutation is kept for backward compatibility but now throws an error
// directing callers to use the invite system (inviteActions.createInvite)
// which sends an email and requires the invitee to verify their identity.
export const inviteMember = mutation({
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
