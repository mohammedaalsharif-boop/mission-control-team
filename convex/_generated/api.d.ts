/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminRecovery from "../adminRecovery.js";
import type * as auth from "../auth.js";
import type * as automations from "../automations.js";
import type * as bottlenecks from "../bottlenecks.js";
import type * as bulkImport from "../bulkImport.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as customFields from "../customFields.js";
import type * as dependencies from "../dependencies.js";
import type * as goals from "../goals.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as inviteActions from "../inviteActions.js";
import type * as invites from "../invites.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as permissions from "../permissions.js";
import type * as projects from "../projects.js";
import type * as recurring from "../recurring.js";
import type * as settings from "../settings.js";
import type * as spaces from "../spaces.js";
import type * as streaks from "../streaks.js";
import type * as subtasks from "../subtasks.js";
import type * as taskAttachments from "../taskAttachments.js";
import type * as tasks from "../tasks.js";
import type * as templates from "../templates.js";
import type * as users from "../users.js";
import type * as weeklyReflections from "../weeklyReflections.js";
import type * as wipe from "../wipe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminRecovery: typeof adminRecovery;
  auth: typeof auth;
  automations: typeof automations;
  bottlenecks: typeof bottlenecks;
  bulkImport: typeof bulkImport;
  comments: typeof comments;
  crons: typeof crons;
  customFields: typeof customFields;
  dependencies: typeof dependencies;
  goals: typeof goals;
  helpers: typeof helpers;
  http: typeof http;
  inviteActions: typeof inviteActions;
  invites: typeof invites;
  members: typeof members;
  migrations: typeof migrations;
  notifications: typeof notifications;
  organizations: typeof organizations;
  permissions: typeof permissions;
  projects: typeof projects;
  recurring: typeof recurring;
  settings: typeof settings;
  spaces: typeof spaces;
  streaks: typeof streaks;
  subtasks: typeof subtasks;
  taskAttachments: typeof taskAttachments;
  tasks: typeof tasks;
  templates: typeof templates;
  users: typeof users;
  weeklyReflections: typeof weeklyReflections;
  wipe: typeof wipe;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
