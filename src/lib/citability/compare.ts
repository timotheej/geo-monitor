/**
 * Comparaison signal par signal entre la page cible et les pages citées à sa place (section 5).
 * Médiane des concurrents de même type quand il y en a, sinon de tous, avec `sameTypeOnly = false`.
 */

import type { PageSignals } from "./signals";
import type { PageType } from "./page-type";

export type ComparisonRow = {
  key: string;
  label: string;
  target: number;
  median: number;
  /** target - median, en unités du signal */
  delta: number;
  /** Retard normalisé de la cible sur la médiane, dans [-1, 1] ; positif quand la cible fait moins bien */
  gap: number;
  /** Vrai si la médiane vient de concurrents du même type */
  sameTypeOnly: boolean;
  /** Nombre de pages ayant servi à la médiane */
  sample: number;
  higherIsBetter: boolean;
  unit: string;
};

export type ComparisonMetric = { key: string; label: string; unit: string; higherIsBetter: boolean; value: (s: PageSignals, now: Date) => number };

const MONTH_MS = 30.4375 * 24 * 3600 * 1000;

/** Âge en mois de la date la plus récente (modification, publication), 60 mois si aucune date. */
export function ageInMonths(s: Pick<PageSignals, "dateModified" | "datePublished">, now: Date): number {
  const dates = [s.dateModified, s.datePublished].map((d) => (d ? Date.parse(d) : NaN)).filter((t) => !Number.isNaN(t));
  if (!dates.length) return 60;
  const latest = Math.min(Math.max(...dates), now.getTime());
  return Math.round(((now.getTime() - latest) / MONTH_MS) * 10) / 10;
}

export const COMPARISON_METRICS: ComparisonMetric[] = [
  { key: "wordCount", label: "Mots", unit: "mots", higherIsBetter: true, value: (s) => s.wordCount },
  { key: "numbersCount", label: "Données chiffrées", unit: "", higherIsBetter: true, value: (s) => s.numbersCount },
  { key: "h2Entities", label: "Sous-titres en entités", unit: "", higherIsBetter: true, value: (s) => s.h2Entities },
  { key: "h2Questions", label: "Sous-titres en questions", unit: "", higherIsBetter: true, value: (s) => s.h2Questions },
  { key: "listsCount", label: "Listes", unit: "", higherIsBetter: true, value: (s) => s.listsCount },
  { key: "tablesCount", label: "Tableaux", unit: "", higherIsBetter: true, value: (s) => s.tablesCount },
  { key: "hasFaq", label: "Bloc FAQ", unit: "", higherIsBetter: true, value: (s) => (s.hasFaq ? 1 : 0) },
  { key: "hasSummaryBlock", label: "Bloc résumé", unit: "", higherIsBetter: true, value: (s) => (s.hasSummaryBlock ? 1 : 0) },
  { key: "outboundDomains", label: "Sources externes", unit: "domaines", higherIsBetter: true, value: (s) => s.outboundDomains.length },
  { key: "quoteCount", label: "Citations attribuées", unit: "", higherIsBetter: true, value: (s) => s.quoteCount },
  { key: "ageMonths", label: "Âge de la page", unit: "mois", higherIsBetter: false, value: (s, now) => ageInMonths(s, now) },
  { key: "author", label: "Auteur nommé", unit: "", higherIsBetter: true, value: (s) => (s.author ? 1 : 0) },
  { key: "organizationSchema", label: "Schéma Organization", unit: "", higherIsBetter: true, value: (s) => (s.organizationSchema ? 1 : 0) },
  { key: "sameAs", label: "Profils sameAs", unit: "", higherIsBetter: true, value: (s) => s.sameAs.length },
];

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type Competitor = { signals: PageSignals; pageType: PageType };

export function compareSignals(
  target: PageSignals,
  competitors: Competitor[],
  opts: { targetType?: PageType; now?: Date } = {},
): ComparisonRow[] {
  const now = opts.now ?? new Date();
  const sameType = opts.targetType ? competitors.filter((c) => c.pageType === opts.targetType) : [];
  const pool = sameType.length ? sameType : competitors;
  const sameTypeOnly = sameType.length > 0;
  const rows = COMPARISON_METRICS.map((m): ComparisonRow => {
    const t = m.value(target, now);
    const med = median(pool.map((c) => m.value(c.signals, now)));
    const delta = t - med;
    const scale = Math.max(Math.abs(t), Math.abs(med), 1);
    const gap = Math.round(((m.higherIsBetter ? med - t : t - med) / scale) * 100) / 100;
    return { key: m.key, label: m.label, target: t, median: med, delta, gap, sameTypeOnly, sample: pool.length, higherIsBetter: m.higherIsBetter, unit: m.unit };
  });
  return rows.sort((a, b) => b.gap - a.gap || a.label.localeCompare(b.label));
}

/** Les n plus grands retards de la cible sur la médiane (gap > 0). */
export function topGaps(rows: ComparisonRow[], n = 3): ComparisonRow[] {
  return [...rows]
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, n);
}
