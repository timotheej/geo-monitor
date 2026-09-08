import { createHash } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Engine, JudgeQuestionNotes, PageAnalysis } from "@/db/schema";
import { findTerm, normalizeText } from "@/lib/detection";
import { fetchRobots, safeFetch, FetchPageError } from "@/lib/inspect/fetch";
import { evaluateRobots } from "@/lib/inspect/robots";
import { UnsafeUrlError } from "@/lib/inspect/net-guard";
import { normalizeUrl, sameSite, urlMatches } from "@/lib/inspect/url";
import { extractSignals, type PageSignals } from "./signals";
import { detectPageType, PAGE_TYPE_LABEL, type PageType } from "./page-type";
import { GRID_VERSION, scoreAccess, scoreContent, type JudgeNotes, type ScoreResult } from "./score";
import { classifyQuestionHeuristic, keyTerms } from "./classify-question";
import { compareSignals, topGaps, type ComparisonRow, type Competitor } from "./compare";
import { judgePage } from "./judge";

/** Plafond de dépense d'une analyse (lectures par le modèle), en USD. */
export const ANALYSIS_COST_CAP_USD = 0.2;
const COMPARISON_CACHE_DAYS = 7;
const MAX_COMPARISON_PAGES = 15;
const RESULT_WEIGHT = 40;

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

/** Action recommandée selon le type de page citée à la place (section 5 de la spécification). */
export const TYPE_ACTIONS: Record<PageType, string> = {
  directory: "Créer ou compléter la fiche, obtenir des avis : la page ne rivalise pas, elle s'y inscrit.",
  listicle: "Demander l'inclusion dans ce comparatif, ou publier son propre comparatif plus complet et à jour.",
  documentation: "Ne pas viser cette question ; viser une variante locale, sectorielle ou pratique.",
  news: "Relations presse, tribune ou étude originale.",
  service: "Améliorer sa propre page : réponse directe, prix, preuves, fraîcheur.",
  institutional: "Citer ces sources dans sa propre page plutôt que rivaliser.",
  guide: "Publier un guide plus complet, plus précis et daté, qui répond dès le premier paragraphe.",
  other: "Analyser la page pour comprendre ce qui a été repris.",
};

export type ResultPerEngine = { engineId: string; label: string; provider: string; value: number; answers: number; cited: number; domainCited: number; retrieved: number; mentioned: number };

export type ComparisonSummary = {
  /** Pages tierces effectivement comparées */
  pages: Array<{ url: string; domain: string; pageType: PageType; typeLabel: string; questions: number[]; engines: string[]; error?: string }>;
  typology: Array<{ type: PageType; label: string; count: number; action: string; examples: string[] }>;
  rows: ComparisonRow[];
  topGaps: ComparisonRow[];
  sameTypeOnly: boolean;
};

type ContentByQuestion = { question: string; total: number; intent: string; place: string | null; judged: boolean };

function contentHashOf(s: PageSignals): string {
  return createHash("sha256").update([s.title, s.h1, s.description, s.excerpt].join("\n")).digest("hex");
}

function mentionValue(text: string, terms: string[]): boolean {
  const n = normalizeText(text);
  return terms.some((t) => findTerm(n, t) >= 0);
}

/** Valeur d'une réponse pour le bloc Résultat (section 4 C). */
function answerValue(a: { urlCited: boolean; domainCited: boolean; urlRetrieved: boolean; domainRetrieved: boolean; mentioned: boolean }): number {
  if (a.urlCited) return 1;
  if (a.domainCited) return 0.6;
  if (a.urlRetrieved || a.domainRetrieved) return 0.4;
  if (a.mentioned) return 0.3;
  return 0;
}

async function loadOrFetchComparisonPage(url: string): Promise<{ signals: PageSignals | null; pageType: PageType | null; error?: string }> {
  const db = await getDb();
  const normalized = normalizeUrl(url);
  if (!normalized) return { signals: null, pageType: null, error: "URL invalide" };
  const cached = await db.query.comparisonPages.findFirst({
    where: and(eq(schema.comparisonPages.normalizedUrl, normalized), gte(schema.comparisonPages.fetchedAt, new Date(Date.now() - COMPARISON_CACHE_DAYS * 86_400_000))),
  });
  if (cached) return { signals: cached.signals as PageSignals | null, pageType: (cached.pageType as PageType | null) ?? null, error: cached.error ?? undefined };

  let signals: PageSignals | null = null;
  let pageType: PageType | null = null;
  let error: string | undefined;
  let httpStatus: number | null = null;
  try {
    const fetched = await safeFetch(url);
    httpStatus = fetched.status;
    if (fetched.status >= 200 && fetched.status < 300) {
      signals = extractSignals(fetched.body, { url: fetched.finalUrl });
      pageType = detectPageType(signals).type;
    } else error = `HTTP ${fetched.status}`;
  } catch (err) {
    error = err instanceof FetchPageError || err instanceof UnsafeUrlError ? err.message : String(err);
  }
  await db
    .insert(schema.comparisonPages)
    .values({ normalizedUrl: normalized, url, contentHash: signals ? contentHashOf(signals) : null, httpStatus, signals, pageType, error: error ?? null })
    .onConflictDoUpdate({ target: schema.comparisonPages.normalizedUrl, set: { url, httpStatus, signals, pageType, error: error ?? null, fetchedAt: new Date() } });
  return { signals, pageType, error };
}

/**
 * Analyse de citabilité d'une inspection terminée : page, grille, résultat observé, comparaison, juge.
 * Idempotente par contenu : une analyse récente de la même page avec la même grille est renvoyée telle quelle
 * sauf `force`.
 */
export async function analyzeInspection(inspectionId: string, opts: { force?: boolean; judge?: boolean } = {}): Promise<PageAnalysis> {
  const db = await getDb();
  const insp = await db.query.inspections.findFirst({
    where: eq(schema.inspections.id, inspectionId),
    with: { answers: { with: { engine: true } }, project: { with: { competitors: true } } },
  });
  if (!insp) throw new AnalysisError("Inspection introuvable");
  if (insp.status !== "done") throw new AnalysisError("Lancer d'abord le test (étape B) : l'analyse s'appuie sur ses réponses");
  const useJudge = opts.judge !== false;

  if (!opts.force) {
    const recent = await db.query.pageAnalyses.findFirst({
      where: and(eq(schema.pageAnalyses.inspectionId, inspectionId), eq(schema.pageAnalyses.gridVersion, GRID_VERSION), eq(schema.pageAnalyses.status, "done")),
      orderBy: desc(schema.pageAnalyses.createdAt),
    });
    if (recent) return recent;
  }

  const [row] = await db
    .insert(schema.pageAnalyses)
    .values({ projectId: insp.projectId, inspectionId, url: insp.url, normalizedUrl: insp.normalizedUrl, gridVersion: GRID_VERSION, status: "running" })
    .returning();

  try {
    const engines = await db.query.engines.findMany();
    const project = insp.project;
    const brandTerms = [project.brandName, ...project.aliases];
    const primaryLang = insp.questions[0]?.lang || insp.page?.lang || "fr";
    const firstClass = classifyQuestionHeuristic(insp.questions[0]?.text ?? "", primaryLang);

    // 1. Page cible
    const fetched = await safeFetch(insp.url);
    if (fetched.status < 200 || fetched.status >= 300) throw new AnalysisError(`Page non récupérable (HTTP ${fetched.status})`);
    const signals = extractSignals(fetched.body, { url: fetched.finalUrl, questionLang: primaryLang, place: firstClass.place });
    const pageTypeResult = detectPageType(signals);
    const contentHash = contentHashOf(signals);

    // 2. Accès
    const origin = new URL(fetched.finalUrl).origin;
    const robotsTxt = await fetchRobots(origin);
    const robots = evaluateRobots(`${origin}/robots.txt`, robotsTxt, fetched.finalUrl);
    const access = scoreAccess(
      signals,
      { allAllowed: robots.allAllowed, blockedAgents: robots.agents.filter((a) => !a.allowed).map((a) => a.agent) },
      { status: fetched.status, responseMs: fetched.responseMs, redirects: fetched.redirects },
      { llmsTxt: insp.access?.llmsTxt ?? null },
    );

    // 3. Contenu, par question, avec le juge quand le budget le permet
    let costUsd = 0;
    const judge: JudgeQuestionNotes[] = [];
    const byQuestion: ContentByQuestion[] = [];
    const contentResults: ScoreResult[] = [];
    for (const q of insp.questions) {
      const cls = classifyQuestionHeuristic(q.text, q.lang);
      let notes: JudgeNotes | null = null;
      let judged = false;
      if (useJudge && costUsd < ANALYSIS_COST_CAP_USD) {
        try {
          const j = await judgePage(
            { question: q.text, questionLang: q.lang, page: { url: fetched.finalUrl, title: signals.title, h1: signals.h1, description: signals.description, headings: signals.headings.map((h) => h.text), text: signals.textInFirstQuarter + " " + signals.excerpt } },
            engines,
          );
          judge.push(j.notes);
          costUsd += j.costUsd;
          notes = { fit: j.notes.fit, directAnswer: j.notes.directAnswer, specificity: j.notes.specificity };
          judged = true;
        } catch {
          /* sans juge, la grille utilise ses replis */
        }
      }
      const content = scoreContent(signals, notes, { pageType: pageTypeResult.type, questionIntent: cls.intent, question: q.text, questionTerms: keyTerms(q.text) });
      contentResults.push(content);
      byQuestion.push({ question: q.text, total: content.total, intent: cls.intent, place: cls.place ?? null, judged });
    }
    // Le bloc Contenu affiché est celui de la question médiane ; le détail par question est conservé.
    const sorted = [...contentResults].sort((a, b) => a.total - b.total);
    const content = sorted[Math.floor(sorted.length / 2)] ?? scoreContent(signals, null, { pageType: pageTypeResult.type });

    // 4. Résultat observé
    const perEngineMap = new Map<string, ResultPerEngine>();
    for (const a of insp.answers) {
      if (a.error) continue;
      const mentioned = mentionValue(a.rawText, brandTerms);
      const value = answerValue({ ...a, mentioned });
      const e = perEngineMap.get(a.engineId) ?? { engineId: a.engineId, label: a.engine.label, provider: a.engine.provider, value: 0, answers: 0, cited: 0, domainCited: 0, retrieved: 0, mentioned: 0 };
      e.value += value;
      e.answers += 1;
      if (a.urlCited) e.cited += 1;
      else if (a.domainCited) e.domainCited += 1;
      else if (a.urlRetrieved || a.domainRetrieved) e.retrieved += 1;
      else if (mentioned) e.mentioned += 1;
      perEngineMap.set(a.engineId, e);
    }
    const perEngine = Array.from(perEngineMap.values()).map((e) => ({ ...e, value: e.answers ? e.value / e.answers : 0 }));
    const answered = insp.answers.filter((a) => !a.error).length;
    const meanValue = perEngine.length ? perEngine.reduce((s, e) => s + e.value, 0) / perEngine.length : 0;
    const result = { total: Math.round(meanValue * RESULT_WEIGHT), max: RESULT_WEIGHT, perEngine };
    const confidence: "low" | "medium" | "high" = answered < 5 ? "low" : answered < 10 ? "medium" : "high";

    // 5. Comparaison avec les pages citées à la place
    const candidates = new Map<string, { url: string; questions: Set<number>; engines: Set<string> }>();
    for (const a of insp.answers) {
      if (a.error || a.urlCited) continue;
      const cited = a.sources.filter((s) => s.cited !== false && !project.domains.some((d) => sameSite(s.url, d)) && !urlMatches(s.url, insp.url)).slice(0, 3);
      for (const s of cited) {
        const key = normalizeUrl(s.url) ?? s.url;
        const c = candidates.get(key) ?? { url: s.url, questions: new Set<number>(), engines: new Set<string>() };
        c.questions.add(a.questionIndex);
        c.engines.add(a.engine.label);
        candidates.set(key, c);
      }
    }
    const picked = Array.from(candidates.values())
      .sort((a, b) => b.questions.size - a.questions.size)
      .slice(0, MAX_COMPARISON_PAGES);
    const fetchedPages = await Promise.all(picked.map(async (c) => ({ ...c, ...(await loadOrFetchComparisonPage(c.url)) })));
    const competitors: Competitor[] = fetchedPages.filter((p) => p.signals && p.pageType).map((p) => ({ signals: p.signals!, pageType: p.pageType! }));
    const rows = competitors.length ? compareSignals(signals, competitors, { targetType: pageTypeResult.type }) : [];
    const typologyMap = new Map<PageType, { count: number; examples: string[] }>();
    for (const p of fetchedPages) {
      if (!p.pageType) continue;
      const t = typologyMap.get(p.pageType) ?? { count: 0, examples: [] };
      t.count += 1;
      if (t.examples.length < 3) t.examples.push(new URL(p.url).hostname.replace(/^www\./, ""));
      typologyMap.set(p.pageType, t);
    }
    const comparison: ComparisonSummary = {
      pages: fetchedPages.map((p) => ({ url: p.url, domain: new URL(p.url).hostname.replace(/^www\./, ""), pageType: p.pageType ?? "other", typeLabel: PAGE_TYPE_LABEL[p.pageType ?? "other"], questions: Array.from(p.questions), engines: Array.from(p.engines), error: p.error })),
      typology: Array.from(typologyMap.entries())
        .map(([type, t]) => ({ type, label: PAGE_TYPE_LABEL[type], count: t.count, action: TYPE_ACTIONS[type], examples: t.examples }))
        .sort((a, b) => b.count - a.count),
      rows,
      topGaps: topGaps(rows, 3),
      sameTypeOnly: rows[0]?.sameTypeOnly ?? false,
    };

    const score = Math.max(0, Math.min(100, access.total + content.total + result.total));
    const [done] = await db
      .update(schema.pageAnalyses)
      .set({
        status: "done",
        contentHash,
        signals: signals as unknown as Record<string, unknown>,
        pageType: pageTypeResult.type,
        access: { total: access.total, max: access.max, rows: access.rows, caps: access.caps } as never,
        content: { total: content.total, max: content.max, rows: content.rows, caps: content.caps, byQuestion } as never,
        result,
        score,
        confidence,
        judge,
        comparison: comparison as unknown as Record<string, unknown>,
        costEstimate: costUsd,
        finishedAt: new Date(),
      })
      .where(eq(schema.pageAnalyses.id, row.id))
      .returning();
    return done;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const [failed] = await db.update(schema.pageAnalyses).set({ status: "failed", error: message, finishedAt: new Date() }).where(eq(schema.pageAnalyses.id, row.id)).returning();
    if (err instanceof AnalysisError) return failed;
    throw err;
  }
}

export async function getAnalysisForInspection(inspectionId: string) {
  const db = await getDb();
  return db.query.pageAnalyses.findFirst({ where: eq(schema.pageAnalyses.inspectionId, inspectionId), orderBy: desc(schema.pageAnalyses.createdAt) });
}

/** Engines utilisables par le juge (pour l'estimation affichée avant le lancement). */
export function judgeAvailable(engines: Engine[]): boolean {
  return engines.some((e) => e.enabled && (e.provider === "openai" || e.provider === "anthropic"));
}
