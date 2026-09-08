import { and, asc, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { USD_TO_EUR } from "@/lib/pricing";
import { APP_TIMEZONE } from "@/lib/format";
import { normalizeUrl } from "@/lib/inspect/url";
import type { CellStatus } from "@/lib/queries";

/**
 * Requêtes du dashboard v2. Toutes côté serveur, scoping par projet et période (jours),
 * taux en 0..1. Les dates sont comparées avec gte / lt de Drizzle, jamais dans un
 * fragment sql brut (postgres-js refuse les Date en paramètre brut).
 */

function since(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

const rate = (num: number, den: number): number | null => (den ? num / den : null);
const delta = (cur: number | null, prev: number | null): number | null => (cur !== null && prev !== null ? (cur - prev) * 100 : null);

/** Jointure gauche sur la détection de la marque d'un résultat. */
const brandDetection = and(eq(schema.detections.resultId, schema.results.id), eq(schema.detections.entityType, "brand"));
const brandCited = sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`;
const brandMentioned = sql<number>`coalesce(sum(case when ${schema.detections.mentioned} then 1 else 0 end), 0)::int`;
const noError = sql`${schema.results.error} is null`;

/** Condition "ce domaine appartient à l'un des domaines suivis" (sous-domaines inclus). */
function domainIn(col: SQL, domains: string[]): SQL {
  if (domains.length === 0) return sql`false`;
  return or(...domains.flatMap((d) => [sql`${col} = ${d}`, sql`${col} like ${`%.${d}`}`]))!;
}

function matchDomain(domain: string, domains: string[]): boolean {
  return domains.some((x) => domain === x || domain.endsWith(`.${x}`));
}

type EngineRef = { id: string; label: string; provider: string };

export async function getProjects() {
  const db = await getDb();
  return db.select({ id: schema.projects.id, name: schema.projects.name, brandName: schema.projects.brandName }).from(schema.projects).orderBy(asc(schema.projects.createdAt));
}

async function loadProject(projectId: string) {
  const db = await getDb();
  return db.query.projects.findFirst({ where: eq(schema.projects.id, projectId), with: { competitors: true } });
}

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------

export type EngineCard = {
  id: string;
  label: string;
  model: string;
  provider: string;
  enabled: boolean;
  answers: number;
  citationRate: number | null;
  mentionRate: number | null;
  /** Variation en points vs période précédente */
  citationDelta: number | null;
  mentionDelta: number | null;
  costEur: number;
};

async function engineRates(projectId: string, from: Date, to?: Date) {
  const db = await getDb();
  return db
    .select({
      engineId: schema.results.engineId,
      total: sql<number>`(count(*) filter (where ${schema.results.error} is null))::int`,
      cited: brandCited,
      mentioned: brandMentioned,
      costUsd: sql<number>`coalesce(sum(${schema.results.costEstimate}), 0)::float`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, from), to ? lt(schema.results.createdAt, to) : undefined))
    .groupBy(schema.results.engineId);
}

/** Une carte par moteur : taux, variation et coût sur la période. Les moteurs désactivés sont renvoyés avec enabled=false. */
export async function getEngineCards(projectId: string, days = 30): Promise<EngineCard[]> {
  const db = await getDb();
  const [engines, cur, prev] = await Promise.all([
    db.query.engines.findMany({ orderBy: (e, { asc }) => asc(e.createdAt) }),
    engineRates(projectId, since(days)),
    engineRates(projectId, since(days * 2), since(days)),
  ]);
  const curBy = new Map(cur.map((r) => [r.engineId, r]));
  const prevBy = new Map(prev.map((r) => [r.engineId, r]));
  return engines.map((e) => {
    const c = curBy.get(e.id);
    const p = prevBy.get(e.id);
    const citationRate = c ? rate(c.cited, c.total) : null;
    const mentionRate = c ? rate(c.mentioned, c.total) : null;
    return {
      id: e.id,
      label: e.label,
      model: e.model,
      provider: e.provider,
      enabled: e.enabled,
      answers: c?.total ?? 0,
      citationRate,
      mentionRate,
      citationDelta: delta(citationRate, p ? rate(p.cited, p.total) : null),
      mentionDelta: delta(mentionRate, p ? rate(p.mentioned, p.total) : null),
      costEur: (c?.costUsd ?? 0) * USD_TO_EUR,
    };
  });
}

export type EntityShare = {
  entityType: "brand" | "competitor";
  entityId: string;
  name: string;
  answers: number;
  cited: number;
  mentioned: number;
  citationRate: number | null;
  mentionRate: number | null;
  citationDelta: number | null;
  /** Part des citations de l'entité parmi toutes les citations (marque + concurrents) */
  share: number | null;
  /** Nombre de prompts distincts où l'entité est citée ou mentionnée */
  promptCount: number;
};

async function entityCounts(projectId: string, from: Date, to?: Date) {
  const db = await getDb();
  return db
    .select({
      entityType: schema.detections.entityType,
      entityId: schema.detections.entityId,
      cited: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
      mentioned: sql<number>`coalesce(sum(case when ${schema.detections.mentioned} then 1 else 0 end), 0)::int`,
      promptCount: sql<number>`count(distinct case when ${schema.detections.cited} or ${schema.detections.mentioned} then ${schema.results.promptId} end)::int`,
    })
    .from(schema.detections)
    .innerJoin(schema.results, eq(schema.detections.resultId, schema.results.id))
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, from), to ? lt(schema.results.createdAt, to) : undefined))
    .groupBy(schema.detections.entityType, schema.detections.entityId);
}

async function answersCount(projectId: string, from: Date, to?: Date): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, from), to ? lt(schema.results.createdAt, to) : undefined));
  return row?.n ?? 0;
}

/** Marque et concurrents : taux de citation, mention, variation et share of voice, tri décroissant sur la citation. */
export async function getShareOfVoice(projectId: string, days = 30): Promise<EntityShare[]> {
  const project = await loadProject(projectId);
  if (!project) return [];
  const [cur, prev, answers, prevAnswers] = await Promise.all([
    entityCounts(projectId, since(days)),
    entityCounts(projectId, since(days * 2), since(days)),
    answersCount(projectId, since(days)),
    answersCount(projectId, since(days * 2), since(days)),
  ]);
  const key = (t: string, id: string) => `${t}:${id}`;
  const curBy = new Map(cur.map((r) => [key(r.entityType, r.entityId), r]));
  const prevBy = new Map(prev.map((r) => [key(r.entityType, r.entityId), r]));
  const allCited = cur.reduce((s, r) => s + r.cited, 0);

  const entities = [
    { entityType: "brand" as const, entityId: project.id, name: project.brandName },
    ...project.competitors.map((c) => ({ entityType: "competitor" as const, entityId: c.id, name: c.name })),
  ];
  return entities
    .map((e) => {
      const c = curBy.get(key(e.entityType, e.entityId));
      const p = prevBy.get(key(e.entityType, e.entityId));
      const citationRate = answers ? (c?.cited ?? 0) / answers : null;
      return {
        ...e,
        answers,
        cited: c?.cited ?? 0,
        mentioned: c?.mentioned ?? 0,
        citationRate,
        mentionRate: answers ? (c?.mentioned ?? 0) / answers : null,
        citationDelta: delta(citationRate, prevAnswers ? (p?.cited ?? 0) / prevAnswers : null),
        share: allCited ? (c?.cited ?? 0) / allCited : null,
        promptCount: c?.promptCount ?? 0,
      };
    })
    .sort((a, b) => b.cited - a.cited || b.mentioned - a.mentioned || (a.entityType === "brand" ? -1 : 1));
}

export type Opportunity = {
  promptId: string;
  text: string;
  tags: string[];
  /** Réponses où un concurrent est cité et pas la marque */
  answers: number;
  competitors: Array<{ id: string; name: string; answers: number }>;
};

/** Prompts où un concurrent est cité sans la marque, les plus fréquents d'abord. */
export async function getQuickOpportunities(projectId: string, days = 30, limit = 5): Promise<Opportunity[]> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project) return [];
  const names = new Map(project.competitors.map((c) => [c.id, c.name]));
  const competitorCited = db
    .select({ resultId: schema.detections.resultId, competitorId: schema.detections.entityId })
    .from(schema.detections)
    .where(and(eq(schema.detections.entityType, "competitor"), eq(schema.detections.cited, true)))
    .as("cc");
  const rows = await db
    .select({
      resultId: schema.results.id,
      promptId: schema.results.promptId,
      text: schema.prompts.text,
      tags: schema.prompts.tags,
      competitorId: competitorCited.competitorId,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .innerJoin(competitorCited, eq(competitorCited.resultId, schema.results.id))
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, since(days)), sql`coalesce(${schema.detections.cited}, false) = false`));

  const byPrompt = new Map<string, { promptId: string; text: string; tags: string[]; results: Set<string>; competitors: Map<string, number> }>();
  for (const r of rows) {
    const o = byPrompt.get(r.promptId) ?? { promptId: r.promptId, text: r.text, tags: r.tags, results: new Set<string>(), competitors: new Map<string, number>() };
    o.results.add(r.resultId);
    o.competitors.set(r.competitorId, (o.competitors.get(r.competitorId) ?? 0) + 1);
    byPrompt.set(r.promptId, o);
  }
  return Array.from(byPrompt.values())
    .map((o) => ({
      promptId: o.promptId,
      text: o.text,
      tags: o.tags,
      answers: o.results.size,
      competitors: Array.from(o.competitors, ([id, answers]) => ({ id, name: names.get(id) ?? "Concurrent", answers })).sort((a, b) => b.answers - a.answers),
    }))
    .sort((a, b) => b.answers - a.answers || b.competitors.length - a.competitors.length)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Moteurs et thèmes
// ---------------------------------------------------------------------------

export const NO_THEME = "Sans thème";

type PromptEngineRate = { promptId: string; active: boolean; tags: string[]; engine: EngineRef; total: number; cited: number; mentioned: number };

/** Taux marque par prompt × moteur sur la période, base des vues par thème. */
async function promptEngineRates(projectId: string, days: number): Promise<PromptEngineRate[]> {
  const db = await getDb();
  const rows = await db
    .select({
      promptId: schema.results.promptId,
      active: schema.prompts.active,
      tags: schema.prompts.tags,
      engineId: schema.results.engineId,
      engineLabel: schema.engines.label,
      provider: schema.engines.provider,
      total: sql<number>`count(*)::int`,
      cited: brandCited,
      mentioned: brandMentioned,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, since(days))))
    .groupBy(schema.results.promptId, schema.prompts.active, schema.prompts.tags, schema.results.engineId, schema.engines.label, schema.engines.provider, schema.engines.createdAt)
    // Ordre stable des moteurs (création), identique aux autres écrans.
    .orderBy(asc(schema.engines.createdAt));
  return rows.map((r) => ({
    promptId: r.promptId,
    active: r.active,
    tags: r.tags.length ? r.tags : [NO_THEME],
    engine: { id: r.engineId, label: r.engineLabel, provider: r.provider },
    total: r.total,
    cited: r.cited,
    mentioned: r.mentioned,
  }));
}

export type ThemeCell = { total: number; cited: number; mentioned: number };
export type ThemeMatrix = {
  themes: string[];
  engines: EngineRef[];
  /** cells[theme][engineId] */
  cells: Record<string, Record<string, ThemeCell>>;
};

/** Matrice thème × moteur : taux de citation de la marque par cellule. */
export async function getEngineThemeMatrix(projectId: string, days = 30): Promise<ThemeMatrix> {
  const rows = await promptEngineRates(projectId, days);
  const engines = new Map<string, EngineRef>();
  const cells: ThemeMatrix["cells"] = {};
  for (const r of rows) {
    engines.set(r.engine.id, r.engine);
    for (const tag of r.tags) {
      const row = (cells[tag] ??= {});
      const cell = (row[r.engine.id] ??= { total: 0, cited: 0, mentioned: 0 });
      cell.total += r.total;
      cell.cited += r.cited;
      cell.mentioned += r.mentioned;
    }
  }
  const themes = Object.keys(cells).sort((a, b) => (a === NO_THEME ? 1 : b === NO_THEME ? -1 : a.localeCompare(b, "fr")));
  return { themes, engines: Array.from(engines.values()), cells };
}

export type ThemeRow = {
  theme: string;
  promptCount: number;
  answers: number;
  citationRate: number | null;
  mentionRate: number | null;
  engines: Array<EngineRef & ThemeCell>;
};

/** Un bloc par thème (tag) : taux marque, nombre de prompts, détail par moteur. */
export async function getThemeSummary(projectId: string, days = 30): Promise<ThemeRow[]> {
  const db = await getDb();
  const [rows, prompts] = await Promise.all([
    promptEngineRates(projectId, days),
    db.select({ tags: schema.prompts.tags, active: schema.prompts.active }).from(schema.prompts).where(eq(schema.prompts.projectId, projectId)),
  ]);
  const promptCount = new Map<string, number>();
  for (const p of prompts) for (const tag of p.tags.length ? p.tags : [NO_THEME]) promptCount.set(tag, (promptCount.get(tag) ?? 0) + 1);

  const agg = new Map<string, { total: number; cited: number; mentioned: number; engines: Map<string, EngineRef & ThemeCell> }>();
  for (const r of rows) {
    for (const tag of r.tags) {
      const t = agg.get(tag) ?? { total: 0, cited: 0, mentioned: 0, engines: new Map() };
      t.total += r.total;
      t.cited += r.cited;
      t.mentioned += r.mentioned;
      const e = t.engines.get(r.engine.id) ?? { ...r.engine, total: 0, cited: 0, mentioned: 0 };
      e.total += r.total;
      e.cited += r.cited;
      e.mentioned += r.mentioned;
      t.engines.set(r.engine.id, e);
      agg.set(tag, t);
    }
  }
  const themes = new Set([...promptCount.keys(), ...agg.keys()]);
  return Array.from(themes)
    .map((theme) => {
      const t = agg.get(theme);
      return {
        theme,
        promptCount: promptCount.get(theme) ?? 0,
        answers: t?.total ?? 0,
        citationRate: t ? rate(t.cited, t.total) : null,
        mentionRate: t ? rate(t.mentioned, t.total) : null,
        engines: t ? Array.from(t.engines.values()) : [],
      };
    })
    .sort((a, b) => {
      if (a.theme === NO_THEME) return 1;
      if (b.theme === NO_THEME) return -1;
      return (b.citationRate ?? -1) - (a.citationRate ?? -1) || a.theme.localeCompare(b.theme, "fr");
    });
}

export type EngineDomain = { domain: string; count: number; entity: "brand" | "competitor" | null; entityName: string | null };

/** Pour chaque moteur, ses domaines les plus cités sur la période. */
export async function getEngineDomains(projectId: string, days = 30, limit = 8): Promise<Array<{ engine: EngineRef; answers: number; domains: EngineDomain[] }>> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project) return [];
  const [rows, engines] = await Promise.all([
    db
      .select({
        engineId: schema.results.engineId,
        domain: sql<string>`s->>'domain'`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.results)
      .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
      .innerJoin(sql`jsonb_array_elements(${schema.results.sources}) as s`, sql`true`)
      .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, since(days))))
      .groupBy(schema.results.engineId, sql`2`)
      .orderBy(sql`3 desc`, sql`2 asc`),
    db.query.engines.findMany({ orderBy: (e, { asc }) => asc(e.createdAt) }),
  ]);
  const cur = await engineRates(projectId, since(days));
  const answersBy = new Map(cur.map((r) => [r.engineId, r.total]));

  const match = (d: string): Pick<EngineDomain, "entity" | "entityName"> => {
    if (matchDomain(d, project.domains)) return { entity: "brand", entityName: project.brandName };
    const c = project.competitors.find((c) => matchDomain(d, c.domains));
    return c ? { entity: "competitor", entityName: c.name } : { entity: null, entityName: null };
  };
  return engines
    .filter((e) => answersBy.has(e.id))
    .map((e) => ({
      engine: { id: e.id, label: e.label, provider: e.provider },
      answers: answersBy.get(e.id) ?? 0,
      domains: rows
        .filter((r) => r.engineId === e.id)
        .slice(0, limit)
        .map((r) => ({ domain: r.domain, count: r.count, ...match(r.domain) })),
    }));
}

export type EngineStats = {
  engine: EngineRef;
  model: string;
  answers: number;
  errors: number;
  medianLatencyMs: number | null;
  avgCostEur: number | null;
  avgSources: number | null;
  /** Part des réponses avec au moins une source */
  withSourcesRate: number | null;
};

/** Chiffres clés par moteur : latence médiane, coût moyen, sources moyennes, part avec sources. */
export async function getEngineStats(projectId: string, days = 30): Promise<EngineStats[]> {
  const db = await getDb();
  const rows = await db
    .select({
      engineId: schema.results.engineId,
      label: schema.engines.label,
      provider: schema.engines.provider,
      model: schema.engines.model,
      answers: sql<number>`(count(*) filter (where ${schema.results.error} is null))::int`,
      errors: sql<number>`(count(*) filter (where ${schema.results.error} is not null))::int`,
      medianLatencyMs: sql<number | null>`(percentile_cont(0.5) within group (order by ${schema.results.latencyMs}) filter (where ${schema.results.error} is null))::float`,
      avgCostUsd: sql<number | null>`(avg(${schema.results.costEstimate}) filter (where ${schema.results.error} is null))::float`,
      avgSources: sql<number | null>`(avg(jsonb_array_length(${schema.results.sources})) filter (where ${schema.results.error} is null))::float`,
      withSources: sql<number>`(count(*) filter (where ${schema.results.error} is null and jsonb_array_length(${schema.results.sources}) > 0))::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, since(days))))
    .groupBy(schema.results.engineId, schema.engines.label, schema.engines.provider, schema.engines.model, schema.engines.createdAt)
    .orderBy(asc(schema.engines.createdAt));
  return rows.map((r) => ({
    engine: { id: r.engineId, label: r.label, provider: r.provider },
    model: r.model,
    answers: r.answers,
    errors: r.errors,
    medianLatencyMs: r.medianLatencyMs === null ? null : Math.round(r.medianLatencyMs),
    avgCostEur: r.avgCostUsd === null ? null : r.avgCostUsd * USD_TO_EUR,
    avgSources: r.avgSources,
    withSourcesRate: rate(r.withSources, r.answers),
  }));
}

// ---------------------------------------------------------------------------
// Fiche prompt
// ---------------------------------------------------------------------------

export async function getPrompt(promptId: string) {
  const db = await getDb();
  return db.query.prompts.findFirst({ where: eq(schema.prompts.id, promptId) });
}

export type PromptResult = {
  id: string;
  runId: string;
  engine: EngineRef;
  createdAt: Date;
  status: CellStatus;
  cited: boolean;
  mentioned: boolean;
  error: string | null;
  sourcesCount: number;
  latencyMs: number;
  costEur: number;
  /** Concurrents cités dans cette réponse */
  competitors: string[];
};

/** Réponses d'un prompt sur la période, chronologiques, avec l'état marque et les concurrents cités. */
export async function getPromptHistory(promptId: string, days = 30): Promise<PromptResult[]> {
  const db = await getDb();
  const prompt = await getPrompt(promptId);
  if (!prompt) return [];
  const project = await loadProject(prompt.projectId);
  const names = new Map((project?.competitors ?? []).map((c) => [c.id, c.name]));

  const rows = await db
    .select({
      id: schema.results.id,
      runId: schema.results.runId,
      engineId: schema.results.engineId,
      engineLabel: schema.engines.label,
      provider: schema.engines.provider,
      createdAt: schema.results.createdAt,
      error: schema.results.error,
      sourcesCount: sql<number>`jsonb_array_length(${schema.results.sources})::int`,
      latencyMs: schema.results.latencyMs,
      costUsd: schema.results.costEstimate,
      cited: schema.detections.cited,
      mentioned: schema.detections.mentioned,
    })
    .from(schema.results)
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.results.promptId, promptId), gte(schema.results.createdAt, since(days))))
    .orderBy(asc(schema.results.createdAt), asc(schema.engines.createdAt));
  if (rows.length === 0) return [];

  const comps = await db
    .select({ resultId: schema.detections.resultId, entityId: schema.detections.entityId })
    .from(schema.detections)
    .where(
      and(
        inArray(
          schema.detections.resultId,
          rows.map((r) => r.id),
        ),
        eq(schema.detections.entityType, "competitor"),
        eq(schema.detections.cited, true),
      ),
    );
  const compsBy = new Map<string, string[]>();
  for (const c of comps) compsBy.set(c.resultId, [...(compsBy.get(c.resultId) ?? []), names.get(c.entityId) ?? "Concurrent"]);

  return rows.map((r) => ({
    id: r.id,
    runId: r.runId,
    engine: { id: r.engineId, label: r.engineLabel, provider: r.provider },
    createdAt: r.createdAt,
    status: r.error ? "error" : r.cited ? "cited" : r.mentioned ? "mentioned" : "none",
    cited: Boolean(r.cited),
    mentioned: Boolean(r.mentioned),
    error: r.error,
    sourcesCount: r.sourcesCount,
    latencyMs: r.latencyMs,
    costEur: r.costUsd * USD_TO_EUR,
    competitors: compsBy.get(r.id) ?? [],
  }));
}

export type PromptCompetitor = { id: string; name: string; cited: number; mentioned: number; answers: number };

/** Concurrents détectés sur un prompt (citations et mentions) sur la période. */
export async function getPromptCompetitors(promptId: string, days = 30): Promise<PromptCompetitor[]> {
  const db = await getDb();
  const prompt = await getPrompt(promptId);
  if (!prompt) return [];
  const project = await loadProject(prompt.projectId);
  if (!project) return [];
  const rows = await db
    .select({
      entityId: schema.detections.entityId,
      cited: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
      mentioned: sql<number>`coalesce(sum(case when ${schema.detections.mentioned} then 1 else 0 end), 0)::int`,
    })
    .from(schema.detections)
    .innerJoin(schema.results, eq(schema.detections.resultId, schema.results.id))
    .where(and(eq(schema.results.promptId, promptId), noError, eq(schema.detections.entityType, "competitor"), gte(schema.results.createdAt, since(days))))
    .groupBy(schema.detections.entityId);
  const [tot] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.results)
    .where(and(eq(schema.results.promptId, promptId), noError, gte(schema.results.createdAt, since(days))));
  const by = new Map(rows.map((r) => [r.entityId, r]));
  return project.competitors
    .map((c) => ({ id: c.id, name: c.name, cited: by.get(c.id)?.cited ?? 0, mentioned: by.get(c.id)?.mentioned ?? 0, answers: tot?.n ?? 0 }))
    .sort((a, b) => b.cited - a.cited || b.mentioned - a.mentioned);
}

// ---------------------------------------------------------------------------
// Concurrents
// ---------------------------------------------------------------------------

export type SovPoint = { day: string; entityType: "brand" | "competitor"; entityId: string; name: string; cited: number };

/** Citations par jour et par entité, pour la courbe de share of voice. */
export async function getShareOfVoiceSeries(projectId: string, days = 30): Promise<SovPoint[]> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project) return [];
  const names = new Map<string, string>([[project.id, project.brandName], ...project.competitors.map((c) => [c.id, c.name] as [string, string])]);
  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${schema.results.createdAt} at time zone ${APP_TIMEZONE}), 'YYYY-MM-DD')`,
      entityType: schema.detections.entityType,
      entityId: schema.detections.entityId,
      cited: sql<number>`coalesce(sum(case when ${schema.detections.cited} then 1 else 0 end), 0)::int`,
    })
    .from(schema.detections)
    .innerJoin(schema.results, eq(schema.detections.resultId, schema.results.id))
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, since(days))))
    .groupBy(sql`1`, schema.detections.entityType, schema.detections.entityId)
    .orderBy(sql`1`);
  return rows.map((r) => ({ ...r, name: names.get(r.entityId) ?? "Concurrent" }));
}

export type CompetitorOverlap = {
  id: string;
  name: string;
  /** Prompts où ce concurrent est cité et pas la marque */
  prompts: Array<{ promptId: string; text: string; answers: number }>;
  /** Pages du concurrent les plus citées */
  pages: Array<{ url: string; count: number }>;
};

/** Pour chaque concurrent : recouvrement (cité sans nous) et pages les plus citées. */
export async function getCompetitorOverlap(projectId: string, days = 30, limit = 8): Promise<CompetitorOverlap[]> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project) return [];

  const competitorCited = db
    .select({ resultId: schema.detections.resultId, competitorId: schema.detections.entityId })
    .from(schema.detections)
    .where(and(eq(schema.detections.entityType, "competitor"), eq(schema.detections.cited, true)))
    .as("cc");
  const overlap = await db
    .select({
      competitorId: competitorCited.competitorId,
      promptId: schema.results.promptId,
      text: schema.prompts.text,
      answers: sql<number>`count(distinct ${schema.results.id})::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .innerJoin(competitorCited, eq(competitorCited.resultId, schema.results.id))
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, since(days)), sql`coalesce(${schema.detections.cited}, false) = false`))
    .groupBy(competitorCited.competitorId, schema.results.promptId, schema.prompts.text)
    .orderBy(sql`4 desc`);

  const allDomains = project.competitors.flatMap((c) => c.domains);
  const urls =
    allDomains.length === 0
      ? []
      : await db
          .select({ url: sql<string>`s->>'url'`, domain: sql<string>`s->>'domain'`, count: sql<number>`count(*)::int` })
          .from(schema.results)
          .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
          .innerJoin(sql`jsonb_array_elements(${schema.results.sources}) as s`, sql`true`)
          .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, since(days)), domainIn(sql`s->>'domain'`, allDomains)))
          .groupBy(sql`1`, sql`2`);

  return project.competitors.map((c) => {
    const pages = new Map<string, { url: string; count: number }>();
    for (const u of urls) {
      if (!matchDomain(u.domain, c.domains)) continue;
      const key = normalizeUrl(u.url) ?? u.url;
      const p = pages.get(key) ?? { url: u.url, count: 0 };
      p.count += u.count;
      pages.set(key, p);
    }
    return {
      id: c.id,
      name: c.name,
      prompts: overlap.filter((o) => o.competitorId === c.id).map(({ promptId, text, answers }) => ({ promptId, text, answers })).slice(0, limit),
      pages: Array.from(pages.values()).sort((a, b) => b.count - a.count).slice(0, limit),
    };
  });
}

// ---------------------------------------------------------------------------
// Sources et opportunités
// ---------------------------------------------------------------------------

export type DomainOpportunity = {
  domain: string;
  /** Réponses citant ce domaine sur la période */
  answers: number;
  /** Réponses citant ce domaine sans citer la marque */
  withoutBrand: number;
  /** Vrai si la marque est citée dans au moins une réponse où ce domaine apparaît */
  brandPresent: boolean;
  engines: EngineRef[];
  entity: "competitor" | null;
  entityName: string | null;
};

/** Domaines cités quand la marque ne l'est pas, hors domaines de la marque. */
export async function getDomainsInsteadOfUs(projectId: string, days = 30, limit = 30): Promise<DomainOpportunity[]> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project) return [];
  const rows = await db
    .select({
      domain: sql<string>`s->>'domain'`,
      engineId: schema.results.engineId,
      engineLabel: schema.engines.label,
      provider: schema.engines.provider,
      answers: sql<number>`count(distinct ${schema.results.id})::int`,
      withBrand: sql<number>`count(distinct case when ${schema.detections.cited} then ${schema.results.id} end)::int`,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .innerJoin(sql`jsonb_array_elements(${schema.results.sources}) as s`, sql`true`)
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, since(days))))
    .groupBy(sql`1`, schema.results.engineId, schema.engines.label, schema.engines.provider);

  const by = new Map<string, DomainOpportunity>();
  for (const r of rows) {
    if (matchDomain(r.domain, project.domains)) continue;
    const c = project.competitors.find((c) => matchDomain(r.domain, c.domains));
    const d = by.get(r.domain) ?? {
      domain: r.domain,
      answers: 0,
      withoutBrand: 0,
      brandPresent: false,
      engines: [],
      entity: c ? ("competitor" as const) : null,
      entityName: c?.name ?? null,
    };
    d.answers += r.answers;
    d.withoutBrand += r.answers - r.withBrand;
    d.brandPresent = d.brandPresent || r.withBrand > 0;
    if (!d.engines.some((e) => e.id === r.engineId)) d.engines.push({ id: r.engineId, label: r.engineLabel, provider: r.provider });
    by.set(r.domain, d);
  }
  return Array.from(by.values())
    .filter((d) => d.withoutBrand > 0)
    .sort((a, b) => b.withoutBrand - a.withoutBrand || b.answers - a.answers)
    .slice(0, limit);
}

export type BrandPageCitation = {
  resultId: string;
  promptId: string;
  promptText: string;
  engine: EngineRef;
  date: Date;
  /** Rang de la page parmi les sources de la réponse */
  rank: number;
  /** Faux si la page a seulement été lue par la recherche sans être utilisée */
  cited: boolean;
};

export type BrandPage = { url: string; count: number; promptCount: number; engines: EngineRef[]; citations: BrandPageCitation[] };

/** Pages de la marque apparues dans les sources : citations, prompts et moteurs concernés, avec le détail par réponse. */
export async function getBrandPages(projectId: string, days = 30, limit = 50): Promise<BrandPage[]> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project || project.domains.length === 0) return [];
  const rows = await db
    .select({
      url: sql<string>`s.src->>'url'`,
      cited: sql<boolean>`coalesce((s.src->>'cited')::boolean, true)`,
      rank: sql<number>`(s.ord)::int`,
      resultId: schema.results.id,
      date: schema.results.createdAt,
      promptId: schema.results.promptId,
      promptText: schema.prompts.text,
      engineId: schema.results.engineId,
      engineLabel: schema.engines.label,
      provider: schema.engines.provider,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .innerJoin(schema.engines, eq(schema.results.engineId, schema.engines.id))
    .innerJoin(sql`jsonb_array_elements(${schema.results.sources}) with ordinality as s(src, ord)`, sql`true`)
    .where(and(eq(schema.runs.projectId, projectId), gte(schema.results.createdAt, since(days)), domainIn(sql`s.src->>'domain'`, project.domains)))
    .orderBy(desc(schema.results.createdAt), sql`s.ord`);

  const by = new Map<string, BrandPage & { prompts: Set<string>; seen: Set<string> }>();
  for (const r of rows) {
    const key = normalizeUrl(r.url) ?? r.url;
    const p = by.get(key) ?? { url: r.url, count: 0, promptCount: 0, engines: [], citations: [], prompts: new Set<string>(), seen: new Set<string>() };
    p.count += 1;
    p.prompts.add(r.promptId);
    const engine = { id: r.engineId, label: r.engineLabel, provider: r.provider };
    if (!p.engines.some((e) => e.id === r.engineId)) p.engines.push(engine);
    if (!p.seen.has(r.resultId)) {
      p.seen.add(r.resultId);
      p.citations.push({ resultId: r.resultId, promptId: r.promptId, promptText: r.promptText, engine, date: r.date, rank: r.rank, cited: r.cited });
    }
    by.set(key, p);
  }
  return Array.from(by.values())
    .map((p) => ({ url: p.url, count: p.count, engines: p.engines, citations: p.citations, promptCount: p.prompts.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export type PromptWithoutBrand = {
  promptId: string;
  text: string;
  tags: string[];
  answers: number;
  mentioned: number;
  competitors: string[];
};

/** Prompts avec des réponses mais jamais cités sur la période, tri par nombre de concurrents cités. */
export async function getPromptsWithoutBrand(projectId: string, days = 30): Promise<PromptWithoutBrand[]> {
  const db = await getDb();
  const project = await loadProject(projectId);
  if (!project) return [];
  const names = new Map(project.competitors.map((c) => [c.id, c.name]));

  const perPrompt = await db
    .select({
      promptId: schema.results.promptId,
      text: schema.prompts.text,
      tags: schema.prompts.tags,
      answers: sql<number>`count(*)::int`,
      cited: brandCited,
      mentioned: brandMentioned,
    })
    .from(schema.results)
    .innerJoin(schema.runs, eq(schema.results.runId, schema.runs.id))
    .innerJoin(schema.prompts, eq(schema.results.promptId, schema.prompts.id))
    .leftJoin(schema.detections, brandDetection)
    .where(and(eq(schema.runs.projectId, projectId), noError, gte(schema.results.createdAt, since(days))))
    .groupBy(schema.results.promptId, schema.prompts.text, schema.prompts.tags);
  const never = perPrompt.filter((p) => p.cited === 0);
  if (never.length === 0) return [];

  const comps = await db
    .select({ promptId: schema.results.promptId, entityId: schema.detections.entityId })
    .from(schema.detections)
    .innerJoin(schema.results, eq(schema.detections.resultId, schema.results.id))
    .where(
      and(
        inArray(
          schema.results.promptId,
          never.map((p) => p.promptId),
        ),
        eq(schema.detections.entityType, "competitor"),
        eq(schema.detections.cited, true),
        gte(schema.results.createdAt, since(days)),
      ),
    )
    .groupBy(schema.results.promptId, schema.detections.entityId);
  const compsBy = new Map<string, Set<string>>();
  for (const c of comps) compsBy.set(c.promptId, new Set([...(compsBy.get(c.promptId) ?? []), names.get(c.entityId) ?? "Concurrent"]));

  return never
    .map((p) => ({
      promptId: p.promptId,
      text: p.text,
      tags: p.tags,
      answers: p.answers,
      mentioned: p.mentioned,
      competitors: Array.from(compsBy.get(p.promptId) ?? []).sort(),
    }))
    .sort((a, b) => b.competitors.length - a.competitors.length || b.answers - a.answers);
}

