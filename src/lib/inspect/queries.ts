import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { hasApiKey } from "@/lib/engines";
import { MODEL_PRICING, DEFAULT_PRICING } from "@/lib/pricing";
import { normalizeUrl } from "./url";

export async function getInspections(projectId: string, limit = 50) {
  const db = await getDb();
  return db.query.inspections.findMany({ where: eq(schema.inspections.projectId, projectId), orderBy: desc(schema.inspections.createdAt), limit });
}

export async function getInspection(id: string) {
  const db = await getDb();
  const inspection = await db.query.inspections.findFirst({
    where: eq(schema.inspections.id, id),
    with: { answers: { with: { engine: true }, orderBy: (a, { asc }) => [asc(a.questionIndex), asc(a.createdAt)] }, project: { with: { competitors: true } } },
  });
  if (!inspection) return null;
  const engines = await db.query.engines.findMany({ orderBy: (e, { asc }) => asc(e.createdAt) });
  return { inspection, engines: engines.map((e) => ({ ...e, hasKey: hasApiKey(e.provider) })) };
}

/** Coût moyen réel par réponse et par moteur (runs quotidiens), pour l'estimation avant lancement. */
export async function getEngineAvgCost(): Promise<Record<string, number>> {
  const db = await getDb();
  const engines = await db.query.engines.findMany();
  const rows = await db
    .select({ engineId: schema.results.engineId, avg: sql<number>`avg(${schema.results.costEstimate})::float` })
    .from(schema.results)
    .where(and(sql`${schema.results.error} is null`, eq(schema.results.webSearch, true)))
    .groupBy(schema.results.engineId);
  const measured = new Map(rows.map((r) => [r.engineId, r.avg]));
  const out: Record<string, number> = {};
  for (const e of engines) {
    const p = e.config.pricing ?? MODEL_PRICING[e.model] ?? DEFAULT_PRICING[e.provider];
    // Sans mesure : 8 000 tokens d'entrée, 400 de sortie, une recherche.
    out[e.id] = measured.get(e.id) ?? (8000 / 1e6) * p.inputPerMTok + (400 / 1e6) * p.outputPerMTok + p.perSearch;
  }
  return out;
}

export type UrlHistoryRow = { resultId: string; date: Date; promptText: string; engineLabel: string; rank: number };

/** Apparitions de l'URL dans les sources des runs quotidiens (paramètres ignorés). */
export async function getUrlHistory(projectId: string, url: string, days = 90): Promise<UrlHistoryRow[]> {
  const n = normalizeUrl(url);
  if (!n) return [];
  const bare = n.split("?")[0];
  const db = await getDb();
  const norm = (col: string) => sql.raw(`rtrim(regexp_replace(regexp_replace(lower(${col}), '^https?://(www\\.)?', ''), '[?#].*$', ''), '/')`);
  return db
    .select({
      resultId: schema.results.id,
      date: schema.results.createdAt,
      promptText: schema.prompts.text,
      engineLabel: schema.engines.label,
      rank: sql<number>`(s.ord)::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .innerJoin(sql`jsonb_array_elements(${schema.results.sources}) with ordinality as s(src, ord)`, sql`true`)
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, new Date(Date.now() - days * 86_400_000)), sql`${norm("s.src->>'url'")} = ${bare}`))
    .orderBy(desc(schema.results.createdAt));
}

export async function getInspectionsCostSince(projectId: string, since: Date): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ usd: sql<number>`coalesce(sum(${schema.inspections.costEstimate}), 0)::float` })
    .from(schema.inspections)
    .where(and(eq(schema.inspections.projectId, projectId), gte(schema.inspections.createdAt, since)));
  return row?.usd ?? 0;
}
