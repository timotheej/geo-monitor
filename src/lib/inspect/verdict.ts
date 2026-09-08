/** Lecture des réponses d'une inspection. Pur, utilisable côté client. */

import type { InspectionAnswer, SourceRef } from "@/db/schema";
import { sameSite } from "./url";

export type CompetitorLike = { name: string; domains: string[] };

export type CellKind = "url" | "domain" | "competitor" | "none" | "error" | "pending";

export const CELL_LABEL: Record<CellKind, string> = {
  url: "URL citée",
  domain: "Autre page du site citée",
  competitor: "Concurrent cité",
  none: "Rien",
  error: "Erreur",
  pending: "En attente",
};

/** Propriétaire d'une source : la marque, un concurrent, ou personne. */
export function sourceOwner(
  source: SourceRef,
  brandDomains: string[],
  competitors: CompetitorLike[],
): { kind: "brand" | "competitor"; name: string } | null {
  if (brandDomains.some((d) => sameSite(source.url, d))) return { kind: "brand", name: "marque" };
  const c = competitors.find((c) => c.domains.some((d) => sameSite(source.url, d)));
  return c ? { kind: "competitor", name: c.name } : null;
}

export function competitorCited(answer: Pick<InspectionAnswer, "sources">, competitors: CompetitorLike[]): boolean {
  return answer.sources.some((s) => competitors.some((c) => c.domains.some((d) => sameSite(s.url, d))));
}

export function cellKind(answer: Pick<InspectionAnswer, "error" | "urlCited" | "domainCited" | "sources"> | undefined, competitors: CompetitorLike[]): CellKind {
  if (!answer) return "pending";
  if (answer.error) return "error";
  if (answer.urlCited) return "url";
  if (answer.domainCited) return "domain";
  if (competitorCited(answer, competitors)) return "competitor";
  return "none";
}

export type Verdict = { ok: number; urlCited: number; domainOnly: number; competitorOnly: number; errors: number };

export function computeVerdict(answers: Array<Pick<InspectionAnswer, "error" | "urlCited" | "domainCited" | "sources">>, competitors: CompetitorLike[]): Verdict {
  const v: Verdict = { ok: 0, urlCited: 0, domainOnly: 0, competitorOnly: 0, errors: 0 };
  for (const a of answers) {
    if (a.error) {
      v.errors += 1;
      continue;
    }
    v.ok += 1;
    if (a.urlCited) v.urlCited += 1;
    else if (a.domainCited) v.domainOnly += 1;
    else if (competitorCited(a, competitors)) v.competitorOnly += 1;
  }
  return v;
}

export type CitedInsteadRow = { domain: string; count: number; owner: { kind: "brand" | "competitor"; name: string } | null };

/** Domaines les plus fréquents dans les sources des réponses où l'URL n'est pas citée (un compte par réponse). */
export function citedInstead(
  answers: Array<Pick<InspectionAnswer, "error" | "urlCited" | "sources">>,
  brandDomains: string[],
  competitors: CompetitorLike[],
  limit = 8,
): CitedInsteadRow[] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    if (a.error || a.urlCited) continue;
    const seen = new Set<string>();
    for (const s of a.sources) {
      const d = (s.domain || "").toLowerCase().replace(/^www\./, "");
      if (!d || seen.has(d)) continue;
      seen.add(d);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([domain, count]) => ({ domain, count, owner: sourceOwner({ url: `https://${domain}/`, domain }, brandDomains, competitors) }));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n > 1 ? many : one;
}

/** URL sans le schéma ni le www, pour tenir sur une ligne. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}
