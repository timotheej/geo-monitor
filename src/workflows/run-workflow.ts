import { getWorkflowMetadata } from "workflow";
import { executeTaskStep, finishRunStep, runCostStep, startRunStep } from "./steps";
import type { Task } from "@/lib/runs";

export const CONCURRENCY = 3;

/**
 * Orchestration durable d'un run : les tâches s'exécutent par lots de CONCURRENCY,
 * chaque tâche est une étape idempotente avec retry. Arrêt propre si le plafond
 * de coût est dépassé.
 */
export async function runWorkflow(runId: string, tasks: Task[], costCapUsd: number) {
  "use workflow";
  const { workflowRunId } = getWorkflowMetadata();
  await startRunStep(runId, workflowRunId);

  let errors = 0;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(batch.map((t) => executeTaskStep(runId, t)));
    errors += outcomes.filter((o) => o.error).length;

    const cost = await runCostStep(runId);
    if (cost > costCapUsd) {
      await finishRunStep(runId, "failed", `Plafond de coût dépassé (${cost.toFixed(2)} USD > ${costCapUsd.toFixed(2)} USD)`);
      return { runId, status: "failed" as const, done: i + batch.length, errors };
    }
  }

  const allFailed = tasks.length > 0 && errors === tasks.length;
  await finishRunStep(runId, allFailed ? "failed" : "done", allFailed ? "Toutes les tâches ont échoué" : undefined);
  return { runId, status: allFailed ? ("failed" as const) : ("done" as const), done: tasks.length, errors };
}
