/**
 * One-time migration mutations.
 * Run from the Convex dashboard or via `npx convex run migrations:seedHierarchy`.
 *
 * Safe to run multiple times — all operations are idempotent.
 * All mutations require admin authentication.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Seed default Space + Project and backfill existing tasks ──────────────────
//
// Creates:
//   Space   → "General"
//   Project → "Uncategorized Tasks"  (inside General)
//
// Then patches every task that has no projectId to point at this project.
export const seedHierarchy = mutation({
  handler: async (ctx) => {
    // ── 1. Find or create the admin member ──────────────────────────────────
    const admin = await ctx.db
      .query("members")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    if (!admin) throw new Error("No admin found — log in first to seed the admin account.");

    // Verify caller is admin in this org
    if (admin.orgId) await requireAdmin(ctx, admin.orgId);

    // ── 2. Find or create the "General" space ───────────────────────────────
    const spaces = await ctx.db.query("spaces").collect();
    let generalSpace = spaces.find((s) => s.name === "General");

    if (!generalSpace) {
      const spaceId = await ctx.db.insert("spaces", {
        orgId:      admin.orgId,
        name:      "General",
        description: "Default space for migrated tasks",
        color:     "#6366f1",
        icon:      "\ud83d\udcc1",
        createdBy: admin._id,
        createdAt: now(),
      });
      generalSpace = (await ctx.db.get(spaceId))!;
    }

    // ── 3. Find or create the "Uncategorized Tasks" project ─────────────────
    const existingProjects = await ctx.db
      .query("projects")
      .withIndex("by_space", (q) => q.eq("spaceId", generalSpace!._id))
      .collect();
    let uncategorized = existingProjects.find((p) => p.name === "Uncategorized Tasks");

    if (!uncategorized) {
      const projectId = await ctx.db.insert("projects", {
        orgId:       admin.orgId,
        spaceId:     generalSpace._id,
        name:        "Uncategorized Tasks",
        description: "All tasks migrated from the previous flat model",
        status:      "active",
        ownerId:     admin._id,
        createdBy:   admin._id,
        createdAt:   now(),
        updatedAt:   now(),
      });
      // Add admin as project member
      await ctx.db.insert("projectMembers", {
        projectId,
        memberId: admin._id,
        addedAt:  now(),
      });
      uncategorized = (await ctx.db.get(projectId))!;
    }

    // ── 4. Backfill all tasks that have no projectId ────────────────────────
    const allTasks = await ctx.db.query("tasks").collect();
    let patched = 0;
    for (const task of allTasks) {
      if (!task.projectId) {
        await ctx.db.patch(task._id, { projectId: uncategorized._id });
        patched++;
      }
    }

    // ── 5. Also add every non-admin member to the uncategorized project ─────
    const allMembers = await ctx.db.query("members").collect();
    for (const member of allMembers) {
      if (member._id === admin._id) continue;
      const alreadyIn = await ctx.db
        .query("projectMembers")
        .withIndex("by_project", (q) => q.eq("projectId", uncategorized!._id))
        .filter((q) => q.eq(q.field("memberId"), member._id))
        .first();
      if (!alreadyIn) {
        await ctx.db.insert("projectMembers", {
          projectId: uncategorized._id,
          memberId:  member._id,
          addedAt:   now(),
        });
      }
    }

    return {
      spaceId:   generalSpace._id,
      projectId: uncategorized._id,
      patched,
      message:   `Migration complete. ${patched} tasks backfilled to "Uncategorized Tasks".`,
    };
  },
});

// ── Status check — see what the migration would do before running ─────────────
export const migrationStatus = query({
  handler: async (ctx) => {
    const allTasks = await ctx.db.query("tasks").collect();
    const totalTasks    = allTasks.length;
    const unlinkedTasks = allTasks.filter((t) => !t.projectId).length;
    const spaces        = (await ctx.db.query("spaces").collect()).length;
    const projects      = (await ctx.db.query("projects").collect()).length;
    return { totalTasks, unlinkedTasks, spaces, projects };
  },
});

// ── List all organizations (helper for finding your org ID) ─────────────────
export const listOrgs = query({
  handler: async (ctx) => {
    return ctx.db.query("organizations").collect();
  },
});

// ── Delete a duplicate member record (admin only) ───────────────────────────
export const deleteDuplicateMember = mutation({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    if (!member) throw new Error("Member not found.");
    if (member.orgId) await requireAdmin(ctx, member.orgId);
    await ctx.db.delete(memberId);
    return { deleted: memberId, name: member.name, email: member.email };
  },
});

// ── Rename an organization (admin only) ─────────────────────────────────────
export const renameOrg = mutation({
  args: { orgId: v.id("organizations"), name: v.string() },
  handler: async (ctx, { orgId, name }) => {
    await requireAdmin(ctx, orgId);
    const org = await ctx.db.get(orgId);
    if (!org) throw new Error("Organization not found.");
    await ctx.db.patch(orgId, { name: name.trim() });
    return { orgId, name: name.trim() };
  },
});

// ── Backfill orgId on all existing records (admin only) ─────────────────────
//
// Run after creating your first organization:
//   npx convex run migrations:backfillOrgId '{"orgId":"<your-org-id>"}'
//
// Safe to run multiple times — only patches records with no orgId.
export const backfillOrgId = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireAdmin(ctx, orgId);

    // Verify the org exists
    const org = await ctx.db.get(orgId);
    if (!org) throw new Error("Organization not found.");

    const tables = [
      "members",
      "spaces",
      "projects",
      "tasks",
      "notifications",
      "settings",
      "templates",
      "bottlenecks",
      "activities",
    ] as const;

    const results: Record<string, number> = {};

    for (const table of tables) {
      let patched = 0;
      const records = await ctx.db.query(table).collect();
      for (const record of records) {
        if (!(record as any).orgId) {
          await ctx.db.patch(record._id, { orgId } as any);
          patched++;
        }
      }
      results[table] = patched;
    }

    return {
      orgId,
      message: "Backfill complete.",
      patched: results,
    };
  },
});
