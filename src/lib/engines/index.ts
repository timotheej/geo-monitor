import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { perplexity } from "@ai-sdk/perplexity";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Engine, Provider, SourceRef, UsageRef } from "@/db/schema";
import { normalizeDomain } from "@/lib/detection";

export type EngineAnswer = {
  text: string;
  sources: SourceRef[];
  usage: UsageRef;
  latencyMs: number;
};

export type RunPromptOptions = {
  webSearch: boolean;
  lang: string;
  /** Code pays ISO, ex. "FR" */
  country: string;
};

/** Moteurs par défaut créés au seed. Modèle et tarifs modifiables ensuite en base. */
export const DEFAULT_ENGINES: Array<Pick<Engine, "provider" | "model" | "label">> = [
  { provider: "openai", model: "gpt-5.4-mini", label: "ChatGPT" },
  { provider: "anthropic", model: "claude-haiku-4-5", label: "Claude" },
  { provider: "perplexity", model: "sonar", label: "Perplexity" },
  { provider: "google", model: "gemini-3.8-flash", label: "Gemini" },
];

/** La clé Google s'appelle GEMINI_API_KEY dans ce projet (le SDK attend GOOGLE_GENERATIVE_AI_API_KEY par défaut). */
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

/** Perplexity cherche toujours sur le web : pas de mode "mémoire seule". */
export function supportsMode(provider: Provider, webSearch: boolean): boolean {
  return webSearch || provider !== "perplexity";
}

/** Le moteur "mock" ne sort jamais en production : il sert à tester le pipeline sans clés. */
export function hasApiKey(provider: Provider): boolean {
  if (provider === "mock") return process.env.GEO_MOCK_ENGINE === "1" && process.env.NODE_ENV !== "production";
  const key = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    perplexity: "PERPLEXITY_API_KEY",
    google: "GEMINI_API_KEY",
  }[provider];
  return Boolean(process.env[key]);
}

const MOCK_ANSWERS = [
  {
    text: "Pour louer à Lyon, les sites les plus utilisés sont SeLoger, Leboncoin et Gatto.city, qui met en relation particuliers et locataires.",
    urls: ["https://www.seloger.com/immobilier/location", "https://gatto.city/lyon", "https://www.leboncoin.fr/locations"],
  },
  {
    text: "Je recommande Leboncoin et PAP pour éviter les frais d'agence. Bien'ici est aussi une bonne source d'annonces.",
    urls: ["https://www.leboncoin.fr/locations", "https://www.pap.fr/", "https://www.bienici.com/"],
  },
  { text: "Les grands portails comme SeLoger et Bien'ici couvrent l'essentiel du marché.", urls: ["https://www.seloger.com/", "https://www.bienici.com/"] },
];

async function mockAnswer(promptText: string, started: number): Promise<EngineAnswer> {
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));
  let h = 0;
  for (const ch of promptText) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = MOCK_ANSWERS[(h + Math.floor(Math.random() * 2)) % MOCK_ANSWERS.length];
  return {
    text: a.text,
    sources: a.urls.map((url) => ({ url, domain: normalizeDomain(url) })),
    usage: { inputTokens: 400, outputTokens: 120, totalTokens: 520, searches: 1 },
    latencyMs: Date.now() - started,
  };
}

function systemPrompt(lang: string, webSearch: boolean): string {
  const fr = lang.startsWith("fr");
  const base = fr
    ? "Tu es un assistant. Réponds à la question de l'utilisateur de façon utile et naturelle."
    : "You are a helpful assistant. Answer the user's question naturally.";
  if (!webSearch) return base;
  return base + (fr ? " Utilise la recherche web pour t'appuyer sur des sources actuelles." : " Use web search to ground your answer in current sources.");
}

const TIMEZONES: Record<string, string> = { FR: "Europe/Paris", BE: "Europe/Brussels", CH: "Europe/Zurich", CA: "America/Toronto" };

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

function toEngineError(err: unknown): EngineError {
  const e = err as { message?: string; statusCode?: number; status?: number; name?: string };
  const status = e.statusCode ?? e.status;
  const retryable = status === undefined || status === 408 || status === 409 || status === 429 || status >= 500;
  return new EngineError(e.message ?? String(err), retryable, status);
}

/** Sous-ensemble structurel du résultat de generateText, indépendant du jeu d'outils. */
type RawResult = {
  text: string;
  sources: ReadonlyArray<{ sourceType: string; url?: string; title?: string }>;
  steps: ReadonlyArray<{ toolCalls: ReadonlyArray<{ toolName: string }> }>;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  providerMetadata?: Record<string, unknown>;
};

function toAnswer(engine: Engine, res: RawResult, started: number): EngineAnswer {
  const seen = new Set<string>();
  const sources: SourceRef[] = [];
  for (const s of res.sources) {
    if (s.sourceType !== "url" || !s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push({ url: s.url, title: s.title, domain: normalizeDomain(s.url) });
  }
  const searchCalls = res.steps.reduce((n, step) => n + step.toolCalls.filter((c) => c.toolName === "web_search").length, 0);
  const pplxSearches = (res.providerMetadata?.perplexity as { usage?: { numSearchQueries?: number } } | undefined)?.usage
    ?.numSearchQueries;
  // Gemini : le grounding est facturé par requête (prompt), pas par recherche. On compte 1 dès qu'il a cherché.
  const geminiQueries = (res.providerMetadata?.google as { groundingMetadata?: { webSearchQueries?: string[] | null } } | undefined)
    ?.groundingMetadata?.webSearchQueries;
  const searches =
    engine.provider === "perplexity"
      ? (pplxSearches ?? 1)
      : engine.provider === "google"
        ? geminiQueries === undefined
          ? 0
          : geminiQueries?.length
            ? 1
            : 0
        : searchCalls;
  return {
    text: res.text,
    sources,
    usage: {
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      totalTokens: res.usage.totalTokens,
      searches,
    },
    latencyMs: Date.now() - started,
  };
}

export async function runPrompt(engine: Engine, promptText: string, opts: RunPromptOptions): Promise<EngineAnswer> {
  if (!supportsMode(engine.provider, opts.webSearch)) {
    throw new EngineError(`${engine.provider} ne supporte pas le mode sans recherche web`, false);
  }
  const started = Date.now();
  const maxUses = engine.config.maxSearches ?? 5;

  const base = { system: systemPrompt(opts.lang, opts.webSearch), prompt: promptText } as const;

  const finalize = (res: RawResult) => toAnswer(engine, res, started);

  try {
    switch (engine.provider) {
      case "openai":
        return finalize(
          await generateText({
            ...base,
            model: openai(engine.model),
            tools: opts.webSearch
              ? { web_search: openai.tools.webSearch({ userLocation: { type: "approximate", country: opts.country } }) }
              : undefined,
            // Sans cela, les petits modèles répondent souvent de mémoire : on force au moins une recherche.
            toolChoice: opts.webSearch ? { type: "tool", toolName: "web_search" } : undefined,
          }),
        );
      case "anthropic":
        return finalize(
          await generateText({
            ...base,
            model: anthropic(engine.model),
            tools: opts.webSearch
              ? {
                  web_search: anthropic.tools.webSearch_20260209({
                    maxUses,
                    userLocation: { type: "approximate", country: opts.country, timezone: TIMEZONES[opts.country] },
                  }),
                }
              : undefined,
          }),
        );
      case "perplexity":
        return finalize(await generateText({ ...base, model: perplexity(engine.model) }));
      case "google":
        return finalize(
          await generateText({
            ...base,
            model: google(engine.model),
            tools: opts.webSearch ? { google_search: google.tools.googleSearch({}) } : undefined,
          }),
        );
      case "mock":
        return mockAnswer(promptText, started);
      default:
        throw new EngineError(`Fournisseur inconnu : ${String(engine.provider)}`, false);
    }
  } catch (err) {
    if (err instanceof EngineError) throw err;
    throw toEngineError(err);
  }
}

/** Appel avec nouvelles tentatives sur erreurs transitoires (429, 5xx, réseau). */
export async function runPromptWithRetry(
  engine: Engine,
  promptText: string,
  opts: RunPromptOptions,
  attempts = 3,
): Promise<EngineAnswer> {
  let lastErr: EngineError | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      return await runPrompt(engine, promptText, opts);
    } catch (err) {
      const e = err instanceof EngineError ? err : toEngineError(err);
      if (!e.retryable || i === attempts - 1) throw e;
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i + Math.random() * 500));
    }
  }
  throw lastErr ?? new EngineError("Échec inconnu", false);
}
