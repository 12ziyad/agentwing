import { describe, expect, it } from "vitest";
import {
  assertNotSelfApproval,
  can,
  CAPABILITIES,
  DEFAULT_ROLE,
  ForbiddenError,
  isRole,
  requireCapability,
  ROLES,
  roleCapabilities,
  SelfApprovalError,
} from "@/lib/rbac";
import type { Capability, Role } from "@/lib/rbac";
import type { DashboardAuthContext } from "@/lib/agentwingTypes";

/**
 * `workspace_members.role` existed from migration 0005 and was read by zero
 * queries, so every member was implicitly an owner: able to approve any run at
 * any risk, mint and revoke keys, rewrite policy, replace the sandbox
 * credential and request account deletion.
 *
 * For a product whose value is that a different person authorises a
 * consequential action, that is not a missing feature — it is the absence of
 * the feature being sold.
 */

const auth = (role: Role): DashboardAuthContext =>
  ({
    mode: "user",
    role,
    workspaceId: "ws_1",
    user: { userId: "usr_1", email: "someone@example.com" },
    workspace: { workspaceId: "ws_1", name: "W" },
  }) as unknown as DashboardAuthContext;

describe("the role ladder", () => {
  it("gives an owner everything", () => {
    for (const capability of CAPABILITIES) {
      expect(can("owner", capability), capability).toBe(true);
    }
  });

  it("is strictly ordered — nobody below owner has more than owner", () => {
    const ownerCaps = roleCapabilities("owner");
    for (const role of ROLES) {
      for (const capability of roleCapabilities(role)) {
        expect(ownerCaps.has(capability), `${role} has ${capability}`).toBe(true);
      }
    }
  });

  it("withholds workspace deletion from everyone but the owner", () => {
    for (const role of ROLES) {
      expect(can(role, "workspace:delete"), role).toBe(role === "owner");
    }
  });

  it("lets only owner, admin and approver approve", () => {
    const canApprove = ROLES.filter((role) => can(role, "run:approve"));
    expect(canApprove.sort()).toEqual(["admin", "approver", "owner"]);
  });

  it("does not let an approver rewrite policy", () => {
    // Someone who can both change the rules and approve the exceptions is not
    // an independent authority — they are a single point of decision wearing
    // two hats.
    expect(can("approver", "run:approve")).toBe(true);
    expect(can("approver", "policy:write")).toBe(false);
  });

  it("does not let a member approve", () => {
    expect(can("member", "run:approve")).toBe(false);
    expect(can("member", "key:write")).toBe(true);
  });

  it("lets a viewer change nothing", () => {
    const writes: Capability[] = [
      "run:approve",
      "policy:write",
      "key:write",
      "project:write",
      "sandbox:write",
      "member:manage",
      "workspace:delete",
    ];
    for (const capability of writes) {
      expect(can("viewer", capability), capability).toBe(false);
    }
    expect(can("viewer", "run:read")).toBe(true);
  });

  it("lets every role read runs, so nobody is blind to what happened", () => {
    for (const role of ROLES) {
      expect(can(role, "run:read"), role).toBe(true);
    }
  });
});

describe("unknown roles", () => {
  it("are not roles", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  it("fall back to the least-privileged role, not the most", () => {
    // A typo in the column must not silently grant more than it names.
    expect(DEFAULT_ROLE).toBe("member");
    expect(can(DEFAULT_ROLE, "run:approve")).toBe(false);
    expect(can(DEFAULT_ROLE, "workspace:delete")).toBe(false);
  });
});

describe("requireCapability", () => {
  it("passes a permitted caller through", () => {
    expect(() => requireCapability(auth("owner"), "workspace:delete")).not.toThrow();
  });

  it("refuses with a 403 that names what was needed", () => {
    let error: ForbiddenError | undefined;
    try {
      requireCapability(auth("viewer"), "run:approve");
    } catch (thrown) {
      error = thrown as ForbiddenError;
    }

    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error?.status).toBe(403);
    expect(error?.code).toBe("forbidden");
    expect(error?.capability).toBe("run:approve");
    // The message should tell the operator why, not just that.
    expect(error?.message).toContain("viewer");
  });
});

describe("separation of duties", () => {
  it("refuses an approver who is the requester", () => {
    expect(() => assertNotSelfApproval("alice@example.com", "alice@example.com")).toThrow(SelfApprovalError);
  });

  it("ignores case, so a differently-cased sign-in is still the same person", () => {
    expect(() => assertNotSelfApproval("Alice@Example.com", "alice@example.com")).toThrow(SelfApprovalError);
  });

  it("allows a genuinely different person", () => {
    expect(() => assertNotSelfApproval("bob@example.com", "alice@example.com")).not.toThrow();
  });

  it("does not fire when no requester identity was recorded", () => {
    // Runs created by an API key record an agent id, not a human. There is
    // nothing to compare against, and inventing a comparison would be worse
    // than admitting the check does not apply.
    expect(() => assertNotSelfApproval("alice@example.com", undefined)).not.toThrow();
  });

  it("is a 403 with a stable code", () => {
    const error = new SelfApprovalError();
    expect(error.status).toBe(403);
    expect(error.code).toBe("self_approval_forbidden");
  });
});
