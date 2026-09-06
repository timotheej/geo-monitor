import { start } from "workflow/api";
import { getDb, schema } from "@/db";
import { planRun } from "@/lib/runs";
import { runWorkflow } from "@/workflows/run-workflow";
import type { RunTrigger } from "@/db/schema";

/** Planifie un run puis délègue l'exécution au workflow durable. */
export async function launchRun(projectId: string, trigger: RunTrigger) {
  const plan = await planRun(projectId, trigger);
  if (plan.tasks.length === 0) {
    const { finishRun } = await import("@/lib/runs");
    await finishRun(plan.runId, "failed", "Aucune tâche : vérifier les prompts actifs, les moteurs et les clés API");
    return { runId: plan.runId, tasks: 0, workflowRunId: null };
  }
  const run = await start(runWorkflow, [plan.runId, plan.tasks, plan.costCapUsd]);
  return { runId: plan.runId, tasks: plan.tasks.length, workflowRunId: run.runId };
}

export async function launchAllProjects(trigger: RunTrigger) {
  const db = await getDb();
  const projects = await db.select({ id: schema.projects.id }).from(schema.projects);
  return Promise.all(projects.map((p) => launchRun(p.id, trigger)));
}
