import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

const now = () => Date.now();

export const listByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    const task = await ctx.db.get(taskId);
    if (!task) return [];
    if (task.orgId) await getCallerMember(ctx, task.orgId);
    return ctx.db
      .query("comments")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .order("asc")
      .take(200);
  },
});

export const addComment = mutation({
  args: {
    taskId:       v.id("tasks"),
    memberId:     v.id("members"),
    memberName:   v.string(),
    body:         v.string(),
    mentionedIds: v.optional(v.array(v.id("members"))),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    const commentId = await ctx.db.insert("comments", {
      taskId:       args.taskId,
      memberId:     args.memberId,
      memberName:   args.memberName,
      body:         args.body.trim(),
      mentionedIds: args.mentionedIds,
      createdAt:    now(),
    });

    // Log activity for the project timeline
    if (task.projectId) {
      await ctx.db.insert("activities", {
        orgId:       task.orgId,
        type:        "comment_added",
        taskId:      args.taskId,
        projectId:   task.projectId,
        memberId:    args.memberId,
        memberName:  args.memberName,
        description: `${args.memberName} commented on "${task.title}": ${args.body.trim().slice(0, 80)}`,
        createdAt:   now(),
      });
    }

    // Notify task owner about the new comment (unless they wrote it)
    const mentionSet = new Set(args.mentionedIds ?? []);
    if (task.memberId !== args.memberId && !mentionSet.has(task.memberId)) {
      await ctx.db.insert("notifications", {
        orgId:       task.orgId,
        type:        "task_comment",
        title:       "New Comment",
        message:     `${args.memberName} commented on "${task.title}": ${args.body.trim().slice(0, 100)}`,
        forRole:     "member",
        forMemberId: task.memberId,
        taskId:      args.taskId,
        read:        false,
        createdAt:   now(),
      });
    }

    // Notify @mentioned members
    if (args.mentionedIds && args.mentionedIds.length > 0) {
      for (const mentionedId of args.mentionedIds) {
        if (mentionedId === args.memberId) continue;
        const mentioned = await ctx.db.get(mentionedId);
        if (!mentioned) continue;
        await ctx.db.insert("notifications", {
          orgId:       task.orgId,
          type:        "task_mention",
          title:       `${args.memberName} mentioned you`,
          message:     `In "${task.title}": ${args.body.trim().slice(0, 120)}`,
          forRole:     mentioned.role,
          forMemberId: mentionedId,
          taskId:      args.taskId,
          read:        false,
          createdAt:   now(),
        });
      }
    }

    return commentId;
  },
});

export const inviteToTask = mutation({
  args: {
    taskId:        v.id("tasks"),
    invitedById:   v.id("members"),
    invitedByName: v.string(),
    memberId:      v.id("members"),
  },
  handler: async (ctx, args) => {
    const task    = await ctx.db.get(args.taskId);
    const invited = await ctx.db.get(args.memberId);
    if (!task || !invited) throw new Error("Not found");
    if (task.orgId) await getCallerMember(ctx, task.orgId);

    const existing = await ctx.db
      .query("taskAccess")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .filter((q) => q.eq(q.field("memberId"), args.memberId))
      .first();
    if (!existing) {
      await ctx.db.insert("taskAccess", {
        taskId:    args.taskId,
        memberId:  args.memberId,
        grantedAt: Date.now(),
      });
    }

    await ctx.db.insert("notifications", {
      orgId:       task.orgId,
      type:        "task_mention",
      title:       `${args.invitedByName} invited you to a task`,
      message:     `You've been invited to view "${task.title}".`,
      forRole:     invited.role,
      forMemberId: args.memberId,
      taskId:      args.taskId,
      read:        false,
      createdAt:   Date.now(),
    });
  },
});
