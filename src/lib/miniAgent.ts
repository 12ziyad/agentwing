import { createLineDiff } from "./diff";
import { evaluateAction } from "./policyEngine";
import { applyTaskToModel, generateAppJsx, generateStylesCss } from "./previewModel";
import type {
  AgentAction,
  AgentCallbacks,
  AgentPlan,
  AgentWingDecision,
  PreviewModel,
  RepairContext,
} from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function checkRegression(
  committedModel: PreviewModel,
  updatedModel: PreviewModel,
  task: string,
): { hasRegression: boolean; reason: string } {
  const lower = task.toLowerCase();
  const asksRemove = lower.includes("remove") || lower.includes("hide") || lower.includes("delete");

  // Check for unexpected metric removal
  for (const metric of committedModel.metrics) {
    const label = metric.label.toLowerCase();
    const intentional = asksRemove && lower.includes(label);
    if (!intentional && !updatedModel.metrics.some((m) => m.label.toLowerCase() === label)) {
      return {
        hasRegression: true,
        reason: `Regression: "${metric.label}" metric was removed without being asked.`,
      };
    }
  }

  // Check if primary button was unexpectedly hidden
  if (committedModel.primaryButton.visible && !updatedModel.primaryButton.visible) {
    const intentional = asksRemove && (lower.includes("primary button") || lower.includes("workflow button"));
    if (!intentional) {
      return { hasRegression: true, reason: "Regression: primary button was hidden without being asked." };
    }
  }

  // Check if status pill visibility changed without being asked
  if (committedModel.showStatusPill !== updatedModel.showStatusPill) {
    const mentionsPill = lower.includes("active") || lower.includes("status pill") || lower.includes("status badge");
    if (!mentionsPill) {
      return { hasRegression: true, reason: "Regression: status pill visibility changed without being asked." };
    }
  }

  // Check if visible secondary buttons were removed without being asked
  for (const btn of (committedModel.secondaryButtons ?? []).filter((b) => b.visible)) {
    const label = btn.text.toLowerCase();
    const intentional = asksRemove && lower.includes(label);
    if (!intentional) {
      const stillVisible = (updatedModel.secondaryButtons ?? []).some(
        (b) => b.text.toLowerCase() === label && b.visible,
      );
      if (!stillVisible) {
        return { hasRegression: true, reason: `Regression: "${btn.text}" button was removed without being asked.` };
      }
    }
  }

  return { hasRegression: false, reason: "No regression detected." };
}

async function planOpenAIEdit(
  task: string,
  callbacks: AgentCallbacks,
): Promise<AgentPlan> {
  const plan = await callbacks.planEdit(
    task,
    callbacks.getFiles(),
    callbacks.getCommittedModel(),
    callbacks.getChangeHistory(),
  );
  callbacks.addEvent({
    kind: "action",
    action: "plan",
    target: "src/App.jsx",
    reason: `LLM planned code edit: ${plan.summary}`,
  });
  callbacks.addTerminalLine(`[agent] LLM planner updated UI model`);
  callbacks.addTerminalLine(`[agent] ${plan.explanation}`);
  return plan;
}

function eventFromDecision(
  action: AgentAction,
  decision: AgentWingDecision,
  reason = decision.reason,
) {
  return {
    kind:
      decision.decision === "blocked"
        ? "blocked"
        : decision.decision === "sandbox_required"
          ? "sandbox"
          : decision.checkpoint
            ? "checkpoint"
            : action.type === "finish"
              ? "finish"
              : "allowed",
    action: action.type,
    target: action.target,
    command: action.command,
    decision: decision.decision,
    risk: decision.risk,
    reason,
    policy_triggered: decision.policy_triggered,
    feedback: decision,
  } as const;
}

async function guardedReadFile(path: string, callbacks: AgentCallbacks) {
  const action: AgentAction = { type: "readFile", target: path };
  const decision = evaluateAction(action);
  callbacks.setFeedback(decision);
  callbacks.addEvent(eventFromDecision(action, decision));
  callbacks.setSelectedFile(decision.decision === "blocked" ? ".env.example" : path);
  await delay(650);
  if (decision.decision === "blocked") return undefined;
  return callbacks.getFiles()[path];
}

async function guardedWriteFile(path: string, content: string, callbacks: AgentCallbacks) {
  const before = callbacks.getFiles()[path];
  const action: AgentAction = { type: "writeFile", target: path, content };
  const decision = evaluateAction(action);
  callbacks.setFeedback(decision);
  callbacks.addEvent(eventFromDecision(action, decision));

  if (decision.checkpoint) {
    callbacks.addEvent({
      kind: "checkpoint",
      action: "writeFile",
      target: path,
      decision: decision.decision,
      risk: decision.risk,
      reason: "Checkpoint recorded before applying source edit.",
      feedback: decision,
    });
  }

  await delay(750);
  if (decision.decision !== "allowed") return;

  callbacks.setFiles((files) => ({ ...files, [path]: content }));
  callbacks.setLatestDiff(createLineDiff(path, before, content));
  callbacks.setSelectedFile(path);
  await delay(500);
}

async function guardedRunCommand(command: string, callbacks: AgentCallbacks) {
  const action: AgentAction = { type: "runCommand", command };
  const decision = evaluateAction(action);
  callbacks.setFeedback(decision);
  callbacks.addEvent(eventFromDecision(action, decision));
  await delay(500);

  if (decision.decision === "blocked") return { decision };

  if (decision.decision === "sandbox_required") {
    callbacks.addEvent({
      kind: "sandbox",
      action: "runCommand",
      command,
      decision: decision.decision,
      risk: decision.risk,
      reason: "npm test requires sandbox replay.",
      feedback: decision,
    });
    callbacks.addTerminalLine("[0.1s] Creating E2B sandbox...");
    await delay(500);
    callbacks.addTerminalLine("[0.6s] Syncing project files...");
    await delay(600);
    callbacks.addTerminalLine("[1.2s] Running npm test...");

    const result = await callbacks.runSandbox(command, callbacks.getFiles());
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    callbacks.addTerminalLine(output || "(sandbox returned no output)");

    if (result.ok) {
      callbacks.addEvent({
        kind: "sandbox",
        action: "sandboxResult",
        command,
        decision: "sandbox_required",
        risk: "medium",
        reason: "Sandbox result: passed.",
        feedback: {
          ...decision,
          fidelity: result.fidelity ?? decision.fidelity,
        },
      });
    } else {
      callbacks.addEvent({
        kind: "failed",
        action: "sandboxResult",
        command,
        decision: "sandbox_required",
        risk: "medium",
        reason: `Sandbox result: failed${result.error ? ` - ${result.error}` : ""}.`,
        feedback: decision,
      });
    }

    callbacks.setFeedback({
      ...decision,
      fidelity: result.fidelity ?? decision.fidelity,
      reason: result.ok ? "Sandbox replay completed successfully." : "Sandbox replay failed.",
    });
  }

  if (decision.decision === "allowed") {
    callbacks.addTerminalLine(`$ ${command}`);
    callbacks.addTerminalLine("Created safe feature branch: safe-ui-change");
  }

  return { decision };
}

export async function runMiniAgent(task: string, callbacks: AgentCallbacks) {
  callbacks.addTerminalLine("$ agentwing run --live");
  callbacks.addEvent({
    kind: "action",
    action: "readFile",
    target: "task",
    reason: `User task received: ${task || "Make the primary button bigger and prepare the change"}`,
  });

  await delay(450);
  await guardedReadFile("src/App.jsx", callbacks);
  await guardedReadFile("src/styles.css", callbacks);

  const effectiveTask = task || "Make the primary button bigger and prepare the change";
  // Always plan from the last committed model so incremental changes stack correctly
  const committedModel = callbacks.getCommittedModel();

  let newAppJsx: string;
  let newStylesCss: string;
  let finalModel: PreviewModel;
  let finalSummary: string;

  try {
    const plan = await planOpenAIEdit(effectiveTask, callbacks);

    const visiblyChanged = JSON.stringify(committedModel) !== JSON.stringify(plan.updatedModel);
    const regressionResult = visiblyChanged ? checkRegression(committedModel, plan.updatedModel, effectiveTask) : null;
    const needsRepair = !visiblyChanged || (regressionResult?.hasRegression ?? false);

    let finalPlan = plan;

    if (needsRepair) {
      const verifierReason = !visiblyChanged
        ? "No visible change detected — the model is identical to the committed state."
        : (regressionResult?.reason ?? "Regression detected.");

      callbacks.addEvent({
        kind: "replan",
        action: "replan",
        target: "src/App.jsx",
        reason: `Verification failed: ${verifierReason} — requesting one LLM repair.`,
      });
      callbacks.addTerminalLine(`[agent] ${verifierReason} Requesting LLM repair.`);

      const repairCtx: RepairContext = {
        verifierReason,
        previousModel: committedModel,
        failedModel: plan.updatedModel,
        task: effectiveTask,
        instruction: "Repair while preserving ALL previous changes. Only change what was explicitly requested.",
      };

      try {
        const repairPlan = await callbacks.planEdit(
          effectiveTask,
          callbacks.getFiles(),
          committedModel,
          callbacks.getChangeHistory(),
          repairCtx,
        );

        const repairChanged = JSON.stringify(committedModel) !== JSON.stringify(repairPlan.updatedModel);
        const repairRegression = repairChanged
          ? checkRegression(committedModel, repairPlan.updatedModel, effectiveTask)
          : null;

        if (!repairChanged || repairRegression?.hasRegression) {
          const failReason = !repairChanged ? "no change" : (repairRegression?.reason ?? "regression");
          callbacks.addTerminalLine(`[agent] LLM repair still failed (${failReason}); using deterministic fallback.`);
          throw new Error(`Repair verification failed: ${failReason}`);
        }

        callbacks.addEvent({
          kind: "verified",
          action: "plan",
          target: "src/App.jsx",
          reason: `Repair verified: ${repairPlan.summary}`,
        });
        callbacks.addTerminalLine(`[agent] Repair verified: ${repairPlan.explanation}`);
        finalPlan = repairPlan;
      } catch (repairErr) {
        throw new Error(repairErr instanceof Error ? repairErr.message : "Repair failed.");
      }
    } else {
      callbacks.addEvent({
        kind: "verified",
        action: "plan",
        target: "src/App.jsx",
        reason: "Verification passed — change is visible and preserves all previous state.",
      });
    }

    callbacks.setPreviewModel(finalPlan.updatedModel);
    newAppJsx = finalPlan.changedFiles["src/App.jsx"];
    newStylesCss = finalPlan.changedFiles["src/styles.css"];
    finalModel = finalPlan.updatedModel;
    finalSummary = finalPlan.summary;
  } catch (error) {
    // LLM failed or repair failed — deterministic fallback always starts from committed state
    const updatedModel = applyTaskToModel(committedModel, effectiveTask);
    callbacks.setPreviewModel(updatedModel);
    newAppJsx = generateAppJsx(updatedModel);
    newStylesCss = generateStylesCss(updatedModel);
    finalModel = updatedModel;
    finalSummary = effectiveTask;
    callbacks.addEvent({
      kind: "replan",
      action: "replan",
      target: "src/App.jsx",
      reason: `LLM failed, using deterministic fallback${error instanceof Error ? `: ${error.message}` : "."}`,
    });
    callbacks.addTerminalLine("[agent] LLM planner unavailable; using deterministic fallback.");
  }

  // Write styles first so App.jsx diff is shown last in DiffViewer
  await guardedWriteFile("src/styles.css", newStylesCss, callbacks);
  await guardedWriteFile("src/App.jsx", newAppJsx, callbacks);

  // Commit the change — this updates the persistent state for the next run
  callbacks.commitChange(finalModel, callbacks.getFiles(), finalSummary);
  callbacks.addEvent({
    kind: "committed",
    action: "writeFile",
    target: "src/App.jsx",
    reason: `Committed: ${finalSummary}`,
  });

  await guardedRunCommand("npm test", callbacks);

  const secretRead = await guardedReadFile(".env", callbacks);
  if (!secretRead) {
    callbacks.addEvent({
      kind: "replan",
      action: "replan",
      target: ".env.example",
      reason: "Agent replanned: using .env.example instead.",
    });
    await delay(550);
    await guardedReadFile(".env.example", callbacks);
  }

  const forcePush = await guardedRunCommand("git push --force origin main", callbacks);
  if (forcePush.decision.decision === "blocked") {
    callbacks.addEvent({
      kind: "replan",
      action: "replan",
      command: "git checkout -b safe-ui-change",
      reason: "Agent replanned: create safe feature branch instead.",
    });
    await delay(550);
    await guardedRunCommand("git checkout -b safe-ui-change", callbacks);
  }

  const finishAction: AgentAction = { type: "finish" };
  const finishDecision = evaluateAction(finishAction);
  callbacks.setFeedback(finishDecision);
  callbacks.addEvent(eventFromDecision(finishAction, finishDecision, "Run finished safely."));
}
