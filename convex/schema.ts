import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // ── Organizations (tenants) ──────────────────────────────────────────────────
  organizations: defineTable({
    name:      v.string(),
    slug:      v.string(),             // URL-friendly identifier
    plan:      v.optional(v.string()), // "free" | "pro" | "enterprise"
    createdBy: v.string(),             // email of the creator
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"]),

  // ── Team members (scoped to an org) ──────────────────────────────────────────
  members: defineTable({
    orgId:     v.optional(v.id("organizations")),
    name:      v.string(),
    email:     v.string(),
    role:      v.string(),       // "admin" | "manager" | "member"
    createdAt: v.number(),
  })
    .index("by_email",         ["email"])
    .index("by_role",          ["role"])
    .index("by_org",           ["orgId"])
    .index("by_org_and_email", ["orgId", "email"]),

  // ── Team invites (pending invitations sent via email) ──────────────────────────
  invites: defineTable({
    orgId:     v.id("organizations"),
    email:     v.string(),
    name:      v.string(),
    role:      v.string(),           // "manager" | "member"
    token:     v.string(),           // unique invite token for the link
    status:    v.string(),           // "pending" | "accepted" | "expired"
    invitedBy: v.id("members"),      // admin who sent the invite
    expiresAt: v.number(),           // expiry timestamp
    createdAt: v.number(),
  })
    .index("by_org",       ["orgId"])
    .index("by_email",     ["email"])
    .index("by_token",     ["token"])
    .index("by_org_and_email", ["orgId", "email"]),

  // ── Spaces (top-level areas of the workspace) ─────────────────────────────────
  // e.g. "Operations", "Maintenance", "Marketing"
  spaces: defineTable({
    orgId:       v.optional(v.id("organizations")),
    name:        v.string(),
    description: v.optional(v.string()),
    color:       v.optional(v.string()),      // hex color, e.g. "#6366f1"
    icon:        v.optional(v.string()),      // emoji or letter
    isPrivate:   v.optional(v.boolean()),     // only invited members can see
    permission:  v.optional(v.string()),      // "full_edit" | "comment" | "view"
    createdBy:   v.id("members"),
    createdAt:   v.number(),
    archivedAt:  v.optional(v.number()),
  })
    .index("by_org", ["orgId"]),

  // ── Projects (belongs to one Space) ──────────────────────────────────────────
  projects: defineTable({
    orgId:       v.optional(v.id("organizations")),
    spaceId:     v.id("spaces"),
    name:        v.string(),
    description: v.optional(v.string()),
    northStar:   v.optional(v.string()),      // core objective in one sentence
    status:      v.string(),                  // "active" | "on_hold" | "completed" | "archived"
    priority:    v.optional(v.string()),       // "high" | "medium" | "low"
    ownerId:     v.optional(v.id("members")), // project lead (accountable)
    supporterId: v.optional(v.id("members")), // secondary supporter
    startDate:               v.optional(v.number()),
    dueDate:                 v.optional(v.number()),
    estimatedCompletionDate: v.optional(v.number()),
    createdBy:               v.id("members"),
    createdAt:   v.number(),
    updatedAt:   v.number(),
  })
    .index("by_space",  ["spaceId"])
    .index("by_status", ["status"])
    .index("by_org",    ["orgId"]),

  // ── Project members (access control — who can see a project) ─────────────────
  projectMembers: defineTable({
    projectId: v.id("projects"),
    memberId:  v.id("members"),
    addedAt:   v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_member",  ["memberId"]),

  // ── Tasks (belongs to one Project) ───────────────────────────────────────────
  tasks: defineTable({
    orgId:           v.optional(v.id("organizations")),
    projectId:       v.optional(v.id("projects")),
    title:           v.string(),
    description:     v.string(),
    status:          v.string(), // to_do | in_progress | submitted | approved | completed
    visibility:      v.optional(v.string()), // "public" | "private"
    memberId:        v.id("members"),
    memberName:      v.string(),
    priority:        v.optional(v.string()),
    tag:             v.optional(v.string()),
    dueDate:         v.optional(v.number()),
    submissionDate:  v.optional(v.number()),
    submittedAt:     v.optional(v.number()),
    approvedAt:      v.optional(v.number()),
    rejectedAt:      v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    // ── Recurrence ──
    isRecurring:       v.optional(v.boolean()),
    recurrenceRule:    v.optional(v.string()),   // "daily" | "weekly" | "biweekly" | "monthly" | "custom"
    recurrenceInterval: v.optional(v.number()),  // e.g. every N days (for custom)
    recurrenceDays:    v.optional(v.array(v.number())), // day-of-week for weekly (0=Sun..6=Sat)
    nextRecurrenceAt:  v.optional(v.number()),   // timestamp of next auto-creation
    parentRecurringId: v.optional(v.id("tasks")),// points back to the recurring "template" task
    createdAt:       v.number(),
    updatedAt:       v.number(),
  })
    .index("by_project",        ["projectId"])
    .index("by_member",         ["memberId"])
    .index("by_status",         ["status"])
    .index("by_created",        ["createdAt"])
    .index("by_approvedAt",     ["approvedAt"])
    .index("by_submissionDate", ["submissionDate"])
    .index("by_org",            ["orgId"])
    .index("by_org_and_status", ["orgId", "status"]),

  // ── Subtasks (belongs to one Task, one level deep) ───────────────────────────
  subtasks: defineTable({
    taskId:      v.id("tasks"),
    title:       v.string(),
    status:      v.string(),                  // "to_do" | "in_progress" | "completed"
    assigneeId:  v.optional(v.id("members")),
    dueDate:     v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdBy:   v.id("members"),
    createdAt:   v.number(),
    updatedAt:   v.number(),
  })
    .index("by_task",     ["taskId"])
    .index("by_assignee", ["assigneeId"]),

  // ── In-app notifications ──────────────────────────────────────────────────────
  notifications: defineTable({
    orgId:       v.optional(v.id("organizations")),
    type:        v.string(),
    title:       v.string(),
    message:     v.string(),
    forRole:     v.string(),                  // "admin" | "member"
    forMemberId: v.optional(v.id("members")),
    taskId:      v.optional(v.id("tasks")),
    read:        v.boolean(),
    createdAt:   v.number(),
  })
    .index("by_member",  ["forMemberId"])
    .index("by_role",    ["forRole"])
    .index("by_read",    ["read"])
    .index("by_created", ["createdAt"])
    .index("by_org",     ["orgId"]),

  // ── Settings (scoped to an org) ───────────────────────────────────────────────
  settings: defineTable({
    orgId:     v.optional(v.id("organizations")),
    key:       v.string(),
    value:     v.string(),
    updatedAt: v.number(),
  })
    .index("by_key",         ["key"])
    .index("by_org_and_key", ["orgId", "key"]),

  // ── Task access (private task grants) ────────────────────────────────────────
  taskAccess: defineTable({
    taskId:    v.id("tasks"),
    memberId:  v.id("members"),
    grantedAt: v.number(),
  })
    .index("by_task",   ["taskId"])
    .index("by_member", ["memberId"]),

  // ── Task templates ────────────────────────────────────────────────────────────
  templates: defineTable({
    orgId:       v.optional(v.id("organizations")),
    memberId:    v.id("members"),
    memberName:  v.string(),
    title:       v.string(),
    description: v.string(),
    priority:    v.optional(v.string()),
    tag:         v.optional(v.string()),
    createdAt:   v.number(),
  })
    .index("by_member", ["memberId"])
    .index("by_org",    ["orgId"]),

  // ── Task comments ─────────────────────────────────────────────────────────────
  comments: defineTable({
    taskId:       v.id("tasks"),
    memberId:     v.id("members"),
    memberName:   v.string(),
    body:         v.string(),
    mentionedIds: v.optional(v.array(v.id("members"))),
    createdAt:    v.number(),
  }).index("by_taskId", ["taskId"])
    .index("by_memberId", ["memberId"]),

  // ── Task attachments (files uploaded via Convex storage) ────────────────────
  taskAttachments: defineTable({
    taskId:      v.id("tasks"),
    storageId:   v.id("_storage"),
    fileName:    v.string(),
    contentType: v.string(),
    size:        v.number(),              // bytes
    uploadedBy:  v.id("members"),
    uploadedAt:  v.number(),
  })
    .index("by_task", ["taskId"]),

  // ── Bottlenecks ───────────────────────────────────────────────────────────────
  bottlenecks: defineTable({
    orgId:      v.optional(v.id("organizations")),
    taskId:     v.id("tasks"),
    body:       v.string(),
    stage:      v.string(),
    category:   v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    createdBy:  v.id("members"),
    createdAt:  v.number(),
  })
    .index("by_task",  ["taskId"])
    .index("by_stage", ["stage"])
    .index("by_org",   ["orgId"]),

  // ── Activity feed ─────────────────────────────────────────────────────────────
  activities: defineTable({
    orgId:       v.optional(v.id("organizations")),
    type:        v.string(),
    taskId:      v.optional(v.id("tasks")),
    projectId:   v.optional(v.id("projects")),
    memberId:    v.optional(v.id("members")),
    memberName:  v.optional(v.string()),
    description: v.string(),
    createdAt:   v.number(),
  })
    .index("by_created", ["createdAt"])
    .index("by_org",     ["orgId"]),

  // ── Task dependencies (blocking chains) ──────────────────────────────────────
  // "blockerTaskId blocks dependentTaskId" — dependentTaskId can't start until blockerTaskId is done
  taskDependencies: defineTable({
    orgId:           v.optional(v.id("organizations")),
    blockerTaskId:   v.id("tasks"),   // the task that must finish first
    dependentTaskId: v.id("tasks"),   // the task that is waiting
    createdBy:       v.id("members"),
    createdAt:       v.number(),
  })
    .index("by_blocker",   ["blockerTaskId"])
    .index("by_dependent", ["dependentTaskId"])
    .index("by_org",       ["orgId"]),

  // ── Goals (North Star / OKR layer) ──────────────────────────────────────────
  goals: defineTable({
    orgId:       v.id("organizations"),
    title:       v.string(),
    description: v.optional(v.string()),
    targetValue: v.optional(v.number()),   // measurable target (e.g. 100)
    currentValue: v.optional(v.number()),  // manually updated or auto-calc'd
    unit:        v.optional(v.string()),   // e.g. "%", "deals", "users"
    status:      v.string(),               // "on_track" | "at_risk" | "behind" | "completed"
    ownerId:     v.optional(v.id("members")),
    dueDate:     v.optional(v.number()),
    color:       v.optional(v.string()),
    createdBy:   v.id("members"),
    createdAt:   v.number(),
    updatedAt:   v.number(),
  })
    .index("by_org",    ["orgId"])
    .index("by_status", ["status"]),

  // ── Goal ↔ Project links ──────────────────────────────────────────────────────
  goalProjects: defineTable({
    goalId:    v.id("goals"),
    projectId: v.id("projects"),
    addedAt:   v.number(),
  })
    .index("by_goal",    ["goalId"])
    .index("by_project", ["projectId"]),

  // ── Custom field definitions (per-org) ────────────────────────────────────────
  customFieldDefs: defineTable({
    orgId:        v.id("organizations"),
    name:         v.string(),           // e.g. "Review Round", "Deal Value"
    fieldType:    v.string(),           // "text" | "number" | "select" | "date" | "checkbox"
    options:      v.optional(v.array(v.string())), // for "select" type
    required:     v.optional(v.boolean()),
    sortOrder:    v.optional(v.number()),
    createdBy:    v.id("members"),
    createdAt:    v.number(),
  })
    .index("by_org", ["orgId"]),

  // ── Custom field values (per-task) ────────────────────────────────────────────
  customFieldValues: defineTable({
    taskId:  v.id("tasks"),
    fieldId: v.id("customFieldDefs"),
    value:   v.string(),               // stored as string, parsed by fieldType
    updatedAt: v.number(),
  })
    .index("by_task",  ["taskId"])
    .index("by_field", ["fieldId"]),

  // ── Permissions (granular RBAC) ───────────────────────────────────────────────
  roles: defineTable({
    orgId:       v.id("organizations"),
    name:        v.string(),           // e.g. "Admin", "Manager", "Member", "Designer"
    isSystem:    v.boolean(),          // system roles can't be deleted
    permissions: v.array(v.string()),  // e.g. ["space.create", "project.create", "task.approve"]
    createdAt:   v.number(),
    updatedAt:   v.number(),
  })
    .index("by_org",          ["orgId"])
    .index("by_org_and_name", ["orgId", "name"]),

  // ── Streaks (gamification) ─────────────────────────────────────────────────
  streaks: defineTable({
    orgId:       v.id("organizations"),
    memberId:    v.id("members"),
    current:     v.number(),               // current streak count
    best:        v.number(),               // all-time best streak
    updatedAt:   v.number(),
  })
    .index("by_member",  ["memberId"])
    .index("by_org",     ["orgId"]),

  // ── Weekly reflections (Sunday popup) ──────────────────────────────────────
  weeklyReflections: defineTable({
    orgId:           v.id("organizations"),
    memberId:        v.id("members"),
    weekStart:       v.string(),            // ISO date of the Sunday, e.g. "2026-04-05"
    didLastWeek:     v.string(),            // "What did you do last week?"
    needThisWeek:    v.string(),            // "What do you need to do this week?"
    forgotLastWeek:  v.string(),            // "What did you forget to do last week?"
    createdAt:       v.number(),
  })
    .index("by_member",                ["memberId"])
    .index("by_org",                   ["orgId"])
    .index("by_member_and_weekStart",  ["memberId", "weekStart"]),

  // ── Automations / Workflow rules ──────────────────────────────────────────────
  automations: defineTable({
    orgId:       v.id("organizations"),
    name:        v.string(),
    enabled:     v.boolean(),
    trigger:     v.string(),           // e.g. "task.status_changed", "task.created", "task.overdue"
    condition:   v.optional(v.string()), // JSON-encoded condition, e.g. {"status":"submitted"}
    action:      v.string(),           // e.g. "notify_owner", "change_status", "assign_member"
    actionConfig: v.optional(v.string()), // JSON-encoded config for the action
    createdBy:   v.id("members"),
    createdAt:   v.number(),
    updatedAt:   v.number(),
  })
    .index("by_org",            ["orgId"])
    .index("by_org_and_trigger", ["orgId", "trigger"]),
});
