import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCallerMember } from "./helpers";

export const listByMember = query({
  args: { memberId: v.id("members") },
  handler: async (ctx, { memberId }) => {
    const member = await ctx.db.get(memberId);
    if (!member) return [];
    if (member.orgId) await getCallerMember(ctx, member.orgId);
    return ctx.db
      .query("templates")
      .withIndex("by_member", (q) => q.eq("memberId", memberId))
      .order("desc")
      .take(20);
  },
});

export const saveTemplate = mutation({
  args: {
    orgId:       v.id("organizations"),
    memberId:    v.id("members"),
    memberName:  v.string(),
    title:       v.string(),
    description: v.string(),
    priority:    v.optional(v.string()),
    tag:         v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getCallerMember(ctx, args.orgId);
    return ctx.db.insert("templates", {
      orgId:       args.orgId,
      memberId:    args.memberId,
      memberName:  args.memberName,
      title:       args.title,
      description: args.description,
      priority:    args.priority,
      tag:         args.tag,
      createdAt:   Date.now(),
    });
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, { templateId }) => {
    const template = await ctx.db.get(templateId);
    if (!template) throw new Error("Template not found");
    if (template.orgId) await getCallerMember(ctx, template.orgId);
    await ctx.db.delete(templateId);
  },
});
