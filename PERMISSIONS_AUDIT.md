# Permissions Audit — Hardcoded Role Checks

This audit maps every hardcoded `isAdmin`, `isManager`, `requireAdmin()`, and `requireAdminOrManager()` check to the permission it **should** use from the roles/permissions system.

**Status:** The permissions system (`convex/permissions.ts`) is fully built with granular permissions and configurable roles. However, only `project.create` has been wired up so far. Everything else below is still hardcoded.

---

## Frontend — Action Controls (should use `can()`)

These control whether a user can **do** something. They should all use `can("permission.name")`.

### Spaces

| File | What it controls | Current check | Should use |
|------|-----------------|---------------|------------|
| `app/spaces/page.tsx` | "Create Space" button | `isAdmin \|\| isManager` | `can("space.create")` |
| `app/spaces/page.tsx` | Edit (pencil) button on space cards | `isAdmin \|\| isManager` | `can("space.edit")` |
| `app/spaces/page.tsx` | Archive button on space cards | `isAdmin \|\| isManager` | `can("space.archive")` |
| `app/spaces/[spaceId]/page.tsx` | `canEdit` for space details | `isAdmin \|\| isManager` | `can("space.edit")` |
| `components/Sidebar.tsx` | `canManageSpaces` (edit icons in sidebar) | `isAdmin` | `can("space.edit")` |

### Projects

| File | What it controls | Current check | Should use |
|------|-----------------|---------------|------------|
| `app/spaces/[spaceId]/page.tsx` | "Add Project" button | ✅ Already fixed | `can("project.create")` |
| `app/projects/[projectId]/page.tsx` | `canEdit` on ProjectListCard | `isAdmin \|\| isManager` | `can("project.edit")` |
| `app/projects/[projectId]/page.tsx` | ECD (estimated completion date) editing | `isAdmin \|\| isManager` | `can("project.edit")` |
| `components/spaces/ProjectListCard.tsx` | Edit button on project cards | `isAdmin \|\| isManager` | `can("project.edit")` |
| `components/Sidebar.tsx` | `canEditProjects` (sidebar edit icons) | `isAdmin \|\| isManager` | `can("project.edit")` |

### Tasks

| File | What it controls | Current check | Should use |
|------|-----------------|---------------|------------|
| `app/page.tsx` | Approve/reject in submitted column | `isAdmin` | `can("task.approve")` |
| `app/page.tsx` | Assign task to another member | `isAdmin` | `can("task.assign")` |
| `components/tasks/TaskCard.tsx` | Approve/reject buttons | `isAdmin` | `can("task.approve")` |
| `components/tasks/TaskCard.tsx` | Delete button | `isOwn \|\| isAdmin` | `isOwn \|\| can("task.delete")` |
| `components/tasks/TaskModal.tsx` | `canReview` (approve/reject) | `isAdmin` | `can("task.approve")` |
| `components/tasks/TaskModal.tsx` | Status dropdown (full options) | `isAdmin` | `can("task.edit")` |
| `components/tasks/TaskModal.tsx` | Delete task button | `isAdmin` | `can("task.delete")` |
| `components/tasks/TaskModal.tsx` | Delete attachment | `isAdmin \|\| isUploader` | `can("task.edit") \|\| isUploader` |
| `components/tasks/ListView.tsx` | Approval UI in list rows | `isAdmin` | `can("task.approve")` |
| `components/tasks/ProjectListView.tsx` | Approval indicators (5+ instances) | `isAdmin` | `can("task.approve")` |

### Members

| File | What it controls | Current check | Should use |
|------|-----------------|---------------|------------|
| `app/members/page.tsx` | Entire page access | `isAdmin` | `can("member.invite")` |
| `app/members/page.tsx` | Remove member button | `isAdmin` | `can("member.remove")` |
| `app/projects/[projectId]/page.tsx` | Remove member from project | `isAdmin \|\| isManager` | `can("member.remove")` |
| `app/projects/[projectId]/page.tsx` | "Add Members" section | `isAdmin \|\| isManager` | `can("member.invite")` |

### Goals, Automations, Settings

| File | What it controls | Current check | Should use |
|------|-----------------|---------------|------------|
| `app/approvals/page.tsx` | Entire page access | `isAdmin \|\| isManager` | `can("task.approve")` |
| `app/analytics/page.tsx` | Entire page access | `isAdmin \|\| isManager` | `can("settings.edit")` |

### Sidebar Navigation

| File | What it controls | Current check | Should use |
|------|-----------------|---------------|------------|
| `components/Sidebar.tsx` | Members link visibility | `isAdmin` | `can("member.invite")` |
| `components/Sidebar.tsx` | Settings link visibility | `isAdmin` | `can("settings.edit")` |
| `components/Sidebar.tsx` | Approvals link visibility | `isAdmin \|\| isManager` | `can("task.approve")` |
| `components/Sidebar.tsx` | Analytics link visibility | `isAdmin \|\| isManager` | `can("settings.edit")` |
| `components/Sidebar.tsx` | Archived spaces visibility | `isAdmin` | `can("space.archive")` |

---

## Frontend — Display Only (keep as-is)

These are purely visual and don't control access. No need to change:

- `app/members/page.tsx` — Admin badge next to name, avatar color
- `app/settings/page.tsx` — Admin avatar styling, role badge
- `app/notifications/page.tsx` — Different queries for admin vs member notifications
- `components/Sidebar.tsx` — Role label display, notification query routing
- `components/WorkloadView.tsx` — Admin member grouping in workload chart

---

## Backend — Mutations (should check permissions from roles table)

These enforce access server-side. They should use a `requirePermission(ctx, orgId, "permission.name")` helper.

### Spaces

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/spaces.ts` | `create` | `requireAdmin` | `space.create` |
| `convex/spaces.ts` | `update` | `requireAdmin` | `space.edit` |
| `convex/spaces.ts` | `archive` | `requireAdmin` | `space.archive` |
| `convex/spaces.ts` | `deleteSpace` | `requireAdmin` | `space.delete` |

### Tasks

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/tasks.ts` | `approveTask` | `requireAdminOrManager` | `task.approve` |
| `convex/tasks.ts` | `rejectTask` | `requireAdminOrManager` | `task.approve` |
| `convex/tasks.ts` | `approveAllSubmitted` | `requireAdminOrManager` | `task.approve` |
| `convex/tasks.ts` | `deleteTask` | `role === "admin" \|\| "manager"` | `task.delete` |
| `convex/taskAttachments.ts` | `deleteAttachment` | `role === "admin" \|\| "manager"` | `task.edit` |

### Members & Invites

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/inviteActions.ts` | `createInvite` | `requireAdmin` | `member.invite` |
| `convex/inviteActions.ts` | `revokeInvite` | `requireAdmin` | `member.invite` |
| `convex/inviteActions.ts` | `resendInvite` | `requireAdmin` | `member.invite` |
| `convex/members.ts` | `removeMember` | `requireAdmin` | `member.remove` |
| `convex/members.ts` | `updateMemberRole` | `requireAdmin` | `member.role_change` |

### Goals

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/goals.ts` | `create` | `requireAdminOrManager` | `goal.create` |
| `convex/goals.ts` | `update` | `requireAdminOrManager` | `goal.edit` |
| `convex/goals.ts` | `remove` | `requireAdminOrManager` | `goal.delete` |

### Automations

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/automations.ts` | `create` | `requireAdminOrManager` | `automation.create` |
| `convex/automations.ts` | `update` | `requireAdminOrManager` | `automation.edit` |
| `convex/automations.ts` | `remove` | `requireAdminOrManager` | `automation.delete` |

### Custom Fields

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/customFields.ts` | `createDef` | `requireAdminOrManager` | `custom_field.create` |
| `convex/customFields.ts` | `updateDef` | `requireAdminOrManager` | `custom_field.edit` |
| `convex/customFields.ts` | `deleteDef` | `requireAdminOrManager` | `custom_field.delete` |

### Settings & Org

| File | Function | Current check | Should use |
|------|----------|---------------|------------|
| `convex/settings.ts` | `setSetting` | `requireAdmin` | `settings.edit` |
| `convex/organizations.ts` | `update` | `requireAdmin` | `settings.edit` |
| `convex/permissions.ts` | `createRole` | `requireAdmin` | `settings.edit` |
| `convex/permissions.ts` | `updateRole` | `requireAdmin` | `settings.edit` |
| `convex/permissions.ts` | `deleteRole` | `requireAdmin` | `settings.edit` |

---

## Counts

| Category | Hardcoded checks | Permission needed |
|----------|-----------------|-------------------|
| Space actions | 9 (4 backend + 5 frontend) | `space.create/edit/delete/archive` |
| Project actions | 7 (0 backend + 7 frontend) | `project.create/edit` |
| Task actions | 16 (5 backend + 11 frontend) | `task.approve/edit/delete/assign` |
| Member actions | 8 (5 backend + 3 frontend) | `member.invite/remove/role_change` |
| Goal actions | 3 (3 backend) | `goal.create/edit/delete` |
| Automation actions | 3 (3 backend) | `automation.create/edit/delete` |
| Custom field actions | 3 (3 backend) | `custom_field.create/edit/delete` |
| Settings actions | 5 (5 backend) | `settings.edit` |
| Navigation/page access | 5 (frontend) | Various |
| **Total** | **~59 action checks** | |

---

## What's Already Done

- ✅ `can()` helper added to AuthProvider
- ✅ `project.create` wired up in spaces page

## What Needs Migration

1. **Backend helper** — Create `requirePermission(ctx, orgId, permission)` that checks the roles table
2. **Frontend** — Replace remaining `isAdmin`/`isManager` checks with `can("...")` calls (45+ locations)
3. **Backend** — Replace `requireAdmin`/`requireAdminOrManager` with `requirePermission` (25+ mutations)
