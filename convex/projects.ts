import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireSameOrg, getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Queries ───────────────────────────────────────────────────────────────────

// List all projects in an org (for global views like calendar)
export const listAll = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) =>
    ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect(),
});

// List all projects in a space (access-aware)
export const listBySpace = query({
  args: {
    spaceId:  v.id("spaces"),
    viewerId: v.id("members"),
  },
  handler: async (ctx, { spaceId, viewerId }) => {
    const viewer   = await ctx.db.get(viewerId);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_space", (q) => q.eq("spaceId", spaceId))
      .collect();

    if (!viewer) return [];
    if (viewer.role === "admin" || viewer.role === "manager") {
      return projects;
    }

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const accessible = new Set(memberships.map((m) => m.projectId));
    return projects.filter((p) => accessible.has(p._id));
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
    const all    = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    if (!viewer) return [];
    if (viewer.role === "admin" || viewer.role === "manager") {
      return all;
    }

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const accessible = new Set(memberships.map((m) => m.projectId));
    return all.filter((p) => accessible.has(p._id));
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
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const total      = tasks.length;
    const completed  = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const overdue    = tasks.filter(
      (t) => t.dueDate && t.dueDate < Date.now() && t.status !== "completed"
    ).length;

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
    createdBy:   v.id("members"),
  },
  handler: async (ctx, args) => {
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
      createdBy:   args.createdBy,
      createdAt:   now(),
      updatedAt:   now(),
    });

    await ctx.db.insert("projectMembers", {
      projectId,
      memberId: args.createdBy,
      addedAt:  now(),
    });

    if (args.ownerId && args.ownerId !== args.createdBy) {
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
      memberId:    args.createdBy,
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
