/**
 * Vue typée d'une analyse de citabilité pour l'interface, et lecture recommandée (section 4 de la spécification).
 * Pur, sans accès à la base : les colonnes JSON de `page_analyses` sont typées de façon lâche dans le schéma,
 * ce module les remet en forme.
 */

import type { JudgeQuestionNotes, PageAnalysis } from "@/db/schema";
import type { QuestionIntent } from "./classify-question";
import type { ComparisonRow } from "./compare";
import type { PageType } from "./page-type";
import { scoreLabel, type SignalScore } from "./score";

export type ScoreBlock = { total: number; max: number; rows: SignalScore[]; caps: string[] };
export type ContentByQuestion = { question: string; total: number; intent: QuestionIntent; place: string | null; judged: boolean };
export type ContentBlock = ScoreBlock & { byQuestion: ContentByQuestion[] };
export type PerEngine = { engineId: string; label: string; provider: string; value: number; answers: number; cited: number; domainCited: number; retrieved: number; mentioned: number };
export type ResultBlock = { total: number; max: number; perEngine: PerEngine[] };
export type ComparisonPageView = { url: string; domain: string; pageType: PageType; typeLabel: string; questions: number[]; engines: string[]; error?: string };
export type TypologyEntry = { type: PageType; label: string; count: number; action: string; examples: string[] };
export type ComparisonView = { pages: ComparisonPageView[]; typology: TypologyEntry[]; rows: ComparisonRow[]; topGaps: ComparisonRow[]; sameTypeOnly: boolean };

export type AnalysisView = {
  id: string;
  status: PageAnalysis["status"];
  gridVersion: string;
  createdAt: Date;
  finishedAt: Date | null;
  score: number;
  confidence: "low" | "medium" | "high";
  pageType: PageType | null;
  access: ScoreBlock;
  content: ContentBlock;
  result: ResultBlock;
  judge: JudgeQuestionNotes[];
  comparison: ComparisonView;
  costEstimate: number;
  error: string | null;
};

const EMPTY_BLOCK: ScoreBlock = { total: 0, max: 0, rows: [], caps: [] };

/** Remet en forme une ligne `page_analyses` terminée. Les blocs absents deviennent vides plutôt que null. */
export function toAnalysisView(a: PageAnalysis): AnalysisView {
  const access = (a.access as ScoreBlock | null) ?? EMPTY_BLOCK;
  const content = (a.content as ContentBlock | null) ?? { ...EMPTY_BLOCK, byQuestion: [] };
  const result = (a.result as ResultBlock | null) ?? { total: 0, max: 40, perEngine: [] };
  const comparison = (a.comparison as ComparisonView | null) ?? { pages: [], typology: [], rows: [], topGaps: [], sameTypeOnly: false };
  return {
    id: a.id,
    status: a.status,
    gridVersion: a.gridVersion,
    createdAt: new Date(a.createdAt),
    finishedAt: a.finishedAt ? new Date(a.finishedAt) : null,
    score: a.score ?? 0,
    confidence: a.confidence ?? "low",
    pageType: (a.pageType as PageType | null) ?? null,
    access: { ...access, caps: access.caps ?? [] },
    content: { ...content, caps: content.caps ?? [], byQuestion: content.byQuestion ?? [] },
    result,
    judge: a.judge ?? [],
    comparison: { ...comparison, pages: comparison.pages ?? [], typology: comparison.typology ?? [], rows: comparison.rows ?? [], topGaps: comparison.topGaps ?? [] },
    costEstimate: a.costEstimate,
    error: a.error,
  };
}

export const CONFIDENCE_LABEL: Record<AnalysisView["confidence"], string> = { low: "confiance faible", medium: "confiance moyenne", high: "confiance haute" };

export type ReadingKey = "access-low" | "search" | "content" | "brand" | "neutral";

export type Reading = { key: ReadingKey; title: string; text: string };

/**
 * Lecture recommandée sous les jauges (section 4). « Bon » et « faible » suivent `scoreLabel` ;
 * un Contenu moyen avec un Résultat faible relève aussi du travail de contenu.
 */
export function recommendedReading(access: Pick<ScoreBlock, "total" | "max">, content: Pick<ScoreBlock, "total" | "max">, result: Pick<ResultBlock, "total" | "max">): Reading {
  const a = scoreLabel(access.total, access.max || 1);
  const b = scoreLabel(content.total, content.max || 1);
  const c = scoreLabel(result.total, result.max || 1);
  if (a === "faible") {
    return { key: "access-low", title: "La page n'est pas atteignable", text: "Corriger l'accès avant tout le reste : tant que les robots ne lisent pas la page, ni le contenu ni la notoriété ne comptent." };
  }
  if (c === "faible" && b === "bon") {
    return {
      key: "search",
      title: "Page bien faite, mais absente des réponses",
      text: "Elle n'entre pas dans la recherche, ou le moteur préfère des sources plus connues. Regarder les requêtes formulées par les moteurs et le référencement classique dessus, puis la typologie des pages citées à la place.",
    };
  }
  if (c === "faible" && b !== "bon") {
    return { key: "content", title: "Travail de contenu", text: "La page est lue mais pas retenue : s'appuyer sur la comparaison avec les pages citées à la place pour combler les écarts les plus grands." };
  }
  if (c === "bon" && b === "faible") {
    return { key: "brand", title: "La marque porte la page", text: "Elle est citée malgré un contenu peu adapté. Consolider le contenu avant que ça ne se retourne." };
  }
  return { key: "neutral", title: "Situation intermédiaire", text: "Aucun blocage net : lire le détail par moteur et la comparaison pour choisir entre accès, contenu et notoriété." };
}

/** Une analyse à relancer : plus de 7 jours, ou grille différente de celle en vigueur. */
export function isAnalysisStale(a: Pick<AnalysisView, "createdAt" | "gridVersion">, currentGrid: string, now = new Date()): boolean {
  return a.gridVersion !== currentGrid || now.getTime() - a.createdAt.getTime() > 7 * 86_400_000;
}
