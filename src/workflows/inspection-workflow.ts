import { getWorkflowMetadata } from "workflow";
import { answerInspectionStep, finishInspectionStep, inspectionCostStep, startInspectionStep } from "./steps";
import type { InspectionTask } from "@/lib/inspect/service";

const CONCURRENCY = 3;

/** Étape B d'une inspection : questions × moteurs par lots, plafond de coût, arrêt propre. */
export async function inspectionWorkflow(inspectionId: string, tasks: InspectionTask[], costCapUsd: number) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await startInspectionStep(inspectionId, workflowRunId);

  let errors = 0;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(batch.map((t) => answerInspectionStep(inspectionId, t)));
    errors += outcomes.filter((o) => o.error).length;
    const cost = await inspectionCostStep(inspectionId);
    if (cost > costCapUsd) {
      await finishInspectionStep(inspectionId, "failed", `Plafond de coût dépassé (${cost.toFixed(2)} USD > ${costCapUsd.toFixed(2)} USD)`);
      return { inspectionId, status: "failed" as const };
    }
  }
  const allFailed = tasks.length > 0 && errors === tasks.length;
  await finishInspectionStep(inspectionId, allFailed ? "failed" : "done", allFailed ? "Toutes les questions ont échoué" : undefined);
  return { inspectionId, status: allFailed ? ("failed" as const) : ("done" as const) };
}
