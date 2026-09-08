import { generateText, Output } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Engine, Project } from "@/db/schema";
import { findTerm, normalizeText } from "@/lib/detection";
import { hasApiKey } from "@/lib/engines";
import { estimateCostUsd } from "@/lib/pricing";
import type { PageInfo } from "./extract";

export type GeneratedQuestion = { text: string; lang: string; source: "generated" | "manual" };

/** Modèle bon marché sans recherche web pour la génération de questions. */
function cheapModel(engines: Engine[]) {
  if (engines.some((e) => e.provider === "openai" && e.enabled) && hasApiKey("openai")) return { model: openai("gpt-5.4-mini"), provider: "openai" as const, id: "gpt-5.4-mini" };
  if (engines.some((e) => e.provider === "anthropic" && e.enabled) && hasApiKey("anthropic")) return { model: anthropic("claude-haiku-4-5"), provider: "anthropic" as const, id: "claude-haiku-4-5" };
  return null;
}

/** Termes à bannir des questions : marque, alias, domaines (sans le TLD) et concurrents. */
export function forbiddenTerms(project: Project, competitorTerms: string[]): string[] {
  const domains = project.domains.flatMap((d) => [d, d.split(".")[0]]);
  return [project.brandName, ...project.aliases, ...domains, ...competitorTerms].map((t) => t.trim()).filter((t) => t.length >= 3);
}

export function violatesNeutrality(question: string, forbidden: string[]): string | null {
  const n = normalizeText(question);
  for (const term of forbidden) if (findTerm(n, term) >= 0) return term;
  return null;
}

const schema = z.object({
  questions: z.array(z.object({ text: z.string().min(10).max(200) })).min(3).max(5),
});

export async function generateQuestions(
  page: PageInfo,
  project: Project,
  engines: Engine[],
  competitorTerms: string[],
  count = 5,
): Promise<{ questions: GeneratedQuestion[]; rejected: Array<{ text: string; term: string }>; costUsd: number }> {
  const m = cheapModel(engines);
  if (!m) throw new Error("Aucune clé API disponible pour générer les questions");
  const lang = page.lang || (project.locale.startsWith("fr") ? "fr" : "en");
  const fr = lang === "fr";

  const system = fr
    ? `Tu génères des questions qu'un internaute poserait à un assistant IA, sans connaître la page ci-dessous, et auxquelles cette page répond bien. Règles : questions naturelles et courtes, dans la langue de la page, formulées comme dans une vraie conversation, sans nommer aucune entreprise, marque, site ou auteur, sans reprendre le titre mot pour mot. Varie les angles : problème concret, comparaison, "comment", "combien", "quel outil". Ancre géographiquement quand la page l'est (ville, province, pays).`
    : `You generate questions a person would ask an AI assistant without knowing the page below, and that this page answers well. Rules: natural, short questions in the page's language, phrased like a real conversation, never naming any company, brand, website or author, never copying the title verbatim. Vary the angles: concrete problem, comparison, "how", "how much", "which tool". Anchor geographically when the page is (city, province, country).`;

  const prompt = [
    `Titre : ${page.title}`,
    page.h1 && page.h1 !== page.title ? `H1 : ${page.h1}` : "",
    page.description ? `Description : ${page.description}` : "",
    page.h2.length ? `Sous-titres : ${page.h2.join(" | ")}` : "",
    `Extrait : ${page.excerpt}`,
    `Nombre de questions : ${count}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await generateText({ model: m.model, system, prompt, output: Output.object({ schema }), maxOutputTokens: 400 });
  const forbidden = forbiddenTerms(project, competitorTerms);
  const questions: GeneratedQuestion[] = [];
  const rejected: Array<{ text: string; term: string }> = [];
  for (const q of res.output?.questions ?? []) {
    const term = violatesNeutrality(q.text, forbidden);
    if (term) rejected.push({ text: q.text, term });
    else questions.push({ text: q.text.trim(), lang, source: "generated" });
  }
  const costUsd = estimateCostUsd(m.provider, {}, { inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens }, m.id);
  return { questions, rejected, costUsd };
}
