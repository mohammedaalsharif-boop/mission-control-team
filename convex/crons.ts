import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ── Saudi time helpers ────────────────────────────────────────────────────────
const SAUDI_OFFSET_MS = 3 * 60 * 60 * 1000;

function getWeekBoundsUTC(): { startUTC: number; endUTC: number } {
  const nowUTC   = Date.now();
  const nowAST   = nowUTC + SAUDI_OFFSET_MS;
  const asDate   = new Date(nowAST);
  const dayOfWeek = asDate.getUTCDay();

  // Start of week (Sunday 00:00 AST)
  const startAST = new Date(nowAST);
  startAST.setUTCDate(startAST.getUTCDate() - dayOfWeek);
  startAST.setUTCHours(0, 0, 0, 0);

  // End of week (Saturday 23:59:59 AST — full 7-day week)
  const endAST = new Date(startAST);
  endAST.setUTCDate(startAST.getUTCDate() + 6);
  endAST.setUTCHours(23, 59, 59, 999);

  return {
    startUTC: startAST.getTime() - SAUDI_OFFSET_MS,
    endUTC:   endAST.getTime()   - SAUDI_OFFSET_MS,
  };
}

const ts = () => Date.now();

// ── Thursday 6:00 PM digest — runs per org ──────────────────────────────────
export const sendThursdayDigest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { startUTC, endUTC } = getWeekBoundsUTC();

    const orgs = await ctx.db.query("organizations").take(200);
    let totalCompleted = 0;

    for (const org of orgs) {
      const members = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      // Query tasks scoped to this org, then filter by approvedAt in range
      const orgTasks = await ctx.db
        .query("tasks")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      const orgCompleted = orgTasks.filter(
        (t) => t.approvedAt && t.approvedAt >= startUTC && t.approvedAt <= endUTC
      );
      totalCompleted += orgCompleted.length;

      for (const member of members) {
        const mine = orgCompleted.filter((t) => t.memberId === member._id);

        let title: string;
        let message: string;

        if (mine.length === 0) {
          title   = "Week Recap — No tasks completed";
          message = "You didn't complete any tasks this week. Plan ahead for next week!";
        } else {
          const listed = mine
            .slice(0, 5)
            .map((t) => `• ${t.title}`)
            .join("\n");
          const extra  = mine.length > 5 ? `\n+${mine.length - 5} more` : "";
          title   = `Week Recap — ${mine.length} task${mine.length !== 1 ? "s" : ""} completed ✓`;
          message = listed + extra;
        }

        await ctx.db.insert("notifications", {
          orgId:       org._id,
          type:        "weekly_digest_thursday",
          title,
          message,
          forRole:     member.role,
          forMemberId: member._id,
          read:        false,
          createdAt:   ts(),
        });
      }

      // Admin team summary
      const memberCount = members.filter((m) => m.role !== "admin").length;
      await ctx.db.insert("notifications", {
        orgId:     org._id,
        type:      "weekly_digest_thursday",
        title:     "Team Week Recap",
        message:   `The team completed ${orgCompleted.length} task${orgCompleted.length !== 1 ? "s" : ""} this week across ${memberCount} member${memberCount !== 1 ? "s" : ""}.`,
        forRole:   "admin",
        read:      false,
        createdAt: ts(),
      });
    }

    return totalCompleted;
  },
});

// ── Sunday 9:00 AM digest — runs per org ────────────────────────────────────
export const sendSundayDigest = internalMutation({
  args: {},
  handler: async (ctx) => {
    const { startUTC, endUTC } = getWeekBoundsUTC();

    const orgs = await ctx.db.query("organizations").take(200);
    let totalDue = 0;

    for (const org of orgs) {
      const members = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      // Query tasks scoped to this org, then filter by due date in range
      const orgTasks = await ctx.db
        .query("tasks")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .collect();

      const dueThisWeek = orgTasks.filter(
        (t) =>
          t.submissionDate &&
          t.submissionDate >= startUTC &&
          t.submissionDate <= endUTC &&
          t.status !== "completed" &&
          t.status !== "submitted"
      );
      totalDue += dueThisWeek.length;

      for (const member of members.filter((m) => m.role !== "admin")) {
        const mine = dueThisWeek.filter((t) => t.memberId === member._id);

        let title: string;
        let message: string;

        if (mine.length === 0) {
          title   = "This Week — Nothing due";
          message = "No tasks are due this week. A great time to get ahead on next week's work!";
        } else {
          const listed = mine
            .slice(0, 5)
            .map((t) => {
              const due = t.submissionDate
                ? new Date(t.submissionDate + SAUDI_OFFSET_MS).toLocaleDateString("en-US", {
                    weekday: "short",
                    month:   "short",
                    day:     "numeric",
                  })
                : "";
              return `• ${t.title}${due ? ` (${due})` : ""}`;
            })
            .join("\n");
          const extra = mine.length > 5 ? `\n+${mine.length - 5} more` : "";
          title   = `This Week — ${mine.length} task${mine.length !== 1 ? "s" : ""} due`;
          message = listed + extra;
        }

        await ctx.db.insert("notifications", {
          orgId:       org._id,
          type:        "weekly_digest_sunday",
          title,
          message,
          forRole:     "member",
          forMemberId: member._id,
          read:        false,
          createdAt:   ts(),
        });
      }

      const memberCount = members.filter((m) => m.role !== "admin").length;
      await ctx.db.insert("notifications", {
        orgId:     org._id,
        type:      "weekly_digest_sunday",
        title:     "Team This Week",
        message:   `The team has ${dueThisWeek.length} task${dueThisWeek.length !== 1 ? "s" : ""} due this week across ${memberCount} member${memberCount !== 1 ? "s" : ""}.`,
        forRole:   "admin",
        read:      false,
        createdAt: ts(),
      });
    }

    return totalDue;
  },
});

// ── Due-soon (24h warning) notifications ────────────────────────────────────

export const checkDueSoon = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").take(100);
    const now = Date.now();
    const in24h = now + 24 * 60 * 60 * 1000;

    for (const org of orgs) {
      const members = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(500);

      for (const member of members) {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .take(500);

        const dueSoon = tasks.filter(
          (t) =>
            t.submissionDate &&
            t.submissionDate > now &&
            t.submissionDate <= in24h &&
            t.status !== "completed" &&
            t.status !== "submitted"
        );

        if (dueSoon.length > 0) {
          const taskNames = dueSoon.slice(0, 3).map((t) => t.title).join(", ");
          const extra = dueSoon.length > 3 ? ` +${dueSoon.length - 3} more` : "";
          await ctx.db.insert("notifications", {
            orgId:       org._id,
            type:        "task_due_soon",
            title:       "Tasks Due Soon",
            message:     `${dueSoon.length} task(s) due in the next 24 hours: ${taskNames}${extra}`,
            forRole:     member.role,
            forMemberId: member._id,
            read:        false,
            createdAt:   now,
          });
        }
      }
    }
  },
});

// ── Check overdue tasks & reset streaks ──────────────────────────────────────

export const checkOverdueTasks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db.query("organizations").take(100);
    const ts = Date.now();

    for (const org of orgs) {
      const members = await ctx.db
        .query("members")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .take(500);

      for (const member of members) {
        // Find tasks assigned to this member that are overdue and not completed
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_member", (q) => q.eq("memberId", member._id))
          .take(500);

        const newlyOverdue = tasks.filter(
          (t) =>
            t.submissionDate &&
            t.submissionDate < ts &&
            t.status !== "completed" &&
            t.status !== "submitted" &&
            // Only trigger on tasks that just became overdue (within the last hour)
            t.submissionDate > ts - 60 * 60 * 1000
        );

        if (newlyOverdue.length > 0) {
          // Reset this member's streak
          await ctx.runMutation(internal.streaks.reset, {
            orgId:    org._id,
            memberId: member._id,
          });

          // Send streak broken notification
          const taskNames = newlyOverdue.map((t) => t.title).join(", ");
          await ctx.db.insert("notifications", {
            orgId:       org._id,
            type:        "streak_broken",
            title:       "Streak Lost",
            message:     `Your streak was reset — deadline passed for: ${taskNames}`,
            forRole:     member.role,
            forMemberId: member._id,
            read:        false,
            createdAt:   ts,
          });

          // Send overdue notification to the member
          await ctx.db.insert("notifications", {
            orgId:       org._id,
            type:        "task_overdue",
            title:       "Tasks Overdue",
            message:     `${newlyOverdue.length} task(s) are now overdue: ${taskNames}`,
            forRole:     member.role,
            forMemberId: member._id,
            read:        false,
            createdAt:   ts,
          });

          // Also notify admin/managers about the overdue tasks
          const admins = await ctx.db
            .query("members")
            .withIndex("by_org", (q) => q.eq("orgId", org._id))
            .take(100);
          for (const admin of admins.filter((m) => m.role === "admin" || m.role === "manager")) {
            await ctx.db.insert("notifications", {
              orgId:       org._id,
              type:        "task_overdue",
              title:       "Team Member Overdue",
              message:     `${member.name} has ${newlyOverdue.length} overdue task(s): ${taskNames}`,
              forRole:     admin.role,
              forMemberId: admin._id,
              read:        false,
              createdAt:   ts,
            });
          }
        }
      }
    }
  },
});

// ── Cron schedule ─────────────────────────────────────────────────────────────
const crons = cronJobs();

crons.cron(
  "thursday-completed-digest",
  "0 15 * * 4",
  internal.crons.sendThursdayDigest,
  {}
);

crons.cron(
  "sunday-upcoming-digest",
  "0 6 * * 0",
  internal.crons.sendSundayDigest,
  {}
);

// Spawn recurring tasks every hour
crons.interval(
  "spawn-recurring-tasks",
  { hours: 1 },
  internal.recurring.spawnDueRecurring,
  {}
);

// Check for overdue tasks and reset streaks every hour
crons.interval(
  "check-overdue-streak-reset",
  { hours: 1 },
  internal.crons.checkOverdueTasks,
  {}
);

// Check for tasks due within 24 hours — runs once daily at 7:00 AM AST (4:00 AM UTC)
crons.cron(
  "due-soon-daily-check",
  "0 4 * * *",
  internal.crons.checkDueSoon,
  {}
);

export default crons;
