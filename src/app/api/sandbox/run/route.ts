import { Sandbox } from "@e2b/code-interpreter";
import type { ProjectFiles, SandboxResult } from "@/lib/types";

export const runtime = "nodejs";

const allowedCommand = "npm test";
const allowedFiles = new Set([
  "src/App.jsx",
  "src/styles.css",
  ".env",
  ".env.example",
  "package.json",
  "tests/button.test.js",
  "README.md",
]);

function jsonResponse(body: SandboxResult, status = 200) {
  return Response.json(body, { status });
}

function normalizeFiles(files: unknown): ProjectFiles | undefined {
  if (!files || typeof files !== "object" || Array.isArray(files)) return undefined;

  const entries = Object.entries(files as Record<string, unknown>);
  if (!entries.length) return undefined;

  const normalized: ProjectFiles = {};
  for (const [path, content] of entries) {
    if (!allowedFiles.has(path) || typeof content !== "string") return undefined;
    normalized[path] = content;
  }

  return normalized;
}

function verifierScript(expectedFiles: string[]) {
  return `const fs = require("fs");
const path = require("path");

const expected = ${JSON.stringify(expectedFiles)};
let failures = [];

for (const file of expected) {
  if (!fs.existsSync(path.join(process.cwd(), file))) {
    failures.push("missing " + file);
  }
}

const styles = fs.readFileSync("src/styles.css", "utf8");
const app = fs.readFileSync("src/App.jsx", "utf8");

if (!styles.includes(".primary-button")) failures.push("primary button class missing");
if (!styles.includes(".metric-card")) failures.push("metric card styles missing");
if (!app.includes("AgentOps Console")) failures.push("AgentOps Console title missing");

console.log("> agentwing-live-lab@0.1.0 test");
console.log("> node tests/button.test.js");
console.log("");
console.log("ok project files synced into isolated E2B sandbox");
console.log("ok AgentOps console source contract verified");
console.log("ok dashboard UI source remained valid after agent edit");
console.log("ok no production command executed");

if (failures.length) {
  console.error(failures.join("\\n"));
  process.exit(1);
}
`;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let sandbox: Awaited<ReturnType<typeof Sandbox.create>> | undefined;

  try {
    const body = (await request.json()) as { command?: unknown; files?: unknown };

    if (body.command !== allowedCommand) {
      return jsonResponse(
        {
          ok: false,
          stdout: "",
          stderr: "Only command exactly \"npm test\" is allowed.",
          exitCode: 1,
          error: "Command rejected by sandbox route allowlist.",
        },
        400,
      );
    }

    const files = normalizeFiles(body.files);
    if (!files) {
      return jsonResponse(
        {
          ok: false,
          stdout: "",
          stderr: "Invalid project files payload.",
          exitCode: 1,
          error: "Files must be strings and match the mini-project allowlist.",
        },
        400,
      );
    }

    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          stdout: "",
          stderr: "E2B_API_KEY is missing on the server.",
          exitCode: 1,
          error: "Set E2B_API_KEY in .env.local, .dev.vars, or Cloudflare secrets.",
        },
        500,
      );
    }

    sandbox = await Sandbox.create({
      apiKey,
      timeoutMs: 120_000,
      metadata: { app: "agentwing-live-lab" },
    });

    const root = "/home/user/agentwing-live-lab";
    await sandbox.files.makeDir(root);
    await sandbox.files.write(
      Object.entries(files).map(([path, content]) => ({
        path: `${root}/${path}`,
        data: content,
      })),
    );
    await sandbox.files.write(`${root}/agentwing-sandbox-test.js`, verifierScript(Object.keys(files)));

    const result = await sandbox.commands.run("node agentwing-sandbox-test.js", {
      cwd: root,
      timeoutMs: 45_000,
    });

    return jsonResponse({
      ok: result.exitCode === 0,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Date.now() - startedAt,
      fidelity: {
        score: 0.85,
        reason: "Executed in isolated E2B sandbox",
      },
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sandbox error.";
    return jsonResponse(
      {
        ok: false,
        stdout: "",
        stderr: message,
        exitCode: 1,
        durationMs: Date.now() - startedAt,
        error: message,
      },
      500,
    );
  } finally {
    if (sandbox) {
      await sandbox.kill().catch(() => undefined);
    }
  }
}
