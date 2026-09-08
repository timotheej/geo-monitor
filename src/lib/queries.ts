import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { USD_TO_EUR } from "@/lib/pricing";

/** Toutes les fonctions sont côté serveur, scoping par projet. Les taux sont en 0..1. */

export async function getCurrentProject() {
  const db = await getDb();
  return db.query.projects.findFirst({ with: { competitors: true } });
}

export async function getEngines() {
  const db = await getDb();
  return db.query.engines.findMany({ orderBy: (e, { asc }) => asc(e.createdAt) });
}

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

type RateRow = { total: number; cited: number; mentioned: number };

async function brandRates(projectId: string, from: Date, to?: Date): Promise<RateRow> {
  const db = await getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      cited: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
      mentioned: sql<number>`coalesce(sum(case when ${schema.detections.mentioned} then 1 else 0 end), 0)::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .leftJoin(
      schema.detections,
      and(eq(schema.detections.resultId, schema.results.id), eq(schema.detections.entityType, "brand")),
    )
    .where(
      and(
        eq(schema.runs.projectId, projectId),
        sql`${schema.results.error} is null`,
        gte(schema.results.createdAt, from),
        to ? lt(schema.results.createdAt, to) : undefined,
      ),
    );
  return row ?? { total: 0, cited: 0, mentioned: 0 };
}

export type Overview = {
  days: number;
  answers: number;
  citationRate: number | null;
  mentionRate: number | null;
  shareOfVoice: number | null;
  /** Variation en points vs période précédente, null si pas de données */
  citationDelta: number | null;
  mentionDelta: number | null;
  costMonthEur: number;
  costRunsEur: number;
  costInspectionsEur: number;
};

export async function getOverview(projectId: string, days = 30): Promise<Overview> {
  const db = await getDb();
  const now = new Date();
  const [cur, prev] = await Promise.all([
    brandRates(projectId, since(days)),
    brandRates(projectId, since(days * 2), since(days)),
  ]);
  const rate = (r: RateRow, k: "cited" | "mentioned") => (r.total ? r[k] / r.total : null);

  const [sov] = await db
    .select({
      brand: sql<number>`coalesce(sum(case when ${schema.detections.entityType} = 'brand' and ${schema.detections.cited} then 1 else 0 end), 0)::int`,
      all: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
    })
    .from(schema.detections)
    .innerJoin(schema.results, eq(schema.detections.resultId, schema.results.id))
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, since(days))));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [cost] = await db
    .select({ usd: sql<number>`coalesce(sum(${schema.runs.costEstimate}), 0)::float` })
    .from(schema.runs)
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.runs.startedAt, monthStart)));

  const [insp] = await db
    .select({ usd: sql<number>`coalesce(sum(${schema.inspections.costEstimate}), 0)::float` })
    .from(schema.inspections)
    .where(and(eq(schema.inspections.projectId, projectId), gte(schema.inspections.createdAt, monthStart)));

  const c = rate(cur, "cited");
  const m = rate(cur, "mentioned");
  const pc = rate(prev, "cited");
  const pm = rate(prev, "mentioned");
  return {
    days,
    answers: cur.total,
    citationRate: c,
    mentionRate: m,
    shareOfVoice: sov?.all ? sov.brand / sov.all : null,
    citationDelta: c !== null && pc !== null ? (c - pc) * 100 : null,
    mentionDelta: m !== null && pm !== null ? (m - pm) * 100 : null,
    costMonthEur: ((cost?.usd ?? 0) + (insp?.usd ?? 0)) * USD_TO_EUR,
    costRunsEur: (cost?.usd ?? 0) * USD_TO_EUR,
    costInspectionsEur: (insp?.usd ?? 0) * USD_TO_EUR,
  };
}

export type SeriesPoint = { day: string; engineId: string; engineLabel: string; total: number; cited: number; mentioned: number };

export async function getTimeSeries(projectId: string, days = 30): Promise<SeriesPoint[]> {
  const db = await getDb();
  return db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${schema.results.createdAt}), 'YYYY-MM-DD')`,
      engineId: schema.results.engineId,
      engineLabel: schema.engines.label,
      total: sql<number>`count(*)::int`,
      cited: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
      mentioned: sql<number>`coalesce(sum(case when ${schema.detections.mentioned} then 1 else 0 end), 0)::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .leftJoin(
      schema.detections,
      and(eq(schema.detections.resultId, schema.results.id), eq(schema.detections.entityType, "brand")),
    )
    .where(and(eq(schema.runs.projectId, projectId), sql`${schema.results.error} is null`, gte(schema.results.createdAt, since(days))))
    .groupBy(sql`1`, schema.results.engineId, schema.engines.label)
    .orderBy(sql`1`);
}

export type CellStatus = "cited" | "mentioned" | "none" | "error" | "empty";
export type MatrixRow = {
  prompt: typeof schema.prompts.$inferSelect;
  citationRate: number | null;
  cells: Record<string, { status: CellStatus; resultId: string | null }>;
};

/** Dernier résultat par prompt × moteur, plus taux de citation sur la période. */
export async function getPromptMatrix(projectId: string, days = 30): Promise<MatrixRow[]> {
  const db = await getDb();
  const promptList = await db.query.prompts.findMany({
    where: eq(schema.prompts.projectId, projectId),
    orderBy: (p, { desc }) => [desc(p.active), desc(p.createdAt)],
  });
  if (promptList.length === 0) return [];
  const ids = promptList.map((p) => p.id);

  const latest = await db
    .selectDistinctOn([schema.results.promptId, schema.results.engineId], {
      resultId: schema.results.id,
      promptId: schema.results.promptId,
      engineId: schema.results.engineId,
      error: schema.results.error,
      cited: schema.detections.cited,
      mentioned: schema.detections.mentioned,
    })
    .from(schema.results)
    .leftJoin(
      schema.detections,
      and(eq(schema.detections.resultId, schema.results.id), eq(schema.detections.entityType, "brand")),
    )
    .where(inArray(schema.results.promptId, ids))
    .orderBy(schema.results.promptId, schema.results.engineId, desc(schema.results.createdAt));

  const rates = await db
    .select({
      promptId: schema.results.promptId,
      total: sql<number>`count(*)::int`,
      cited: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
    })
    .from(schema.results)
    .leftJoin(
      schema.detections,
      and(eq(schema.detections.resultId, schema.results.id), eq(schema.detections.entityType, "brand")),
    )
    .where(and(inArray(schema.results.promptId, ids), sql`${schema.results.error} is null`, gte(schema.results.createdAt, since(days))))
    .groupBy(schema.results.promptId);
  const rateById = new Map(rates.map((r) => [r.promptId, r.total ? r.cited / r.total : null]));

  const cellsByPrompt = new Map<string, MatrixRow["cells"]>();
  for (const l of latest) {
    const cells = cellsByPrompt.get(l.promptId) ?? {};
    const status: CellStatus = l.error ? "error" : l.cited ? "cited" : l.mentioned ? "mentioned" : "none";
    cells[l.engineId] = { status, resultId: l.resultId };
    cellsByPrompt.set(l.promptId, cells);
  }

  return promptList.map((prompt) => ({
    prompt,
    citationRate: rateById.get(prompt.id) ?? null,
    cells: cellsByPrompt.get(prompt.id) ?? {},
  }));
}

export type DomainRow = { domain: string; count: number; share: number; entity: "brand" | "competitor" | null; entityName: string | null };

export async function getTopDomains(projectId: string, days = 30, limit = 10): Promise<DomainRow[]> {
  const db = await getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId), with: { competitors: true } });
  if (!project) return [];

  const rows = await db
    .select({
      domain: sql<string>`s->>'domain'`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(sql`jsonb_array_elements(${schema.results.sources}) as s`, sql`true`)
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, since(days))))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`)
    .limit(limit);

  const [tot] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .where(and(eq(schema.runs.projectId, projectId), sql`${schema.results.error} is null`, gte(schema.results.createdAt, since(days))));
  const total = tot?.n ?? 0;

  const match = (d: string) => {
    if (project.domains.some((x) => d === x || d.endsWith(`.${x}`))) return { entity: "brand" as const, entityName: project.brandName };
    const c = project.competitors.find((c) => c.domains.some((x) => d === x || d.endsWith(`.${x}`)));
    return c ? { entity: "competitor" as const, entityName: c.name } : { entity: null, entityName: null };
  };
  return rows.map((r) => ({ domain: r.domain, count: r.count, share: total ? r.count / total : 0, ...match(r.domain) }));
}

export async function getRuns(projectId: string, limit = 50) {
  const db = await getDb();
  return db.query.runs.findMany({ where: eq(schema.runs.projectId, projectId), orderBy: (r, { desc }) => desc(r.startedAt), limit });
}

export async function getRun(runId: string) {
  const db = await getDb();
  const run = await db.query.runs.findFirst({ where: eq(schema.runs.id, runId) });
  if (!run) return null;
  const rows = await db
    .select({
      result: schema.results,
      promptText: schema.prompts.text,
      engineLabel: schema.engines.label,
      cited: schema.detections.cited,
      mentioned: schema.detections.mentioned,
    })
    .from(schema.results)
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .leftJoin(
      schema.detections,
      and(eq(schema.detections.resultId, schema.results.id), eq(schema.detections.entityType, "brand")),
    )
    .where(eq(schema.results.runId, runId))
    .orderBy(schema.results.createdAt);
  return { run, results: rows };
}

/** Résultat complet pour le drawer de détail, avec entités pour le surlignage. */
export async function getResultDetail(resultId: string) {
  const db = await getDb();
  const result = await db.query.results.findFirst({
    where: eq(schema.results.id, resultId),
    with: { prompt: true, engine: true, detections: true, run: true },
  });
  if (!result) return null;
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, result.run.projectId), with: { competitors: true } });
  if (!project) return null;
  const entities = [
    { type: "brand" as const, id: project.id, name: project.brandName, terms: [project.brandName, ...project.aliases], domains: project.domains },
    ...project.competitors.map((c) => ({ type: "competitor" as const, id: c.id, name: c.name, terms: [c.name, ...c.aliases], domains: c.domains })),
  ];
  return { result, entities };
}

export async function getPrompts(projectId: string) {
  const db = await getDb();
  return db.query.prompts.findMany({ where: eq(schema.prompts.projectId, projectId), orderBy: (p, { desc }) => [desc(p.active), desc(p.createdAt)] });
}
