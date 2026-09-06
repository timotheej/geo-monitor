import { executeTask, finishRun, getRunCost, markRunRunning, type Task } from "@/lib/runs";

export async function startRunStep(runId: string, workflowRunId: string) {
  "use step";
  await markRunRunning(runId, workflowRunId);
}

export async function executeTaskStep(runId: string, task: Task) {
  "use step";
  return executeTask(runId, task);
}

export async function runCostStep(runId: string) {
  "use step";
  return getRunCost(runId);
}

export async function finishRunStep(runId: string, status: "done" | "failed", error?: string) {
  "use step";
  await finishRun(runId, status, error);
}
