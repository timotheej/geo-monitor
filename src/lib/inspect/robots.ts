import robotsParser from "robots-parser";

/** Agents des moteurs IA : indexation (crawl) et recherche en direct. */
export const AI_AGENTS = [
  { agent: "GPTBot", vendor: "OpenAI", role: "entraînement" },
  { agent: "OAI-SearchBot", vendor: "OpenAI", role: "recherche ChatGPT" },
  { agent: "ChatGPT-User", vendor: "OpenAI", role: "navigation à la demande" },
  { agent: "ClaudeBot", vendor: "Anthropic", role: "indexation" },
  { agent: "Claude-SearchBot", vendor: "Anthropic", role: "recherche Claude" },
  { agent: "Claude-User", vendor: "Anthropic", role: "navigation à la demande" },
  { agent: "PerplexityBot", vendor: "Perplexity", role: "indexation" },
  { agent: "Perplexity-User", vendor: "Perplexity", role: "navigation à la demande" },
  { agent: "Google-Extended", vendor: "Google", role: "Gemini et AI Overviews" },
] as const;

export type AgentAccess = { agent: string; vendor: string; role: string; allowed: boolean; explicit: boolean };

export type RobotsReport = {
  found: boolean;
  agents: AgentAccess[];
  /** Vrai si tous les agents IA sont autorisés */
  allAllowed: boolean;
};

/**
 * Évalue robots.txt pour l'URL donnée. Sans fichier (404), tout est autorisé.
 * `explicit` indique qu'une règle vise nommément cet agent (sinon c'est la règle `*`).
 */
export function evaluateRobots(robotsUrl: string, contents: string | null, pageUrl: string): RobotsReport {
  if (contents === null) {
    const agents = AI_AGENTS.map((a) => ({ ...a, allowed: true, explicit: false }));
    return { found: false, agents, allAllowed: true };
  }
  const parser = robotsParser(robotsUrl, contents);
  const lower = contents.toLowerCase();
  const agents = AI_AGENTS.map((a) => {
    const allowed = parser.isAllowed(pageUrl, a.agent);
    return { ...a, allowed: allowed !== false, explicit: lower.includes(`user-agent: ${a.agent.toLowerCase()}`) };
  });
  return { found: true, agents, allAllowed: agents.every((a) => a.allowed) };
}
