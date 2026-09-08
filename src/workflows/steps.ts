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

// ---------- Inspection d'URL ----------
import { answerInspectionQuestion, finishInspection, getInspectionCost, setInspectionWorkflow, type InspectionTask } from "@/lib/inspect/service";

export async function startInspectionStep(inspectionId: string, workflowRunId: string) {
  "use step";
  await setInspectionWorkflow(inspectionId, workflowRunId);
}

export async function answerInspectionStep(inspectionId: string, task: InspectionTask) {
  "use step";
  return answerInspectionQuestion(inspectionId, task);
}

export async function inspectionCostStep(inspectionId: string) {
  "use step";
  return getInspectionCost(inspectionId);
}

export async function finishInspectionStep(inspectionId: string, status: "done" | "failed", error?: string) {
  "use step";
  await finishInspection(inspectionId, status, error);
}
