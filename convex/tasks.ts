import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdminOrManager, requireAdmin, getCallerMember, requireSameOrg, requirePermission } from "./helpers";

const now = () => Date.now();

// ── Queries ───────────────────────────────────────────────────────────────────

export const getById = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    return requireSameOrg(ctx, task, "Task");
  },
});

export const getTaskMeta = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    // Count subtasks without collecting entire arrays into memory
    let subtaskTotal = 0;
    let subtaskDone = 0;
    for await (const s of ctx.db
      .query("subtasks")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))) {
      subtaskTotal++;
      if (s.status === "completed") subtaskDone++;
    }
    let commentCount = 0;
    for await (const _ of ctx.db
      .query("comments")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))) {
      commentCount++;
    }
    return { subtaskTotal, subtaskDone, commentCount };
  },
});

export const listAllTasks = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) =>
    ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(500),
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) =>
    ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(500),
});

export const listAllTasksForViewer = query({
  args: {
    orgId:    v.id("organizations"),
    viewerId: v.id("members"),
  },
  handler: async (ctx, { orgId, viewerId }) => {
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    // Admins and managers see everything — cap at 500
    if (viewer.role === "admin" || viewer.role === "manager") {
      return ctx.db
        .query("tasks")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .take(500);
    }

    // For regular members, build access sets first, then collect
    // only the tasks they can actually see.
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const accessibleProjects = new Set(memberships.map((m) => m.projectId));

    const grants = await ctx.db
      .query("taskAccess")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const grantedTaskIds = new Set(grants.map((g) => g.taskId));

    // Stream through tasks and collect only visible ones, up to 500
    const result = [];
    for await (const t of ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")) {
      if (
        grantedTaskIds.has(t._id) ||
        t.memberId === viewerId ||
        ((!t.projectId || accessibleProjects.has(t.projectId)) &&
          (!t.visibility || t.visibility === "public"))
      ) {
        result.push(t);
      }
      if (result.length >= 500) break;
    }
    return result;
  },
});

export const listByProjectForViewer = query({
  args: {
    projectId: v.id("projects"),
    viewerId:  v.id("members"),
  },
  handler: async (ctx, { projectId, viewerId }) => {
    const viewer = await ctx.db.get(viewerId);
    if (!viewer) return [];

    // Admins/managers see all tasks in the project
    if (viewer.role === "admin" || viewer.role === "manager") {
      return ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .order("desc")
        .take(500);
    }

    const grants = await ctx.db
      .query("taskAccess")
      .withIndex("by_member", (q) => q.eq("memberId", viewerId))
      .collect();
    const grantedIds = new Set(grants.map((g) => g.taskId));

    const result = [];
    for await (const t of ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")) {
      if (
        t.memberId === viewerId ||
        grantedIds.has(t._id) ||
        !t.visibility ||
        t.visibility === "public"
      ) {
        result.push(t);
      }
      if (result.length >= 500) break;
    }
    return result;
  },
});

export const listTasksByMember = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) =>
    ctx.db
      .query("tasks")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .order("desc")
      .take(500),
});

export const listTasksByStatus = query({
  args: {
    orgId:  v.id("organizations"),
    status: v.string(),
  },
  handler: async (ctx, { orgId, status }) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_org_and_status", (q) => q.eq("orgId", orgId).eq("status", status))
      .order("desc")
      .take(500);
  },
});

export const listApprovalHistory = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    // Stream through tasks and pick only those with approval history, up to 200
    const result = [];
    for await (const t of ctx.db
      .query("tasks")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")) {
      if (t.approvedAt != null || t.rejectedAt != null) {
        result.push(t);
      }
      if (result.length >= 200) break;
    }
    return result;
  },
});

export const getActivities = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) =>
    ctx.db
      .query("activities")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(50),
});

// Only surface work-related activities: creating, completing, submitting,
// approving tasks, and commenting — things that move toward the goal.
const MEMBER_ACTIVITY_TYPES = new Set([
  "task_created",
  "task_moved",
  "task_submitted",
  "task_approved",
  "task_rejected",
  "comment_added",
  "project_created",
]);

export const getMemberActivities = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const result = [];
    for await (const a of ctx.db
      .query("activities")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .order("desc")) {
      if (MEMBER_ACTIVITY_TYPES.has(a.type)) result.push(a);
      if (result.length >= 100) break;
    }
    return result;
  },
});

export const getProjectActivities = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) =>
    ctx.db
      .query("activities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(100),
});

// ── Create task ───────────────────────────────────────────────────────────────

export const createTask = mutation({
  args: {
    orgId:          v.id("organizations"),
    projectId:      v.optional(v.id("projects")),
    title:          v.string(),
    description:    v.string(),
    memberId:       v.id("members"),
    memberName:     v.string(),
    priority:       v.optional(v.string()),
    tag:            v.optional(v.string()),
    dueDate:        v.optional(v.number()),
    submissionDate: v.number(),              // Due date is mandatory
    visibility:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      orgId:          args.orgId,
      projectId:      args.projectId,
      title:          args.title,
      description:    args.description,
      status:         "draft",
      visibility:     args.visibility ?? "public",
      memberId:       args.memberId,
      memberName:     args.memberName,
      priority:       args.priority ?? "medium",
      tag:            args.tag,
      dueDate:        args.dueDate,
      submissionDate: args.submissionDate,
      createdAt:      now(),
      updatedAt:      now(),
    });

    await ctx.db.insert("activities", {
      orgId:       args.orgId,
      type:        "task_created",
      taskId,
      projectId:   args.projectId,
      memberId:    args.memberId,
      memberName:  args.memberName,
      description: `${args.memberName} created task: "${args.title}"`,
      createdAt:   now(),
    });

    // Notify assignee if task is assigned to someone else
    const caller = await getCallerMember(ctx, args.orgId);
    if (args.memberId !== caller._id) {
      await ctx.db.insert("notifications", {
        orgId:       args.orgId,
        type:        "task_assigned",
        title:       "New Task Assigned",
        message:     `${caller.name} assigned you "${args.title}"`,
        forRole:     "member",
        forMemberId: args.memberId,
        taskId,
        read:        false,
        createdAt:   now(),
      });
    }

    return taskId;
  },
});

// ── Update task status ────────────────────────────────────────────────────────

const VALID_STATUSES = ["draft", "in_progress", "submitted", "completed"];

export const updateTaskStatus = mutation({
  args: { taskId: v.id("tasks"), status: v.string() },
  handler: async (ctx, { taskId, status }) => {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    const oldStatus = task.status;
    await ctx.db.patch(taskId, { status, updatedAt: now() });

    // Notify assignee when someone else changes their task status
    const caller = task.orgId ? await getCallerMember(ctx, task.orgId) : null;
    if (caller && caller._id !== task.memberId && oldStatus !== status) {
      await ctx.db.insert("notifications", {
        orgId:       task.orgId,
        type:        "task_status_changed",
        title:       "Task Status Updated",
        message:     `${caller.name} moved your task "${task.title}" from ${oldStatus} to ${status}`,
        forRole:     "member",
        forMemberId: task.memberId,
        taskId,
        read:        false,
        createdAt:   now(),
      });
    }

    await ctx.db.insert("activities", {
      orgId:       task.orgId,
      type:        "task_moved",
      taskId,
      projectId:   task.projectId,
      memberId:    task.memberId,
      memberName:  task.memberName,
      description: `${task.memberName} moved "${task.title}" → ${status}`,
      createdAt:   now(),
    });

    const bottlenecks = await ctx.db
      .query("bottlenecks")
      .withIndex("by_task", (q) => q.eq("taskId", taskId))
      .collect();
    for (const b of bottlenecks) {
      if (!b.resolvedAt) {
        await ctx.db.patch(b._id, { resolvedAt: now() });
      }
    }

    return taskId;
  },
});

// ── Submit task for approval ──────────────────────────────────────────────────

export const submitTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(taskId, {
      status:      "submitted",
      submittedAt: now(),
      updatedAt:   now(),
    });

    await ctx.db.insert("notifications", {
      orgId:     task.orgId,
      type:      "task_submitted",
      title:     "New Submission",
      message:   `${task.memberName} submitted "${task.title}" for review`,
      forRole:   "admin",
      taskId,
      read:      false,
      createdAt: now(),
    });

    await ctx.db.insert("activities", {
      orgId:       task.orgId,
      type:        "task_submitted",
      taskId,
      projectId:   task.projectId,
      memberId:    task.memberId,
      memberName:  task.memberName,
      description: `${task.memberName} submitted "${task.title}" for approval`,
      createdAt:   now(),
    });

    return taskId;
  },
});

// ── Approve task ──────────────────────────────────────────────────────────────

export const approveTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.orgId) throw new Error("Task has no organization");
    await requirePermission(ctx, task.orgId, "task.approve");

    await ctx.db.patch(taskId, {
      status:     "completed",
      approvedAt: now(),
      updatedAt:  now(),
    });

    await ctx.db.insert("notifications", {
      orgId:       task.orgId,
      type:        "task_approved",
      title:       "Task Approved",
      message:     `Your task "${task.title}" was approved!`,
      forRole:     "member",
      forMemberId: task.memberId,
      taskId,
      read:        false,
      createdAt:   now(),
    });

    await ctx.db.insert("activities", {
      orgId:       task.orgId,
      type:        "task_approved",
      taskId,
      projectId:   task.projectId,
      memberId:    task.memberId,
      memberName:  task.memberName,
      description: `Admin approved "${task.title}" by ${task.memberName}`,
      createdAt:   now(),
    });

    // ── Streak: increment if completed before deadline ───────────────────────
    if (task.submissionDate && now() <= task.submissionDate) {
      await ctx.runMutation(internal.streaks.increment, {
        orgId:    task.orgId!,
        memberId: task.memberId,
      });
    }

    return taskId;
  },
});

// ── Reject task ───────────────────────────────────────────────────────────────

export const rejectTask = mutation({
  args: {
    taskId: v.id("tasks"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { taskId, reason }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.orgId) throw new Error("Task has no organization");
    await requirePermission(ctx, task.orgId, "task.approve");

    await ctx.db.patch(taskId, {
      status:          "in_progress",
      rejectedAt:      now(),
      rejectionReason: reason,
      updatedAt:       now(),
    });

    await ctx.db.insert("notifications", {
      orgId:       task.orgId,
      type:        "task_rejected",
      title:       "Task Needs Revision",
      message:     `Your task "${task.title}" was sent back${reason ? `: ${reason}` : "."}`,
      forRole:     "member",
      forMemberId: task.memberId,
      taskId,
      read:        false,
      createdAt:   now(),
    });

    await ctx.db.insert("activities", {
      orgId:       task.orgId,
      type:        "task_rejected",
      taskId,
      projectId:   task.projectId,
      memberId:    task.memberId,
      memberName:  task.memberName,
      description: `Admin sent back "${task.title}" by ${task.memberName} — moved to In Progress`,
      createdAt:   now(),
    });

    return taskId;
  },
});

// ── Update task details ───────────────────────────────────────────────────────

export const updateTask = mutation({
  args: {
    taskId:         v.id("tasks"),
    title:          v.optional(v.string()),
    description:    v.optional(v.string()),
    priority:       v.optional(v.string()),
    tag:            v.optional(v.string()),
    dueDate:        v.optional(v.number()),
    submissionDate: v.optional(v.number()),
    projectId:      v.optional(v.id("projects")),
    memberId:       v.optional(v.id("members")),
    memberName:     v.optional(v.string()),
  },
  handler: async (ctx, { taskId, memberId, memberName, submissionDate, ...updates }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");

    // Due date (submissionDate) is locked once set — cannot be changed.
    // Compare at day-level to avoid false rejections from timestamp rounding.
    const sameDay = (a: number, b: number) =>
      new Date(a).toISOString().split("T")[0] === new Date(b).toISOString().split("T")[0];
    if (submissionDate !== undefined && task.submissionDate && !sameDay(submissionDate, task.submissionDate)) {
      throw new Error("Due date cannot be changed once set.");
    }

    await ctx.db.patch(taskId, { ...updates, ...(memberId ? { memberId } : {}), ...(memberName ? { memberName } : {}), updatedAt: now() });

    if (memberId && memberId !== task.memberId) {
      await ctx.db.insert("notifications", {
        orgId:       task.orgId,
        type:        "task_assigned",
        title:       "Task Assigned",
        message:     `You were assigned: "${task.title}"`,
        forRole:     "member",
        forMemberId: memberId,
        taskId,
        read:        false,
        createdAt:   now(),
      });
    }

    return taskId;
  },
});

// ── Bulk approve ─────────────────────────────────────────────────────────────

export const approveAllSubmitted = mutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requirePermission(ctx, orgId, "task.approve");
    // Use the status index directly instead of fetching all tasks
    const submitted = await ctx.db
      .query("tasks")
      .withIndex("by_org_and_status", (q) => q.eq("orgId", orgId).eq("status", "submitted"))
      .take(100);

    for (const task of submitted) {
      await ctx.db.patch(task._id, {
        status:     "completed",
        approvedAt: now(),
        updatedAt:  now(),
      });
      await ctx.db.insert("notifications", {
        orgId,
        type:        "task_approved",
        title:       "Task Approved",
        message:     `Your task "${task.title}" was approved!`,
        forRole:     "member",
        forMemberId: task.memberId,
        taskId:      task._id,
        read:        false,
        createdAt:   now(),
      });

      // ── Streak: increment if completed before deadline ─────────────────
      if (task.submissionDate && now() <= task.submissionDate) {
        await ctx.runMutation(internal.streaks.increment, {
          orgId,
          memberId: task.memberId,
        });
      }
    }
    return submitted.length;
  },
});

// ── Delete task ───────────────────────────────────────────────────────────────

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) throw new Error("Task not found");
    if (!task.orgId) throw new Error("Task has no organization");

    await requirePermission(ctx, task.orgId, "task.delete");

    await ctx.db.delete(taskId);
    return taskId;
  },
});
