import type { DashboardAuthContext } from "@/lib/agentwingTypes";

/**
 * Roles and capabilities.
 *
 * `workspace_members.role` has existed since migration 0005 and was read by
 * exactly zero queries — every member was implicitly an owner, able to approve
 * any run at any risk, mint and revoke keys, rewrite policies, replace the
 * sandbox credential and request account deletion.
 *
 * For a product whose value is that a *different* person authorises a
 * consequential action, "everyone can do everything" is not a missing feature,
 * it is the absence of the feature being sold.
 */

export const ROLES = ["owner", "admin", "approver", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "member";

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * What someone may do.
 *
 * Capabilities rather than role comparisons: `requireCapability(auth,
 * "policy:write")` states what the route needs, while `role === "admin" ||
 * role === "owner"` states an implementation detail that has to be repeated
 * correctly at every call site — and eventually will not be.
 */
export const CAPABILITIES = [
  "run:read",
  "run:approve",
  "policy:read",
  "policy:write",
  "key:read",
  "key:write",
  "project:write",
  "sandbox:write",
  "member:manage",
  "workspace:delete",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  // Everything, including destroying the workspace.
  owner: new Set(CAPABILITIES),

  // Everything operational. Cannot delete the workspace — that is the one
  // action whose blast radius warrants a single accountable person.
  admin: new Set<Capability>([
    "run:read",
    "run:approve",
    "policy:read",
    "policy:write",
    "key:read",
    "key:write",
    "project:write",
    "sandbox:write",
    "member:manage",
  ]),

  // Exists to approve. Deliberately cannot write policy: someone who can both
  // rewrite the rules and approve the exceptions is not a separate authority.
  approver: new Set<Capability>(["run:read", "run:approve", "policy:read", "key:read"]),

  // Builds against AgentWing. Can manage its own integration, cannot approve.
  member: new Set<Capability>(["run:read", "policy:read", "key:read", "key:write", "project:write", "sandbox:write"]),

  // Sees what happened, changes nothing.
  viewer: new Set<Capability>(["run:read", "policy:read", "key:read"]),
};

export function roleCapabilities(role: Role): ReadonlySet<Capability> {
  return ROLE_CAPABILITIES[role];
}

export function can(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

/** Raised when a caller is authenticated but not permitted. */
export class ForbiddenError extends Error {
  readonly code = "forbidden";
  readonly status = 403;

  constructor(
    readonly capability: Capability,
    readonly role: Role,
  ) {
    super(`Your role (${role}) cannot ${capability.replace(":", " ")}.`);
    this.name = "ForbiddenError";
  }
}

export function requireCapability(auth: DashboardAuthContext, capability: Capability): void {
  if (can(auth.role, capability)) return;
  throw new ForbiddenError(capability, auth.role);
}

export function forbiddenResponse(error: ForbiddenError): Response {
  return Response.json(
    { error: error.message, code: error.code, requiredCapability: error.capability },
    { status: error.status },
  );
}

/**
 * Separation of duties.
 *
 * The person who requested an action must not be the person who approves it.
 * Holding a capability is necessary but not sufficient: an approver approving
 * their own request provides no independent judgement, which is the entire
 * value the approval step is meant to add.
 */
export class SelfApprovalError extends Error {
  readonly code = "self_approval_forbidden";
  readonly status = 403;

  constructor() {
    super(
      "You requested this action, so you cannot approve it. Separation of duties requires a different person to decide.",
    );
    this.name = "SelfApprovalError";
  }
}

export function assertNotSelfApproval(approverIdentity: string, requesterIdentity: string | undefined): void {
  if (!requesterIdentity) return; // No recorded requester — nothing to compare against.
  if (approverIdentity.toLowerCase() === requesterIdentity.toLowerCase()) throw new SelfApprovalError();
}
