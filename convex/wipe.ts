/**
 * One-time wipe mutation: deletes ALL subtasks, tasks, projects, spaces,
 * and related data (comments, dependencies, bottlenecks, activities,
 * projectMembers, taskAccess, notifications, streaks, templates, customFieldValues)
 * for a given organization.
 *
 * Must be called by an admin. Run repeatedly until it returns { done: true }
 * since Convex mutations have a max-writes limit per transaction.
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./helpers";

const BATCH = 200; // safe batch size per transaction

export const wipeOrg = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireAdmin(ctx, orgId);

    let deleted = 0;

    // Helper: delete up to BATCH rows from a table that match a filter
    const wipeBatch = async (table: string) => {
      const rows = await (ctx.db as any).query(table).collect();
      // Filter to this org where possible, else delete all
      const orgRows = rows.filter((r: any) => {
        if (r.orgId !== undefined) return r.orgId === orgId;
        return true; // tables without orgId (subtasks, comments, etc) — we delete via join below
      });
      const batch = orgRows.slice(0, BATCH - deleted);
      for (const row of batch) {
        await ctx.db.delete(row._id);
        deleted++;
        if (deleted >= BATCH) break;
      }
    };

    // Delete child-level tables first (order matters for referential sanity)

    // 1. Subtasks — no orgId, join via tasks
    if (deleted < BATCH) {
      const allSubtasks = await ctx.db.query("subtasks").collect();
      const orgTasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      const taskIds = new Set(orgTasks.map((t) => t._id));
      for (const st of allSubtasks) {
        if (deleted >= BATCH) break;
        if (taskIds.has(st.taskId)) {
          await ctx.db.delete(st._id);
          deleted++;
        }
      }
    }

    // 2. Comments — no orgId, join via tasks
    if (deleted < BATCH) {
      const allComments = await ctx.db.query("comments").collect();
      const orgTasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      const taskIds = new Set(orgTasks.map((t) => t._id));
      for (const c of allComments) {
        if (deleted >= BATCH) break;
        if (taskIds.has(c.taskId)) {
          await ctx.db.delete(c._id);
          deleted++;
        }
      }
    }

    // 3. Task access, task dependencies, bottlenecks
    if (deleted < BATCH) {
      const deps = await ctx.db.query("taskDependencies").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      for (const d of deps.slice(0, BATCH - deleted)) {
        await ctx.db.delete(d._id);
        deleted++;
      }
    }
    if (deleted < BATCH) {
      const bns = await ctx.db.query("bottlenecks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      for (const b of bns.slice(0, BATCH - deleted)) {
        await ctx.db.delete(b._id);
        deleted++;
      }
    }
    if (deleted < BATCH) {
      const allAccess = await ctx.db.query("taskAccess").collect();
      const orgTasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      const taskIds = new Set(orgTasks.map((t) => t._id));
      for (const a of allAccess) {
        if (deleted >= BATCH) break;
        if (taskIds.has(a.taskId)) {
          await ctx.db.delete(a._id);
          deleted++;
        }
      }
    }

    // 4. Custom field values — join via tasks
    if (deleted < BATCH) {
      const allCfv = await ctx.db.query("customFieldValues").collect();
      const orgTasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      const taskIds = new Set(orgTasks.map((t) => t._id));
      for (const cfv of allCfv) {
        if (deleted >= BATCH) break;
        if (taskIds.has(cfv.taskId)) {
          await ctx.db.delete(cfv._id);
          deleted++;
        }
      }
    }

    // 5. Tasks
    if (deleted < BATCH) {
      const tasks = await ctx.db.query("tasks").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      for (const t of tasks.slice(0, BATCH - deleted)) {
        await ctx.db.delete(t._id);
        deleted++;
      }
    }

    // 6. Project members — join via projects
    if (deleted < BATCH) {
      const orgProjects = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      const projectIds = new Set(orgProjects.map((p) => p._id));
      const allPm = await ctx.db.query("projectMembers").collect();
      for (const pm of allPm) {
        if (deleted >= BATCH) break;
        if (projectIds.has(pm.projectId)) {
          await ctx.db.delete(pm._id);
          deleted++;
        }
      }
    }

    // 7. Projects
    if (deleted < BATCH) {
      const projects = await ctx.db.query("projects").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      for (const p of projects.slice(0, BATCH - deleted)) {
        await ctx.db.delete(p._id);
        deleted++;
      }
    }

    // 8. Spaces
    if (deleted < BATCH) {
      const spaces = await ctx.db.query("spaces").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      for (const s of spaces.slice(0, BATCH - deleted)) {
        await ctx.db.delete(s._id);
        deleted++;
      }
    }

    // 9. Activities, notifications, streaks, templates, goals, goalProjects, automations, customFieldDefs, roles, weekly reflections
    const orgTables = [
      "activities", "notifications", "streaks", "templates",
      "goals", "automations", "customFieldDefs", "roles", "weeklyReflections",
    ];
    for (const table of orgTables) {
      if (deleted >= BATCH) break;
      const rows = await (ctx.db as any).query(table).withIndex("by_org", (q: any) => q.eq("orgId", orgId)).collect();
      for (const r of rows.slice(0, BATCH - deleted)) {
        await ctx.db.delete(r._id);
        deleted++;
      }
    }

    // 10. Goal-project links (join via goals)
    if (deleted < BATCH) {
      const orgGoals = await ctx.db.query("goals").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect();
      if (orgGoals.length > 0) {
        const goalIds = new Set(orgGoals.map((g) => g._id));
        const allGp = await ctx.db.query("goalProjects").collect();
        for (const gp of allGp) {
          if (deleted >= BATCH) break;
          if (goalIds.has(gp.goalId)) {
            await ctx.db.delete(gp._id);
            deleted++;
          }
        }
      }
    }

    // 11. Settings
    if (deleted < BATCH) {
      const settings = await ctx.db.query("settings").withIndex("by_org_and_key", (q) => q.eq("orgId", orgId)).collect();
      for (const s of settings.slice(0, BATCH - deleted)) {
        await ctx.db.delete(s._id);
        deleted++;
      }
    }

    return { deleted, done: deleted === 0 };
  },
});
