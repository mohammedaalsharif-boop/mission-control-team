import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireSameOrg, getCallerMember, requirePermission } from "./helpers";

const now = () => Date.now();

// ── Queries ───────────────────────────────────────────────────────────────────

// List all projects in an org (for global views like calendar)
export const listAll = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) =>
    ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(200),
});

// List all projects in a space (access-aware)
export const listBySpace = query({
  args: {
    spaceId:  v.id("spaces"),
    viewerId: v.id("members"),
  },
  handler: async (ctx, { spaceId, viewerId }) => {
    const viewer   = await ctx.db.get(viewerId);
    if (!viewer) return [];

    if (viewer.role === "admin" || viewer.role === "manager") {
      return ctx.db
        .query("projects")
        .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
        .take(200);
    }

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const accessible = new Set(memberships.map((m) => m.projectId));

    const result = [];
    for await (const p of ctx.db
      .query("projects")
      .withIndex("by_space", (q) => q.eq("spaceId", spaceId))) {
      if (accessible.has(p._id)) result.push(p);
      if (result.length >= 200) break;
    }
    return result;
  },
});

// All projects accessible to a viewer (across all spaces) — used for "My Projects"
export const listForViewer = query({
  args: {
    orgId:    v.id("organizations"),
    viewerId: v.id("members"),
  },
  handler: async (ctx, { orgId, viewerId }) => {
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    if (viewer.role === "admin" || viewer.role === "manager") {
      return ctx.db
        .query("projects")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .take(200);
    }

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const accessible = new Set(memberships.map((m) => m.projectId));

    const result = [];
    for await (const p of ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))) {
      if (accessible.has(p._id)) result.push(p);
      if (result.length >= 200) break;
    }
    return result;
  },
});

// Get a single project by ID
export const getById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) return null;
    // For legacy records without orgId, allow any authenticated user
    if (!project.orgId) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return null;
      return project;
    }
    // Verify caller belongs to the same org
    try {
      await getCallerMember(ctx, project.orgId);
      return project;
    } catch {
      return null;
    }
  },
});

// Get members of a project
export const listMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    const members = await Promise.all(
      memberships.map((m) => ctx.db.get(m.memberId))
    );
    return members.filter(Boolean);
  },
});

// Project stats
export const getStats = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    // Stream and count instead of collecting all tasks into memory
    let total = 0;
    let completed = 0;
    let inProgress = 0;
    let overdue = 0;
    const rightNow = Date.now();

    for await (const t of ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))) {
      total++;
      if (t.status === "completed") completed++;
      else if (t.status === "in_progress") inProgress++;
      if (t.dueDate && t.dueDate < rightNow && t.status !== "completed") overdue++;
    }

    return { total, completed, inProgress, overdue };
  },
});

// ── Mutations ─────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    orgId:       v.id("organizations"),
    spaceId:     v.id("spaces"),
    name:        v.string(),
    description: v.optional(v.string()),
    priority:    v.optional(v.string()),
    ownerId:     v.optional(v.id("members")),
    supporterId: v.optional(v.id("members")),
    startDate:   v.optional(v.number()),
    dueDate:     v.optional(v.number()),
    createdBy:   v.optional(v.id("members")),  // deprecated: now derived server-side
  },
  handler: async (ctx, args) => {
    // Verify the caller has the "project.create" permission
    const member = await requirePermission(ctx, args.orgId, "project.create");

    const projectId = await ctx.db.insert("projects", {
      orgId:       args.orgId,
      spaceId:     args.spaceId,
      name:        args.name.trim(),
      description: args.description,
      status:      "active",
      priority:    args.priority,
      ownerId:     args.ownerId,
      supporterId: args.supporterId,
      startDate:   args.startDate,
      dueDate:     args.dueDate,
      createdBy:   member._id,
      createdAt:   now(),
      updatedAt:   now(),
    });

    await ctx.db.insert("projectMembers", {
      projectId,
      memberId: member._id,
      addedAt:  now(),
    });

    if (args.ownerId && args.ownerId !== member._id) {
      await ctx.db.insert("projectMembers", {
        projectId,
        memberId: args.ownerId,
        addedAt:  now(),
      });
    }

    await ctx.db.insert("activities", {
      orgId:       args.orgId,
      type:        "project_created",
      projectId,
      memberId:    member._id,
      description: `Created project: ${args.name.trim()}`,
      createdAt:   now(),
    });

    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId:   v.id("projects"),
    name:        v.optional(v.string()),
    description: v.optional(v.string()),
    northStar:   v.optional(v.string()),
    status:      v.optional(v.string()),
    priority:    v.optional(v.string()),
    ownerId:     v.optional(v.id("members")),
    startDate:               v.optional(v.number()),
    dueDate:                 v.optional(v.number()),
    estimatedCompletionDate: v.optional(v.number()),
    supporterId:             v.optional(v.id("members")),
  },
  handler: async (ctx, { projectId, ...fields }) => {
    const patch: Record<string, unknown> = { updatedAt: now() };
    if (fields.name                    !== undefined) patch.name                    = fields.name.trim();
    if (fields.description             !== undefined) patch.description             = fields.description;
    if (fields.northStar               !== undefined) patch.northStar               = fields.northStar;
    if (fields.status                  !== undefined) patch.status                  = fields.status;
    if (fields.priority                !== undefined) patch.priority                = fields.priority;
    if (fields.ownerId                 !== undefined) patch.ownerId                 = fields.ownerId;
    if (fields.supporterId             !== undefined) patch.supporterId             = fields.supporterId;
    if (fields.startDate               !== undefined) patch.startDate               = fields.startDate;
    if (fields.dueDate                 !== undefined) patch.dueDate                 = fields.dueDate;
    if (fields.estimatedCompletionDate !== undefined) patch.estimatedCompletionDate = fields.estimatedCompletionDate;
    await ctx.db.patch(projectId, patch);
  },
});

export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await ctx.db.patch(projectId, { status: "archived", updatedAt: now() });
  },
});

export const addMember = mutation({
  args: {
    projectId: v.id("projects"),
    memberId:  v.id("members"),
  },
  handler: async (ctx, { projectId, memberId }) => {
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .filter((q) => q.eq(q.field("memberId"), memberId))
      .first();
    if (existing) return;
    await ctx.db.insert("projectMembers", { projectId, memberId, addedAt: now() });
  },
});

export const removeMember = mutation({
  args: {
    projectId: v.id("projects"),
    memberId:  v.id("members"),
  },
  handler: async (ctx, { projectId, memberId }) => {
    const record = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .filter((q) => q.eq(q.field("memberId"), memberId))
      .first();
    if (record) await ctx.db.delete(record._id);
  },
});
