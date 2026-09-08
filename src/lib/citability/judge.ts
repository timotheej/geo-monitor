import { generateText, Output } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Engine, JudgeQuestionNotes } from "@/db/schema";
import { hasApiKey } from "@/lib/engines";
import { estimateCostUsd } from "@/lib/pricing";

/**
 * Lecture d'une page par un modèle, pour une question donnée. Sortie structurée, entrée réduite
 * (titre, sous-titres, 6 000 premiers caractères). Une lecture coûte environ 0,003 USD.
 * Les notes alimentent la grille (B1, B2, B4) ; forces, manques et actions sont affichés tels quels.
 */

export type JudgeInput = {
  question: string;
  questionLang: string;
  page: { url: string; title: string; h1: string; description: string; headings: string[]; text: string };
};

const schema = z.object({
  intent: z.enum(["comparative", "informational", "price", "local", "resource"]),
  place: z.string().nullable(),
  pageType: z.enum(["listicle", "guide", "service", "directory", "documentation", "news", "institutional", "other"]),
  fit: z.number().int().min(0).max(3),
  fitNote: z.string().max(240),
  directAnswer: z.number().int().min(0).max(3),
  directAnswerPassage: z.string().max(600).nullable(),
  specificity: z.number().int().min(0).max(3),
  strengths: z.array(z.string().max(160)).max(3),
  gaps: z.array(z.string().max(160)).max(3),
  actions: z.array(z.string().max(200)).max(3),
});

export type JudgeOutput = z.infer<typeof schema>;

export const MAX_TEXT_CHARS = 6000;

function cheapModel(engines: Engine[]) {
  if (engines.some((e) => e.provider === "openai" && e.enabled) && hasApiKey("openai")) return { model: openai("gpt-5.4-mini"), provider: "openai" as const, id: "gpt-5.4-mini" };
  if (engines.some((e) => e.provider === "anthropic" && e.enabled) && hasApiKey("anthropic")) return { model: anthropic("claude-haiku-4-5"), provider: "anthropic" as const, id: "claude-haiku-4-5" };
  return null;
}

/** Construit le prompt du juge. Exporté pour les tests. */
export function buildJudgePrompt(input: JudgeInput): { system: string; prompt: string } {
  const fr = input.questionLang.startsWith("fr");
  const system = fr
    ? `Tu évalues si une page web est une bonne source pour répondre à une question posée à un assistant IA avec recherche web. Tu notes de façon stricte et factuelle, sans complaisance. Barème :
- fit (adéquation du type de page au type de question) : 0 hors sujet, 1 partiel, 2 bon, 3 exactement le format attendu (par exemple un comparatif neutre pour une question "meilleure agence", un guide pour une question "comment").
- directAnswer : 0 aucune réponse directe, 1 réponse diluée, 2 réponse claire mais enfouie, 3 un passage de 80 mots maximum répond directement, cite-le tel quel dans directAnswerPassage.
- specificity : 0 générique, 1 quelques faits, 2 chiffres et sources précis, 3 chiffres, sources nommées et exemples concrets.
Les forces et les manques décrivent la page en tant que source pour cette question. Les actions sont des modifications à apporter à la page par son rédacteur pour qu'un moteur IA la cite davantage sur cette question : concrètes et vérifiables (quelle section, quel ajout, quelle donnée), jamais "améliorer le contenu", et jamais des conseils au lecteur. Réponds dans la langue de la question.`
    : `You evaluate whether a web page is a good source to answer a question asked to an AI assistant with web search. Grade strictly and factually. Scale:
- fit (page type versus question type): 0 off topic, 1 partial, 2 good, 3 exactly the expected format (a neutral roundup for a "best agency" question, a guide for a "how to" question).
- directAnswer: 0 none, 1 diluted, 2 clear but buried, 3 a passage of at most 80 words answers directly; quote it verbatim in directAnswerPassage.
- specificity: 0 generic, 1 a few facts, 2 precise figures and sources, 3 figures, named sources and concrete examples.
Strengths and gaps describe the page as a source for this question. Actions are edits the page's author should make so that an AI engine cites it more on this question: concrete and checkable (which section, what to add, which data), never "improve the content", and never advice to the reader. Answer in the question's language.`;
  const p = input.page;
  const prompt = [
    `Question : ${input.question}`,
    `URL : ${p.url}`,
    `Titre : ${p.title}`,
    p.h1 && p.h1 !== p.title ? `H1 : ${p.h1}` : "",
    p.description ? `Description : ${p.description}` : "",
    p.headings.length ? `Sous-titres : ${p.headings.slice(0, 20).join(" | ")}` : "",
    `Texte (début) :\n${p.text.slice(0, MAX_TEXT_CHARS)}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { system, prompt };
}

export async function judgePage(input: JudgeInput, engines: Engine[]): Promise<{ notes: JudgeQuestionNotes; costUsd: number }> {
  const m = cheapModel(engines);
  if (!m) throw new Error("Aucune clé API disponible pour la lecture par le modèle");
  const { system, prompt } = buildJudgePrompt(input);
  const res = await generateText({ model: m.model, system, prompt, output: Output.object({ schema }), maxOutputTokens: 700 });
  const out = res.output;
  if (!out) throw new Error("Lecture du modèle vide");
  const notes: JudgeQuestionNotes = {
    question: input.question,
    intent: out.intent,
    place: out.place,
    pageType: out.pageType,
    fit: out.fit as 0 | 1 | 2 | 3,
    fitNote: out.fitNote,
    directAnswer: out.directAnswer as 0 | 1 | 2 | 3,
    directAnswerPassage: out.directAnswerPassage,
    specificity: out.specificity as 0 | 1 | 2 | 3,
    strengths: out.strengths,
    gaps: out.gaps,
    actions: out.actions,
  };
  const costUsd = estimateCostUsd(m.provider, {}, { inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens }, m.id);
  return { notes, costUsd };
}
