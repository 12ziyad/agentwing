import type { DiffLine, LatestDiff } from "./types";

export function createLineDiff(path: string, before: string, after: string): LatestDiff {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  let start = 0;

  while (
    start < beforeLines.length &&
    start < afterLines.length &&
    beforeLines[start] === afterLines[start]
  ) {
    start += 1;
  }

  let beforeEnd = beforeLines.length - 1;
  let afterEnd = afterLines.length - 1;

  while (
    beforeEnd >= start &&
    afterEnd >= start &&
    beforeLines[beforeEnd] === afterLines[afterEnd]
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  const lines: DiffLine[] = [];
  const contextStart = Math.max(0, start - 3);
  const contextEnd = Math.min(beforeLines.length - 1, beforeEnd + 3);

  for (let i = contextStart; i < start; i += 1) {
    lines.push({ type: "context", value: beforeLines[i], oldLine: i + 1, newLine: i + 1 });
  }

  for (let i = start; i <= beforeEnd; i += 1) {
    lines.push({ type: "removed", value: beforeLines[i], oldLine: i + 1 });
  }

  for (let i = start; i <= afterEnd; i += 1) {
    lines.push({ type: "added", value: afterLines[i], newLine: i + 1 });
  }

  const unchangedOffset = afterEnd - beforeEnd;
  for (let i = beforeEnd + 1; i <= contextEnd; i += 1) {
    if (i >= beforeLines.length) continue;
    lines.push({
      type: "context",
      value: beforeLines[i],
      oldLine: i + 1,
      newLine: i + 1 + unchangedOffset,
    });
  }

  return { path, before, after, lines };
}
