import { start } from "workflow/api";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hasApiKey, supportsMode } from "@/lib/engines";
import { planRun, type Task } from "@/lib/runs";
import { USD_TO_EUR } from "@/lib/pricing";
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

/** Arrête un run en cours : annule le workflow (les tâches déjà lancées se terminent) et marque le run. */
export async function cancelRun(runId: string) {
  const db = await getDb();
  const { finishRun } = await import("@/lib/runs");
  const run = await db.query.runs.findFirst({ where: (r, { eq }) => eq(r.id, runId) });
  if (!run) throw new Error("Run introuvable");
  if (run.status !== "running" && run.status !== "pending") return { cancelled: false, status: run.status };
  if (run.workflowRunId) {
    const { getWorld } = await import("workflow/runtime");
    const world = await getWorld();
    await world.events.create(run.workflowRunId, { eventType: "run_cancelled" }).catch(() => undefined);
  }
  await finishRun(runId, "failed", `Arrêté manuellement après ${run.doneCount} tâche(s) sur ${run.plannedCount}`);
  return { cancelled: true, status: "failed" as const };
}

/**
 * Complète un run existant avec un moteur : mêmes prompts actifs et répétitions que le projet,
 * pour ce moteur seul. Les tâches déjà faites (résultat existant) sont ignorées par executeTask,
 * on peut donc relancer sans doublon. Le run repasse en "running" et le workflow le clôturera.
 */
export async function appendEngineToRun(runId: string, engineId: string) {
  const db = await getDb();
  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) });
  if (!run) throw new Error("Run introuvable");
  if (run.status === "running" || run.status === "pending") throw new Error("Run encore en cours");
  const [project, engine] = await Promise.all([
    db.query.projects.findFirst({ where: eq(schema.projects.id, run.projectId) }),
    db.query.engines.findFirst({ where: eq(schema.engines.id, engineId) }),
  ]);
  if (!project) throw new Error("Projet introuvable");
  if (!engine) throw new Error("Moteur introuvable");
  if (!engine.enabled) throw new Error(`Moteur désactivé : ${engine.label}`);
  if (!hasApiKey(engine.provider)) throw new Error(`Clé API absente pour ${engine.label}`);

  const [promptList, existing] = await Promise.all([
    db.query.prompts.findMany({ where: and(eq(schema.prompts.projectId, run.projectId), eq(schema.prompts.active, true)) }),
    db.query.results.findMany({
      where: and(eq(schema.results.runId, runId), eq(schema.results.engineId, engineId)),
      columns: { promptId: true, repeatIndex: true },
    }),
  ]);
  const done = new Set(existing.map((r) => `${r.promptId}:${r.repeatIndex}`));
  const tasks: Task[] = promptList
    .filter((p) => supportsMode(engine.provider, p.webSearch))
    .flatMap((p) => Array.from({ length: project.repeats }, (_, i) => ({ promptId: p.id, engineId, repeatIndex: i })))
    .filter((t) => !done.has(`${t.promptId}:${t.repeatIndex}`));
  if (tasks.length === 0) return { runId, engineId, tasks: 0, workflowRunId: null };

  await db
    .update(schema.runs)
    .set({ status: "running", error: null, finishedAt: null, plannedCount: sql`${schema.runs.plannedCount} + ${tasks.length}` })
    .where(eq(schema.runs.id, runId));
  const started = await start(runWorkflow, [runId, tasks, project.costCapEur / USD_TO_EUR]);
  return { runId, engineId, tasks: tasks.length, workflowRunId: started.runId };
}
