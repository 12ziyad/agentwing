import { actionTypes } from "@/lib/agentwingTypes";
import { PatternError, validatePattern } from "@/lib/policyPattern";
import type { AgentWingDecision, AgentWingRisk, UniversalActionType } from "@/lib/agentwingTypes";

/**
 * Validation for customer-authored policies.
 *
 * One module used by both POST and PATCH. They used to validate separately:
 * POST checked the decision enum, PATCH did not, and the column is plain TEXT
 * with no constraint. A policy PATCHed to `decision: "banana"` was returned by
 * check-action and fell through to the default arm of the run-status mapping,
 * landing in `checked` — neither blocked nor approved, and invisible.
 */

export const POLICY_DECISIONS = [
  "allow",
  "block",
  "approval_required",
  "sandbox_required",
  "restore_point_required",
] as const satisfies readonly AgentWingDecision[];

export const POLICY_RISKS = ["low", "medium", "high", "critical"] as const satisfies readonly AgentWingRisk[];

export const MAX_NAME_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_FEEDBACK_LENGTH = 500;

export class PolicyInputError extends Error {
  readonly code: string;
  readonly status = 400;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PolicyInputError";
    this.code = code;
  }
}

export type PolicyInput = {
  projectId?: string;
  name: string;
  description?: string;
  actionType?: UniversalActionType;
  tool?: string;
  targetPattern?: string;
  commandPattern?: string;
  decision: AgentWingDecision;
  risk: AgentWingRisk;
  priority: number;
  feedback?: string;
  enabled?: boolean;
};

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new PolicyInputError(`${field} must be a string.`, "invalid_type");
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new PolicyInputError(`${field} is longer than ${maxLength} characters.`, "too_long");
  }
  return trimmed;
}

function asPattern(value: unknown, field: string): string | undefined {
  const pattern = optionalString(value, field, 500);
  if (pattern === undefined) return undefined;
  try {
    validatePattern(pattern, field);
  } catch (error) {
    if (error instanceof PatternError) {
      throw new PolicyInputError(error.message, error.code);
    }
    throw error;
  }
  return pattern;
}

/**
 * Parse and validate a policy body.
 *
 * `partial` is for PATCH, where absent fields mean "leave unchanged" rather
 * than "clear". Everything present is validated identically either way — that
 * equivalence is the point of this module.
 */
export function parsePolicyInput(body: unknown, options: { partial?: boolean } = {}): Partial<PolicyInput> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PolicyInputError("Request body must be a JSON object.", "invalid_body");
  }

  const b = body as Record<string, unknown>;
  const partial = options.partial === true;
  const parsed: Partial<PolicyInput> = {};

  const name = optionalString(b.name, "name", MAX_NAME_LENGTH);
  if (name !== undefined) parsed.name = name;
  else if (!partial) throw new PolicyInputError("Policy name is required.", "name_required");

  parsed.description = optionalString(b.description, "description", MAX_DESCRIPTION_LENGTH);
  parsed.feedback = optionalString(b.feedback, "feedback", MAX_FEEDBACK_LENGTH);
  parsed.projectId = optionalString(b.projectId, "projectId", 200);
  parsed.tool = optionalString(b.tool, "tool", 200);
  parsed.targetPattern = asPattern(b.targetPattern, "targetPattern");
  parsed.commandPattern = asPattern(b.commandPattern, "commandPattern");

  const actionType = optionalString(b.actionType, "actionType", 60);
  if (actionType !== undefined) {
    if (!actionTypes.includes(actionType as UniversalActionType)) {
      throw new PolicyInputError(
        `actionType must be one of: ${actionTypes.join(", ")}.`,
        "invalid_action_type",
      );
    }
    parsed.actionType = actionType as UniversalActionType;
  }

  if (b.decision !== undefined || !partial) {
    const decision = typeof b.decision === "string" ? b.decision : partial ? undefined : "allow";
    if (decision !== undefined) {
      if (!POLICY_DECISIONS.includes(decision as AgentWingDecision)) {
        throw new PolicyInputError(
          `decision must be one of: ${POLICY_DECISIONS.join(", ")}.`,
          "invalid_decision",
        );
      }
      parsed.decision = decision as AgentWingDecision;
    }
  }

  if (b.risk !== undefined || !partial) {
    const risk = typeof b.risk === "string" ? b.risk : partial ? undefined : "low";
    if (risk !== undefined) {
      if (!POLICY_RISKS.includes(risk as AgentWingRisk)) {
        throw new PolicyInputError(`risk must be one of: ${POLICY_RISKS.join(", ")}.`, "invalid_risk");
      }
      parsed.risk = risk as AgentWingRisk;
    }
  }

  if (b.priority !== undefined) {
    if (typeof b.priority !== "number" || !Number.isFinite(b.priority)) {
      throw new PolicyInputError("priority must be a number.", "invalid_priority");
    }
    if (b.priority < 0 || b.priority > 10_000) {
      throw new PolicyInputError("priority must be between 0 and 10000.", "invalid_priority");
    }
    parsed.priority = Math.trunc(b.priority);
  } else if (!partial) {
    parsed.priority = 100;
  }

  if (b.enabled !== undefined) {
    if (typeof b.enabled !== "boolean") {
      throw new PolicyInputError("enabled must be a boolean.", "invalid_enabled");
    }
    parsed.enabled = b.enabled;
  }

  return parsed;
}

/**
 * Reject a policy that constrains nothing.
 *
 * A policy with no actionType, tool, targetPattern or commandPattern matches
 * every action. Combined with an `allow` decision that is a switch that turns
 * off every non-mandatory default rule, and it was previously writable by any
 * authenticated session. If someone genuinely wants that, they should have to
 * say so in a way that reads like what it is.
 */
export function assertHasCriteria(input: Partial<PolicyInput>): void {
  const hasCriteria = Boolean(input.actionType || input.tool || input.targetPattern || input.commandPattern);
  if (hasCriteria) return;

  throw new PolicyInputError(
    "A policy must constrain something: set at least one of actionType, tool, targetPattern or commandPattern. " +
      "A policy with no criteria would match every action.",
    "policy_without_criteria",
  );
}
