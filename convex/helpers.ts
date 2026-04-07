import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

type Ctx = MutationCtx | QueryCtx;

/** Resolves the caller's email from their JWT identity. Always returns lowercase. */
export async function getCallerEmail(ctx: Ctx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated.");

  // Prefer the identity email set by Convex Auth
  if (identity.email) return identity.email.trim().toLowerCase();

  // Fallback: look up the users table
  const userId = identity.subject.split("|")[0] as Id<"users">;
  const authUser = await ctx.db.get(userId);
  if (!authUser?.email) throw new Error("You are not authorised to access this workspace.");
  return authUser.email.trim().toLowerCase();
}

/**
 * Resolves the caller's member record for a specific org.
 * If orgId is provided, looks up the member in that org.
 * If not, falls back to the first member record found (legacy single-org compat).
 */
export async function getCallerMember(ctx: Ctx, orgId?: Id<"organizations">) {
  const email = await getCallerEmail(ctx);

  if (orgId) {
    const member = await ctx.db
      .query("members")
      .withIndex("by_org_and_email", (q) => q.eq("orgId", orgId).eq("email", email))
      .first();
    if (!member) throw new Error("You are not a member of this organization.");
    return member;
  }

  // Fallback: first member record with this email
  const member = await ctx.db
    .query("members")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (!member) throw new Error("You are not authorised to access this workspace.");
  return member;
}

/** Throws unless caller is admin or manager in the given org. */
export async function requireAdminOrManager(ctx: Ctx, orgId?: Id<"organizations">) {
  const member = await getCallerMember(ctx, orgId);
  if (member.role !== "admin" && member.role !== "manager") {
    throw new Error("Permission denied. Admin or manager access required.");
  }
  return member;
}

/** Throws unless caller is admin in the given org. */
export async function requireAdmin(ctx: Ctx, orgId?: Id<"organizations">) {
  const member = await getCallerMember(ctx, orgId);
  if (member.role !== "admin") {
    throw new Error("Permission denied. Admin access required.");
  }
  return member;
}

/**
 * Throws unless the caller has the specified permission in the given org.
 * Admins always pass. For other roles, checks the roles table.
 */
export async function requirePermission(
  ctx: Ctx,
  orgId: Id<"organizations">,
  permission: string,
) {
  const member = await getCallerMember(ctx, orgId);
  // Admins bypass all permission checks
  if (member.role === "admin") return member;

  // Look up the role in the roles table (capitalize first letter to match)
  const roleName = member.role.charAt(0).toUpperCase() + member.role.slice(1);
  const role = await ctx.db
    .query("roles")
    .withIndex("by_org_and_name", (q) => q.eq("orgId", orgId).eq("name", roleName))
    .first();

  if (role && role.permissions.includes(permission)) {
    return member;
  }

  throw new Error(`Permission denied. You need the "${permission}" permission.`);
}

/**
 * Verifies that the caller belongs to the same org as the given record.
 * For legacy records with no orgId, allows access to any authenticated user.
 * Returns the record if access is allowed, throws otherwise.
 */
export async function requireSameOrg<T extends { orgId?: Id<"organizations"> }>(
  ctx: Ctx,
  record: T | null,
  label: string = "Record",
): Promise<T> {
  if (!record) throw new Error(`${label} not found.`);

  // Legacy records without orgId are accessible to any authenticated user
  if (!record.orgId) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated.");
    return record;
  }

  // Verify caller is a member of the record's org
  await getCallerMember(ctx, record.orgId);
  return record;
}
