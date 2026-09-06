import { getEngines } from "@/lib/queries";
import { hasApiKey } from "@/lib/engines";

export type EngineKeyStatus = {
  id: string;
  label: string;
  provider: string;
  model: string;
  enabled: boolean;
  hasKey: boolean;
  envVar: string;
};

const ENV_VARS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

/**
 * Moteurs avec l'état de leur clé API (présente ou non dans l'environnement).
 * La clé elle-même ne quitte jamais le serveur : seul le booléen est exposé.
 */
export async function getEngineKeyStatus(): Promise<EngineKeyStatus[]> {
  const list = await getEngines();
  return list.map((e) => ({
    id: e.id,
    label: e.label,
    provider: e.provider,
    model: e.model,
    enabled: e.enabled,
    hasKey: hasApiKey(e.provider),
    envVar: ENV_VARS[e.provider] ?? `${e.provider.toUpperCase()}_API_KEY`,
  }));
}

/** Période lue depuis le searchParam `days`, bornée aux valeurs autorisées. */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parseDays(raw: string | string[] | undefined): Period {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export function firstParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}
