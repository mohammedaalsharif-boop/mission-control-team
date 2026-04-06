import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

// ── Row shape coming from the client-side xlsx parser ────────────────────────
const rowValidator = v.object({
  type:        v.string(),           // "task" | "subtask"
  title:       v.string(),
  description: v.optional(v.string()),
  parentTask:  v.optional(v.string()), // title of parent (subtasks only)
  assignee:    v.optional(v.string()), // member name
  priority:    v.optional(v.string()), // "high" | "medium" | "low"
  tag:         v.optional(v.string()),
  dueDate:     v.optional(v.string()), // "YYYY-MM-DD"
});

// ── Bulk import tasks + subtasks into a project ─────────────────────────────
export const importTasks = mutation({
  args: {
    orgId:     v.id("organizations"),
    projectId: v.id("projects"),
    rows:      v.array(rowValidator),
  },
  handler: async (ctx, { orgId, projectId, rows }) => {
    const caller = await getCallerMember(ctx, orgId);
    const isAdminOrManager = caller.role === "admin" || caller.role === "manager";

    // Verify project belongs to this org
    const project = await ctx.db.get(projectId);
    if (!project || project.orgId !== orgId) {
      throw new Error("Project not found in this organization.");
    }

    // Build a member lookup by name (case-insensitive)
    const members = await ctx.db
      .query("members")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(500);
    const memberByName: Record<string, { _id: any; name: string }> = {};
    for (const m of members) {
      memberByName[m.name.toLowerCase()] = m;
    }

    // ── Pass 1: Create tasks ────────────────────────────────────────────
    const taskRows = rows.filter((r) => r.type === "task");
    const taskIdByTitle: Record<string, any> = {};
    const errors: string[] = [];
    let tasksCreated = 0;
    let subtasksCreated = 0;

    for (const row of taskRows) {
      if (!row.title?.trim()) {
        errors.push("Skipped a task row with no title.");
        continue;
      }

      // Resolve assignee
      let memberId = caller._id;
      let memberName = caller.name;
      if (row.assignee?.trim()) {
        const match = memberByName[row.assignee.trim().toLowerCase()];
        if (match) {
          // Regular members can only assign to themselves
          if (!isAdminOrManager && match._id !== caller._id) {
            errors.push(`You can only assign tasks to yourself — reassigned "${row.title}" to you.`);
          } else {
            memberId = match._id;
            memberName = match.name;
          }
        } else {
          errors.push(`Assignee "${row.assignee}" not found — assigned "${row.title}" to you.`);
        }
      }

      // Parse due date
      let dueDate: number | undefined;
      if (row.dueDate?.trim()) {
        const parsed = Date.parse(row.dueDate.trim());
        if (!isNaN(parsed)) {
          dueDate = parsed;
        } else {
          errors.push(`Invalid date "${row.dueDate}" on task "${row.title}" — skipping due date.`);
        }
      }

      const validPriorities = ["high", "medium", "low"];
      const priority = row.priority && validPriorities.includes(row.priority.toLowerCase())
        ? row.priority.toLowerCase()
        : undefined;

      const taskId = await ctx.db.insert("tasks", {
        orgId,
        projectId,
        title:       row.title.trim(),
        description: row.description?.trim() || "",
        status:      "to_do",
        memberId,
        memberName,
        priority,
        tag:         row.tag?.trim() || undefined,
        dueDate,
        createdAt:   now(),
        updatedAt:   now(),
      });

      taskIdByTitle[row.title.trim().toLowerCase()] = taskId;
      tasksCreated++;
    }

    // ── Pass 2: Create subtasks ─────────────────────────────────────────
    const subtaskRows = rows.filter((r) => r.type === "subtask");
    for (const row of subtaskRows) {
      if (!row.title?.trim()) {
        errors.push("Skipped a subtask row with no title.");
        continue;
      }
      if (!row.parentTask?.trim()) {
        errors.push(`Subtask "${row.title}" has no Parent Task — skipped.`);
        continue;
      }

      const parentId = taskIdByTitle[row.parentTask.trim().toLowerCase()];
      if (!parentId) {
        errors.push(`Subtask "${row.title}" references parent "${row.parentTask}" which was not found — skipped.`);
        continue;
      }

      // Resolve assignee for subtask
      let assigneeId: any = undefined;
      if (row.assignee?.trim()) {
        const match = memberByName[row.assignee.trim().toLowerCase()];
        if (match) {
          // Regular members can only assign to themselves
          if (!isAdminOrManager && match._id !== caller._id) {
            errors.push(`You can only assign subtasks to yourself — reassigned "${row.title}" to you.`);
            assigneeId = caller._id;
          } else {
            assigneeId = match._id;
          }
        }
      }

      let dueDate: number | undefined;
      if (row.dueDate?.trim()) {
        const parsed = Date.parse(row.dueDate.trim());
        if (!isNaN(parsed)) dueDate = parsed;
      }

      await ctx.db.insert("subtasks", {
        taskId:     parentId,
        title:      row.title.trim(),
        status:     "to_do",
        assigneeId,
        dueDate,
        createdBy:  caller._id,
        createdAt:  now(),
        updatedAt:  now(),
      });
      subtasksCreated++;
    }

    // ── Activity log ────────────────────────────────────────────────────
    await ctx.db.insert("activities", {
      orgId,
      type:        "bulk_import",
      projectId,
      memberId:    caller._id,
      memberName:  caller.name,
      description: `Bulk imported ${tasksCreated} task(s) and ${subtasksCreated} subtask(s) into ${project.name}`,
      createdAt:   now(),
    });

    return { tasksCreated, subtasksCreated, errors };
  },
});
