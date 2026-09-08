import type { EngineConfig, Provider, UsageRef } from "@/db/schema";

export type Pricing = NonNullable<EngineConfig["pricing"]>;

/**
 * Tarifs publics en USD relevés le 6 septembre 2026 (OpenAI, Anthropic, Perplexity) et le 8 septembre 2026 (Google).
 * Servent à l'estimation affichée dans l'UI, pas à la facturation.
 * Surchargeables par moteur via `engines.config.pricing`.
 */
export const MODEL_PRICING: Record<string, Pricing> = {
  // OpenAI : recherche web 10 USD / 1000 appels, contenu de recherche facturé au tarif du modèle
  "gpt-5.5": { inputPerMTok: 5, outputPerMTok: 30, perSearch: 0.01 },
  "gpt-5.4": { inputPerMTok: 2.5, outputPerMTok: 15, perSearch: 0.01 },
  "gpt-5.4-mini": { inputPerMTok: 0.75, outputPerMTok: 4.5, perSearch: 0.01 },
  "gpt-5.4-nano": { inputPerMTok: 0.2, outputPerMTok: 1.25, perSearch: 0.01 },
  // Anthropic : recherche web 10 USD / 1000 recherches
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25, perSearch: 0.01 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10, perSearch: 0.01 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5, perSearch: 0.01 },
  // Perplexity : frais par requête selon la taille du contexte (medium)
  sonar: { inputPerMTok: 1, outputPerMTok: 1, perSearch: 0.008 },
  "sonar-pro": { inputPerMTok: 3, outputPerMTok: 15, perSearch: 0.01 },
  // Google : grounding Google Search 14 USD / 1000 requêtes groundées sur Gemini 3.x (5000 gratuites par mois),
  // compté une fois par réponse. Tarif lancement des 3.7 et 3.8 Flash jusqu'au 31 décembre 2026 (1,5 / 7,5 ensuite).
  "gemini-3.8-flash": { inputPerMTok: 0.75, outputPerMTok: 3.75, perSearch: 0.014 },
  "gemini-3.7-flash": { inputPerMTok: 0.75, outputPerMTok: 3.75, perSearch: 0.014 },
  "gemini-3.5-flash": { inputPerMTok: 1.5, outputPerMTok: 9, perSearch: 0.014 },
  "gemini-3.5-flash-lite": { inputPerMTok: 0.3, outputPerMTok: 2.5, perSearch: 0.014 },
  // Gemini 2.5 : grounding 35 USD / 1000 requêtes après 1500 par jour gratuites
  "gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5, perSearch: 0.035 },
};

export const DEFAULT_PRICING: Record<Provider, Pricing> = {
  openai: MODEL_PRICING["gpt-5.4"],
  anthropic: MODEL_PRICING["claude-opus-5"],
  perplexity: MODEL_PRICING["sonar"],
  google: MODEL_PRICING["gemini-3.8-flash"],
  mock: { inputPerMTok: 0, outputPerMTok: 0, perSearch: 0 },
};

export const USD_TO_EUR = 0.92;

export function pricingFor(provider: Provider, model: string, config: EngineConfig): Pricing {
  return config.pricing ?? MODEL_PRICING[model] ?? DEFAULT_PRICING[provider];
}

export function estimateCostUsd(provider: Provider, config: EngineConfig, usage: UsageRef, model = ""): number {
  const p = pricingFor(provider, model, config);
  const input = ((usage.inputTokens ?? 0) / 1_000_000) * p.inputPerMTok;
  const output = ((usage.outputTokens ?? 0) / 1_000_000) * p.outputPerMTok;
  const searches = (usage.searches ?? 0) * p.perSearch;
  return input + output + searches;
}
