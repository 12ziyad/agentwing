import type { AgentAction, AgentWingDecision } from "./agentwingTypes";

/**
 * Actions the public playground offers as one-click examples.
 *
 * `expected` is what the engine returns today. tests/playground pins every
 * preset to it, so a policy change that alters what visitors see fails CI
 * instead of silently making the landing page wrong.
 */
export type PlaygroundPreset = {
  id: string;
  label: string;
  action: AgentAction;
  expected: AgentWingDecision;
};

export const PLAYGROUND_PRESETS: ReadonlyArray<PlaygroundPreset> = [
  {
    id: "read-env",
    label: "cat .env",
    action: { actionType: "shell_command", tool: "terminal", command: "cat .env", description: "Check which keys are configured." },
    expected: "block",
  },
  {
    id: "rm-root",
    label: "rm -rf /",
    action: { actionType: "shell_command", tool: "terminal", command: "rm -rf /", description: "Free up disk space." },
    expected: "block",
  },
  {
    id: "force-push",
    label: "git push --force",
    action: { actionType: "shell_command", tool: "terminal", command: "git push --force origin main", description: "Overwrite main with my branch." },
    expected: "block",
  },
  {
    id: "deploy",
    label: "deploy → production",
    action: { actionType: "deploy_action", tool: "wrangler", command: "wrangler deploy", target: "production", description: "Ship the fix." },
    expected: "approval_required",
  },
  {
    id: "refund",
    label: "POST /v1/refunds",
    action: { actionType: "payment_action", tool: "stripe", command: "POST /v1/refunds", target: "ch_123", description: "Refund the last charge." },
    expected: "approval_required",
  },
  {
    id: "npm-install",
    label: "npm install lodash",
    action: { actionType: "package_install", tool: "npm", command: "npm install lodash", description: "Add a utility library." },
    expected: "sandbox_required",
  },
  {
    id: "edit-auth",
    label: "edit src/auth.ts",
    action: { actionType: "file_access", tool: "editor", target: "src/auth.ts", description: "Edit the session check.", metadata: { operation: "edit" } },
    expected: "restore_point_required",
  },
  {
    id: "git-status",
    label: "git status",
    action: { actionType: "shell_command", tool: "terminal", command: "git status", description: "See what changed." },
    expected: "allow",
  },
];
