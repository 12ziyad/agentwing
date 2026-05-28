export type RunnerTokenResult =
  | { ok: true; token: string }
  | { ok: false; code: "missing_runner_approval_token"; status: 400 };

/**
 * Extracts the runner approval token from a request, in this precedence:
 * 1. Authorization: Bearer <token> — only if it does NOT start with "aw_live_"
 * 2. body.runnerApprovalToken
 * 3. body.token
 *
 * If the bearer value starts with "aw_live_" it is treated as a normal API key,
 * not a runner token, and body fields are checked instead.
 * If no token is found at all, returns a machine-readable 400 error.
 */
export function extractRunnerToken(request: Request, body: unknown): RunnerTokenResult {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, bearer] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() === "bearer" && bearer && !bearer.startsWith("aw_live_")) {
    return { ok: true, token: bearer.trim() };
  }

  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const bodyToken = record.runnerApprovalToken ?? record.token;
    if (typeof bodyToken === "string" && bodyToken) {
      return { ok: true, token: bodyToken };
    }
  }

  return { ok: false, code: "missing_runner_approval_token", status: 400 };
}

export function reasonFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>).reason;
  return typeof value === "string" ? value.slice(0, 500) : undefined;
}
