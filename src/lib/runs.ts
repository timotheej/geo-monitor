import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Competitor, Engine, Project, Prompt, RunTrigger } from "@/db/schema";
import { detect, type Entity } from "@/lib/detection";
import { EngineError, hasApiKey, runPromptWithRetry, supportsMode } from "@/lib/engines";
import { estimateCostUsd, USD_TO_EUR } from "@/lib/pricing";

export type Task = { promptId: string; engineId: string; repeatIndex: number };

export type RunPlan = {
  runId: string;
  tasks: Task[];
  costCapUsd: number;
};

/** Crée le run et la liste des tâches. Les tâches sont entrelacées par moteur pour lisser les rate limits. */
export async function planRun(projectId: string, trigger: RunTrigger): Promise<RunPlan> {
  const db = await getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId) });
  if (!project) throw new Error(`Projet introuvable : ${projectId}`);

  const [promptList, engineList] = await Promise.all([
    db.query.prompts.findMany({ where: and(eq(schema.prompts.projectId, projectId), eq(schema.prompts.active, true)) }),
    db.query.engines.findMany({ where: eq(schema.engines.enabled, true) }),
  ]);
  const usable = engineList.filter((e) => hasApiKey(e.provider));

  const perEngine: Task[][] = usable.map((engine) =>
    promptList
      .filter((p) => supportsMode(engine.provider, p.webSearch))
      .flatMap((p) => Array.from({ length: project.repeats }, (_, i) => ({ promptId: p.id, engineId: engine.id, repeatIndex: i }))),
  );
  const tasks: Task[] = [];
  const max = Math.max(0, ...perEngine.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const list of perEngine) if (list[i]) tasks.push(list[i]);

  const [run] = await db
    .insert(schema.runs)
    .values({ projectId, trigger, status: "pending", plannedCount: tasks.length })
    .returning({ id: schema.runs.id });

  return { runId: run.id, tasks, costCapUsd: project.costCapEur / USD_TO_EUR };
}

export async function markRunRunning(runId: string, workflowRunId?: string) {
  const db = await getDb();
  await db
    .update(schema.runs)
    .set({ status: "running", ...(workflowRunId ? { workflowRunId } : {}) })
    .where(eq(schema.runs.id, runId));
}

export async function finishRun(runId: string, status: "done" | "failed", error?: string) {
  const db = await getDb();
  await db.update(schema.runs).set({ status, error: error ?? null, finishedAt: new Date() }).where(eq(schema.runs.id, runId));
}

export function entitiesFor(project: Project, competitors: Competitor[]): Entity[] {
  return [
    { type: "brand", id: project.id, terms: [project.brandName, ...project.aliases], domains: project.domains },
    ...competitors.map((c) => ({ type: "competitor" as const, id: c.id, terms: [c.name, ...c.aliases], domains: c.domains })),
  ];
}

export type TaskOutcome = { costUsd: number; error: string | null; skipped: boolean };

/**
 * Exécute une tâche et persiste résultat + détections. Idempotent : si le résultat
 * existe déjà pour (run, prompt, moteur, répétition), ne refait pas l'appel.
 */
export async function executeTask(runId: string, task: Task): Promise<TaskOutcome> {
  const db = await getDb();
  const existing = await db.query.results.findFirst({
    where: and(
      eq(schema.results.runId, runId),
      eq(schema.results.promptId, task.promptId),
      eq(schema.results.engineId, task.engineId),
      eq(schema.results.repeatIndex, task.repeatIndex),
    ),
    columns: { costEstimate: true, error: true },
  });
  if (existing) return { costUsd: existing.costEstimate, error: existing.error, skipped: true };

  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) });
  if (!run) throw new Error(`Run introuvable : ${runId}`);
  const [project, prompt, engine, competitors] = await Promise.all([
    db.query.projects.findFirst({ where: eq(schema.projects.id, run.projectId) }),
    db.query.prompts.findFirst({ where: eq(schema.prompts.id, task.promptId) }),
    db.query.engines.findFirst({ where: eq(schema.engines.id, task.engineId) }),
    db.query.competitors.findMany({ where: eq(schema.competitors.projectId, run.projectId) }),
  ]);
  if (!project || !prompt || !engine) throw new Error("Projet, prompt ou moteur introuvable");

  const outcome = await callEngine(engine, prompt, project);

  const [inserted] = await db
    .insert(schema.results)
    .values({
      runId,
      promptId: task.promptId,
      engineId: task.engineId,
      repeatIndex: task.repeatIndex,
      webSearch: prompt.webSearch,
      rawText: outcome.text,
      sources: outcome.sources,
      usage: outcome.usage,
      costEstimate: outcome.costUsd,
      latencyMs: outcome.latencyMs,
      error: outcome.error,
    })
    .onConflictDoNothing()
    .returning({ id: schema.results.id });

  if (inserted && !outcome.error) {
    const found = detect(outcome.text, outcome.sources, entitiesFor(project, competitors));
    if (found.length) await db.insert(schema.detections).values(found.map((d) => ({ ...d, resultId: inserted.id })));
  }

  await db
    .update(schema.runs)
    .set({
      doneCount: sql`${schema.runs.doneCount} + 1`,
      errorCount: sql`${schema.runs.errorCount} + ${outcome.error ? 1 : 0}`,
      costEstimate: sql`${schema.runs.costEstimate} + ${outcome.costUsd}`,
    })
    .where(eq(schema.runs.id, runId));

  return { costUsd: outcome.costUsd, error: outcome.error, skipped: false };
}

async function callEngine(engine: Engine, prompt: Prompt, project: Project) {
  const country = project.locale.split("-")[1] ?? "FR";
  try {
    const answer = await runPromptWithRetry(engine, prompt.text, { webSearch: prompt.webSearch, lang: prompt.lang, country });
    return { ...answer, costUsd: estimateCostUsd(engine.provider, engine.config, answer.usage, engine.model), error: null };
  } catch (err) {
    const message = err instanceof EngineError ? `${err.status ?? ""} ${err.message}`.trim() : String(err);
    return { text: "", sources: [], usage: {}, latencyMs: 0, costUsd: 0, error: message };
  }
}

export async function getRunCost(runId: string): Promise<number> {
  const db = await getDb();
  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId), columns: { costEstimate: true } });
  return run?.costEstimate ?? 0;
}
