import { createHash } from "node:crypto";
import { and, count, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AccessSnapshot, Engine, InspectionQuestion, PageSnapshot, Project, SourceRef } from "@/db/schema";
import { hasApiKey, runPromptWithRetry, EngineError } from "@/lib/engines";
import { estimateCostUsd, USD_TO_EUR } from "@/lib/pricing";
import { normalizeUrl, originOf, sameSite, urlMatches } from "./url";
import { fetchRobots, hasLlmsTxt, safeFetch, FetchPageError } from "./fetch";
import { UnsafeUrlError } from "./net-guard";
import { evaluateRobots } from "./robots";
import { extractPage } from "./extract";
import { forbiddenTerms, generateQuestions, violatesNeutrality } from "./questions";

export class InspectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InspectionError";
  }
}

const QUESTION_CACHE_DAYS = 7;
const DEDUPE_MINUTES = 60;
export const MAX_QUESTIONS = 5;

async function guardCaps(project: Project) {
  const db = await getDb();
  const [running] = await db
    .select({ n: count() })
    .from(schema.inspections)
    .where(and(eq(schema.inspections.projectId, project.id), eq(schema.inspections.status, "running")));
  if (running.n > 0) throw new InspectionError("Une inspection est déjà en cours, attendez sa fin.");
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const [today] = await db
    .select({ n: count() })
    .from(schema.inspections)
    .where(and(eq(schema.inspections.projectId, project.id), gte(schema.inspections.createdAt, dayStart)));
  if (today.n >= project.inspectionsPerDay) throw new InspectionError(`Plafond quotidien atteint (${project.inspectionsPerDay} inspections par jour).`);
}

/** Moteurs cochés par défaut : le moins cher disponible (ChatGPT mini), sinon le premier qui a une clé. */
export function defaultEngineIds(engines: Engine[]): string[] {
  const usable = engines.filter((e) => e.enabled && hasApiKey(e.provider));
  const cheap = usable.find((e) => e.provider === "openai") ?? usable.find((e) => e.provider === "perplexity") ?? usable[0];
  return cheap ? [cheap.id] : [];
}

/**
 * Étape A : récupère la page, vérifie l'accès des robots IA, extrait le contenu,
 * génère (ou réutilise) les questions, et crée un brouillon d'inspection.
 */
export async function prepareInspection(projectId: string, rawUrl: string, opts: { force?: boolean } = {}) {
  const db = await getDb();
  const project = await db.query.projects.findFirst({ where: eq(schema.projects.id, projectId), with: { competitors: true } });
  if (!project) throw new InspectionError("Projet introuvable");
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) throw new InspectionError("URL invalide : elle doit commencer par http:// ou https://");

  if (!opts.force) {
    const recent = await db.query.inspections.findFirst({
      where: and(
        eq(schema.inspections.projectId, projectId),
        eq(schema.inspections.normalizedUrl, normalized),
        gte(schema.inspections.createdAt, new Date(Date.now() - DEDUPE_MINUTES * 60_000)),
      ),
      orderBy: desc(schema.inspections.createdAt),
    });
    if (recent) return { inspectionId: recent.id, reused: true as const };
  }
  await guardCaps(project);

  const engines = await db.query.engines.findMany();
  const url = new URL(rawUrl.trim());
  const origin = originOf(url.toString())!;

  let page: PageSnapshot;
  let excerpt = "";
  try {
    const fetched = await safeFetch(url.toString());
    const { excerpt: text, ...info } = extractPage(fetched.body);
    excerpt = text;
    page = { finalUrl: fetched.finalUrl, httpStatus: fetched.status, responseMs: fetched.responseMs, redirects: fetched.redirects, ...info };
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw new InspectionError(err.message);
    const message = err instanceof FetchPageError ? err.message : String(err);
    page = { finalUrl: url.toString(), httpStatus: err instanceof FetchPageError ? (err.status ?? 0) : 0, responseMs: 0, redirects: 0, title: "", h1: "", description: "", h2: [], lang: "", wordCount: 0, publishedAt: null, canonical: null, robotsMeta: null, jsonLdTypes: [], jsSuspect: false, fetchError: message };
  }

  const [robotsTxt, llmsTxt] = await Promise.all([fetchRobots(origin), hasLlmsTxt(origin)]);
  const robots = evaluateRobots(`${origin}/robots.txt`, robotsTxt, page.finalUrl);
  const access: AccessSnapshot = { robotsFound: robots.found, agents: robots.agents, allAllowed: robots.allAllowed, llmsTxt, checkedAt: new Date().toISOString() };

  const fetchable = !page.fetchError && page.httpStatus >= 200 && page.httpStatus < 300 && (page.wordCount > 0 || page.title);
  const contentHash = fetchable ? createHash("sha256").update([page.title, page.h1, page.description, excerpt].join("\n")).digest("hex") : null;

  let questions: InspectionQuestion[] = [];
  let questionsReused = false;
  let rejected: Array<{ text: string; term: string }> = [];
  let questionsError: string | null = null;
  let costUsd = 0;
  if (contentHash) {
    const cached = await db.query.inspections.findFirst({
      where: and(
        eq(schema.inspections.projectId, projectId),
        eq(schema.inspections.normalizedUrl, normalized),
        eq(schema.inspections.contentHash, contentHash),
        isNotNull(schema.inspections.contentHash),
        gte(schema.inspections.createdAt, new Date(Date.now() - QUESTION_CACHE_DAYS * 86_400_000)),
        sql`jsonb_array_length(${schema.inspections.questions}) > 0`,
      ),
      orderBy: desc(schema.inspections.createdAt),
    });
    if (cached) {
      questions = cached.questions;
      questionsReused = true;
    } else {
      const competitorTerms = project.competitors.flatMap((c) => [c.name, ...c.aliases, ...c.domains]);
      try {
        const gen = await generateQuestions({ ...page, excerpt }, project, engines, competitorTerms, MAX_QUESTIONS);
        questions = gen.questions;
        rejected = gen.rejected;
        costUsd = gen.costUsd;
      } catch (err) {
        // Sans clé ou en cas d'erreur du modèle, le rapport reste utile : les questions se saisissent à la main.
        questionsError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const [row] = await db
    .insert(schema.inspections)
    .values({ projectId, url: rawUrl.trim(), normalizedUrl: normalized, contentHash, status: "draft", page, access, questions, questionsReused, engineIds: defaultEngineIds(engines), costEstimate: costUsd })
    .returning({ id: schema.inspections.id });
  return { inspectionId: row.id, reused: false as const, rejected, questionsError };
}

/** Étape B : valide les questions et les moteurs, puis passe l'inspection en cours. Le workflow fait le reste. */
export async function launchInspection(inspectionId: string, input: { questions: string[]; engineIds: string[] }) {
  const db = await getDb();
  const insp = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, inspectionId), with: { project: { with: { competitors: true } } } });
  if (!insp) throw new InspectionError("Inspection introuvable");
  if (insp.status === "running") throw new InspectionError("Cette inspection est déjà en cours");
  await guardCaps(insp.project);

  const texts = input.questions.map((q) => q.trim()).filter((q) => q.length >= 10);
  if (texts.length === 0) throw new InspectionError("Au moins une question de 10 caractères");
  if (texts.length > MAX_QUESTIONS) throw new InspectionError(`${MAX_QUESTIONS} questions maximum`);
  const forbidden = forbiddenTerms(insp.project, insp.project.competitors.flatMap((c) => [c.name, ...c.aliases, ...c.domains]));
  for (const q of texts) {
    const term = violatesNeutrality(q, forbidden);
    if (term) throw new InspectionError(`La question « ${q} » nomme « ${term} », ce qui fausserait la mesure.`);
  }
  const engines = await db.query.engines.findMany();
  const chosen = engines.filter((e) => input.engineIds.includes(e.id) && e.enabled && hasApiKey(e.provider));
  if (chosen.length === 0) throw new InspectionError("Aucun moteur utilisable : vérifiez les clés API et les moteurs activés");

  const previous = new Map(insp.questions.map((q) => [q.text, q]));
  const lang = insp.page?.lang || (insp.project.locale.startsWith("fr") ? "fr" : "en");
  const questions: InspectionQuestion[] = texts.map((text) => previous.get(text) ?? { text, lang, source: "manual" });

  await db
    .update(schema.inspections)
    .set({ status: "running", questions, engineIds: chosen.map((e) => e.id), plannedCount: questions.length * chosen.length, doneCount: 0, error: null, finishedAt: null })
    .where(eq(schema.inspections.id, inspectionId));
  await db.delete(schema.inspectionAnswers).where(eq(schema.inspectionAnswers.inspectionId, inspectionId));
  return { tasks: questions.flatMap((_, qi) => chosen.map((e) => ({ questionIndex: qi, engineId: e.id }))), costCapUsd: insp.project.inspectionCostCapEur / USD_TO_EUR };
}

export type InspectionTask = { questionIndex: number; engineId: string };

/** Une question sur un moteur, idempotent. Détecte l'URL exacte et le domaine dans les sources. */
export async function answerInspectionQuestion(inspectionId: string, task: InspectionTask) {
  const db = await getDb();
  const existing = await db.query.inspectionAnswers.findFirst({
    where: and(eq(schema.inspectionAnswers.inspectionId, inspectionId), eq(schema.inspectionAnswers.questionIndex, task.questionIndex), eq(schema.inspectionAnswers.engineId, task.engineId)),
    columns: { costEstimate: true, error: true },
  });
  if (existing) return { costUsd: existing.costEstimate, error: existing.error };

  const insp = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, inspectionId), with: { project: true } });
  const engine = await db.query.engines.findFirst({ where: eq(schema.engines.id, task.engineId) });
  const question = insp?.questions[task.questionIndex];
  if (!insp || !engine || !question) throw new Error("Inspection, moteur ou question introuvable");
  const country = insp.project.locale.split("-")[1] ?? "CA";

  let outcome: { text: string; sources: SourceRef[]; usage: Record<string, number | undefined>; latencyMs: number; costUsd: number; error: string | null };
  try {
    const a = await runPromptWithRetry(engine, question.text, { webSearch: true, lang: question.lang, country });
    outcome = { ...a, costUsd: estimateCostUsd(engine.provider, engine.config, a.usage, engine.model), error: null };
  } catch (err) {
    outcome = { text: "", sources: [], usage: {}, latencyMs: 0, costUsd: 0, error: err instanceof EngineError ? `${err.status ?? ""} ${err.message}`.trim() : String(err) };
  }

  const target = insp.page?.finalUrl ?? insp.url;
  const urlRank = outcome.sources.findIndex((s) => urlMatches(s.url, target) || urlMatches(s.url, insp.url));
  const domainRank = outcome.sources.findIndex((s) => insp.project.domains.some((d) => sameSite(s.url, d)));

  await db
    .insert(schema.inspectionAnswers)
    .values({
      inspectionId,
      questionIndex: task.questionIndex,
      engineId: task.engineId,
      rawText: outcome.text,
      sources: outcome.sources,
      usage: outcome.usage,
      costEstimate: outcome.costUsd,
      latencyMs: outcome.latencyMs,
      error: outcome.error,
      urlCited: urlRank >= 0,
      urlRank: urlRank >= 0 ? urlRank + 1 : null,
      domainCited: domainRank >= 0,
      domainRank: domainRank >= 0 ? domainRank + 1 : null,
    })
    .onConflictDoNothing();
  await db
    .update(schema.inspections)
    .set({ doneCount: sql`${schema.inspections.doneCount} + 1`, costEstimate: sql`${schema.inspections.costEstimate} + ${outcome.costUsd}` })
    .where(eq(schema.inspections.id, inspectionId));
  return { costUsd: outcome.costUsd, error: outcome.error };
}

export async function getInspectionCost(inspectionId: string) {
  const db = await getDb();
  const row = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, inspectionId), columns: { costEstimate: true } });
  return row?.costEstimate ?? 0;
}

export async function finishInspection(inspectionId: string, status: "done" | "failed", error?: string) {
  const db = await getDb();
  await db.update(schema.inspections).set({ status, error: error ?? null, finishedAt: new Date() }).where(eq(schema.inspections.id, inspectionId));
}

export async function setInspectionWorkflow(inspectionId: string, workflowRunId: string) {
  const db = await getDb();
  await db.update(schema.inspections).set({ workflowRunId }).where(eq(schema.inspections.id, inspectionId));
}
