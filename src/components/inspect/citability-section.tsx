import { AlertTriangle, ExternalLink } from "lucide-react";
import type { JudgeQuestionNotes, PageAnalysis } from "@/db/schema";
import type { ComparisonRow } from "@/lib/citability/compare";
import { INTENT_LABEL, type QuestionIntent } from "@/lib/citability/classify-question";
import { PAGE_TYPE_LABEL, type PageType } from "@/lib/citability/page-type";
import { CONFIDENCE_LABEL, isAnalysisStale, recommendedReading, toAnalysisView, type AnalysisView, type ScoreBlock } from "@/lib/citability/reading";
import { GRID_VERSION, scoreLabel, type SignalScore } from "@/lib/citability/score";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatDateTime, formatEur, formatInt, formatRate } from "@/lib/format";
import { plural } from "@/lib/inspect/verdict";
import { EngineMark } from "@/components/engines/engine-logo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Section } from "./section";
import { CitabilityLaunch, CitabilityRelaunch } from "./citability-launch";

const JUDGE_COST_USD = 0.003;

/** Coût affiché avant le lancement : lecture du modèle par question, arrondi au centime supérieur. */
function estimatedCostLabel(questions: number, judgeAvailable: boolean): string {
  if (!judgeAvailable) return "gratuit";
  const eur = Math.ceil(questions * JUDGE_COST_USD * USD_TO_EUR * 100) / 100;
  return `environ ${formatEur(eur)}`;
}

const LIMITS = [
  "L'indice ne prédit pas une citation : il situe la page et explique les écarts avec celles qui sont citées.",
  "Il ne mesure pas la notoriété hors page (mentions, avis, liens), qui pèse lourd au moment de la sélection.",
  "Il n'est pas comparable entre moteurs sans le détail par moteur.",
  "Il change avec les moteurs et avec la grille : chaque analyse porte sa date et sa version.",
];

export function CitabilitySection({ inspectionId, questions, analysis, judgeAvailable }: { inspectionId: string; questions: number; analysis: PageAnalysis | null; judgeAvailable: boolean }) {
  if (!analysis) {
    return (
      <Section title="Citabilité" description="Étape 3, optionnelle. Où la page se situe face aux moteurs IA, et pourquoi.">
        <CitabilityLaunch inspectionId={inspectionId} questions={questions} costLabel={estimatedCostLabel(questions, judgeAvailable)} judgeAvailable={judgeAvailable} />
      </Section>
    );
  }

  const view = toAnalysisView(analysis);

  if (view.status === "failed") {
    return (
      <Section title="Citabilité" description={`Analyse du ${formatDateTime(view.createdAt)}, grille ${view.gridVersion}.`} actions={<CitabilityRelaunch inspectionId={inspectionId} />}>
        <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">L&apos;analyse s&apos;est arrêtée</p>
            <p className="mt-0.5 text-destructive/90">{view.error ?? "Erreur inconnue."}</p>
          </div>
        </div>
      </Section>
    );
  }

  if (view.status === "running") {
    return (
      <Section title="Citabilité" description={`Analyse lancée le ${formatDateTime(view.createdAt)}.`} actions={<CitabilityRelaunch inspectionId={inspectionId} />}>
        <p className="text-sm text-muted-foreground">Une analyse est en cours ou a été interrompue. Rechargez la page dans une minute, ou relancez-la.</p>
      </Section>
    );
  }

  const stale = isAnalysisStale(view, GRID_VERSION);
  const reading = recommendedReading(view.access, view.content, view.result);
  const caps = [...view.access.caps, ...view.content.caps];

  return (
    <Section
      title="Citabilité"
      description={
        <>
          Analyse du {formatDateTime(view.finishedAt ?? view.createdAt)}, grille <span className="font-mono">{view.gridVersion}</span>, coût{" "}
          <span className="font-mono tabular-nums">{formatEur(view.costEstimate * USD_TO_EUR, true)}</span>.
          {stale ? (view.gridVersion !== GRID_VERSION ? ` La grille en vigueur est ${GRID_VERSION} : relancez pour comparer.` : " Plus de 7 jours : la page et les réponses ont pu changer.") : null}
        </>
      }
      actions={stale ? <CitabilityRelaunch inspectionId={inspectionId} /> : undefined}
    >
      <ScoreHeader view={view} />

      <div className={cn("rounded-lg border p-3 text-sm", reading.key === "access-low" ? "border-destructive/30 bg-destructive/10" : reading.key === "neutral" ? "bg-muted/40" : "border-signal/30 bg-signal/5")}>
        <p className="font-medium">{reading.title}</p>
        <p className="mt-0.5 text-muted-foreground">{reading.text}</p>
      </div>

      {caps.length ? (
        <div className="flex gap-3 rounded-lg border border-rival/40 bg-rival/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rival" />
          <div>
            <p className="font-medium">Plafonds appliqués</p>
            <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
              {caps.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {LIMITS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <div className="space-y-2 border-t pt-4">
        <SignalDetails title="Détail des points : Accès" block={view.access} />
        <SignalDetails title="Détail des points : Contenu" block={view.content}>
          <ByQuestionTable view={view} />
        </SignalDetails>
      </div>

      <WhySection view={view} />
      <JudgeSection judge={view.judge} />
    </Section>
  );
}

/* ----------------------------------------------------------------------------
 * Indice, jauges et résultat par moteur
 * -------------------------------------------------------------------------- */

function ScoreHeader({ view }: { view: AnalysisView }) {
  const answers = view.result.perEngine.reduce((s, e) => s + e.answers, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
        <div className="lg:pr-6">
          <p className="text-xs text-muted-foreground">Indice de citabilité</p>
          <p className="font-mono text-6xl leading-none font-medium tracking-tight tabular-nums">
            {view.score}
            <span className="text-2xl text-muted-foreground/60"> / 100</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className={cn("font-normal", view.confidence === "low" ? "border-rival/50 text-rival" : view.confidence === "high" ? "border-signal/50 text-signal" : "")}>
              {CONFIDENCE_LABEL[view.confidence]}
            </Badge>
            <span className="font-mono">grille {view.gridVersion}</span>
            {view.pageType ? <span>{PAGE_TYPE_LABEL[view.pageType].toLowerCase()}</span> : null}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Gauge label="Accès" block={view.access} hint="La page est-elle atteignable et lisible par les robots" />
          <Gauge label="Contenu" block={view.content} hint="Est-elle faite pour répondre à ce type de question" />
          <Gauge label="Résultat" block={view.result} hint={`Reprise réelle dans le test, ${answers} ${plural(answers, "réponse")}`} />
        </div>
      </div>
      <PerEngineList view={view} />
    </div>
  );
}

const LABEL_TONE = { faible: "text-destructive", moyen: "text-rival", bon: "text-signal" } as const;
const BAR_TONE = { faible: "bg-destructive/70", moyen: "bg-rival", bon: "bg-signal" } as const;

function Gauge({ label, block, hint }: { label: string; block: Pick<ScoreBlock, "total" | "max">; hint: string }) {
  const level = scoreLabel(block.total, block.max || 1);
  const pct = block.max ? Math.max(0, Math.min(100, (block.total / block.max) * 100)) : 0;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("text-xs", LABEL_TONE[level])}>{level}</span>
      </div>
      <p className="mt-1 font-mono text-2xl leading-none tabular-nums">
        {block.total}
        <span className="text-sm text-muted-foreground/70"> / {block.max}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={block.max} aria-valuenow={block.total} aria-label={`${label} ${block.total} sur ${block.max}`}>
        <div className={cn("h-full rounded-full", BAR_TONE[level])} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function PerEngineList({ view }: { view: AnalysisView }) {
  const engines = view.result.perEngine;
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Résultat par moteur</h4>
      {!engines.length ? (
        <p className="text-sm text-muted-foreground">Aucune réponse exploitable dans le test.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {engines.map((e) => {
            const parts = [
              e.cited ? `${e.cited} citée${e.cited > 1 ? "s" : ""}` : null,
              e.domainCited ? `${e.domainCited} autre page` : null,
              e.retrieved ? `${e.retrieved} lue${e.retrieved > 1 ? "s" : ""} non citée${e.retrieved > 1 ? "s" : ""}` : null,
              e.mentioned ? `${e.mentioned} mention${e.mentioned > 1 ? "s" : ""}` : null,
            ].filter(Boolean);
            return (
              <li key={e.engineId} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
                <EngineMark provider={e.provider} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {parts.length ? parts.join(", ") : "rien"} sur {e.answers} {plural(e.answers, "réponse")}
                  </span>
                </span>
                <span className={cn("shrink-0 font-mono tabular-nums", e.value === 0 ? "text-muted-foreground" : "text-signal")}>{formatRate(e.value)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Détail des points
 * -------------------------------------------------------------------------- */

function formatValue(v: SignalScore["value"]): string {
  if (v === null || v === undefined) return "-";
  if (v === true) return "oui";
  if (v === false) return "non";
  if (typeof v === "number") return formatInt(v);
  return v;
}

function SignalDetails({ title, block, children }: { title: string; block: ScoreBlock; children?: React.ReactNode }) {
  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm select-none [&::-webkit-details-marker]:hidden">
        <span className="font-medium group-open:underline underline-offset-4">{title}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {block.total} / {block.max}
        </span>
      </summary>
      <div className="space-y-3 border-t px-3 py-3">
        {block.caps.length ? (
          <p className="flex gap-2 rounded-md border border-rival/40 bg-rival/10 px-2.5 py-1.5 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rival" />
            <span>{block.caps.join(" ; ")}</span>
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Signal</th>
                <th className="py-1.5 pr-3 font-medium">Valeur</th>
                <th className="py-1.5 pr-3 text-right font-medium">Points</th>
                <th className="py-1.5 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {block.rows.map((r) => {
                const zero = r.max > 0 && r.points === 0;
                const full = r.max > 0 && r.points === r.max;
                return (
                  <tr key={r.key} className="align-top">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{r.label}</td>
                    <td className="max-w-56 truncate py-1.5 pr-3 font-mono text-xs tabular-nums" title={typeof r.value === "string" ? r.value : undefined}>
                      {formatValue(r.value)}
                    </td>
                    <td className={cn("py-1.5 pr-3 text-right font-mono text-xs whitespace-nowrap tabular-nums", zero ? "text-destructive" : full ? "text-signal" : "")}>
                      {r.max === 0 ? "info" : `${r.points} / ${r.max}`}
                    </td>
                    <td className="py-1.5 text-xs text-muted-foreground">{r.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {children}
      </div>
    </details>
  );
}

function ByQuestionTable({ view }: { view: AnalysisView }) {
  const rows = view.content.byQuestion;
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">
        Le bloc Contenu affiché est celui de la question médiane. Points par question, sur {view.content.max} :
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-2.5 py-1.5 font-medium">Question</th>
              <th className="px-2.5 py-1.5 font-medium">Type</th>
              <th className="px-2.5 py-1.5 font-medium">Lieu</th>
              <th className="px-2.5 py-1.5 text-right font-medium">Points</th>
              <th className="px-2.5 py-1.5 font-medium">Lecture</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((q, i) => (
              <tr key={i}>
                <td className="px-2.5 py-1.5">
                  <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  {q.question}
                </td>
                <td className="px-2.5 py-1.5 text-xs whitespace-nowrap text-muted-foreground">{INTENT_LABEL[q.intent] ?? q.intent}</td>
                <td className="px-2.5 py-1.5 text-xs whitespace-nowrap text-muted-foreground">{q.place ?? "-"}</td>
                <td className={cn("px-2.5 py-1.5 text-right font-mono text-xs tabular-nums", LABEL_TONE[scoreLabel(q.total, view.content.max || 1)])}>{q.total}</td>
                <td className="px-2.5 py-1.5 text-xs whitespace-nowrap text-muted-foreground">{q.judged ? "modèle" : "heuristiques seules"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Pourquoi : typologie, comparaison, pages
 * -------------------------------------------------------------------------- */

const BOOLEAN_METRICS = new Set(["hasFaq", "hasSummaryBlock", "author", "organizationSchema"]);

function formatMetric(row: ComparisonRow, v: number): string {
  if (BOOLEAN_METRICS.has(row.key)) return v === 1 ? "oui" : v === 0 ? "non" : `${Math.round(v * 100)} % des pages`;
  const n = Number.isInteger(v) ? formatInt(v) : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return row.unit ? `${n} ${row.unit}` : n;
}

function formatDeltaRow(row: ComparisonRow): string {
  if (row.delta === 0) return "égal";
  if (BOOLEAN_METRICS.has(row.key)) return row.delta > 0 ? "en plus" : "en moins";
  const abs = Math.abs(row.delta);
  const n = Number.isInteger(abs) ? formatInt(abs) : abs.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return `${row.delta > 0 ? "+" : "-"}${n}${row.unit ? ` ${row.unit}` : ""}`;
}

function WhySection({ view }: { view: AnalysisView }) {
  const { comparison } = view;
  const fetched = comparison.pages.filter((p) => !p.error);
  const sample = comparison.rows[0]?.sample ?? 0;
  const gapKeys = new Set(comparison.topGaps.map((g) => g.key));
  const typeLabel = view.pageType ? PAGE_TYPE_LABEL[view.pageType].toLowerCase() : "même type";

  return (
    <div className="space-y-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Pourquoi</h3>
        <p className="text-xs text-muted-foreground">Sur les questions où l&apos;URL n&apos;est pas citée, les trois premières pages citées par chaque moteur sont récupérées et mesurées avec les mêmes signaux. Écart observé, pas causalité.</p>
      </div>

      {!comparison.pages.length ? (
        <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Aucune page tierce à comparer : l&apos;URL a été citée dans toutes les réponses exploitables, ou les moteurs n&apos;ont renvoyé aucune source.</p>
      ) : (
        <>
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">Typologie des pages citées à la place</h4>
            {comparison.typology.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {comparison.typology.map((t) => (
                  <li key={t.type} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{t.label}</span>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {t.count} {plural(t.count, "page")}
                      </span>
                    </div>
                    {t.examples.length ? <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{Array.from(new Set(t.examples)).join(", ")}</p> : null}
                    <p className="mt-1.5 text-xs">{t.action}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune page tierce n&apos;a pu être lue, la typologie est vide.</p>
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">Comparaison signal par signal</h4>
            {comparison.rows.length ? (
              <>
                {comparison.topGaps.length ? (
                  <p className="mb-2 text-sm">
                    <span className="font-medium">Plus grands écarts : </span>
                    {comparison.topGaps.map((g, i) => (
                      <span key={g.key}>
                        {i > 0 ? " ; " : ""}
                        {g.label.toLowerCase()} <span className="font-mono text-xs tabular-nums">{formatMetric(g, g.target)}</span> contre <span className="font-mono text-xs tabular-nums">{formatMetric(g, g.median)}</span>
                      </span>
                    ))}
                    .
                  </p>
                ) : (
                  <p className="mb-2 text-sm text-signal">Aucun retard sur les pages citées : la page fait au moins aussi bien sur chaque signal mesuré.</p>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Signal</th>
                        <th className="px-3 py-2 text-right font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-full bg-signal" />
                            Notre page
                          </span>
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-full bg-rival" />
                            Médiane des pages citées
                          </span>
                        </th>
                        <th className="px-3 py-2 text-right font-medium">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {comparison.rows.map((r) => {
                        const top = gapKeys.has(r.key);
                        const tone = r.gap > 0 ? "text-rival" : r.gap < 0 ? "text-signal" : "text-muted-foreground";
                        return (
                          <tr key={r.key} className={cn(top && "bg-rival/5")}>
                            <td className="px-3 py-1.5">
                              {r.label}
                              {top ? (
                                <Badge variant="outline" className="ml-2 border-rival/50 font-normal text-rival">
                                  écart
                                </Badge>
                              ) : null}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap tabular-nums">{formatMetric(r, r.target)}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatMetric(r, r.median)}</td>
                            <td className={cn("px-3 py-1.5 text-right font-mono text-xs whitespace-nowrap tabular-nums", tone)}>{formatDeltaRow(r)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {comparison.sameTypeOnly
                    ? `Médiane des ${sample} ${plural(sample, "page")} citées du même type que la nôtre (${typeLabel}).`
                    : `Aucune page citée du même type que la nôtre (${typeLabel}) : médiane de toutes les ${sample} ${plural(sample, "page")} citées lues.`}{" "}
                  Pour l&apos;âge, plus c&apos;est bas, mieux c&apos;est. Écart en <span className="text-rival">orange</span> quand notre page fait moins bien, en <span className="text-signal">vert</span> quand elle fait mieux.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune page tierce lisible : pas de comparaison possible.</p>
            )}
          </div>

          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm select-none [&::-webkit-details-marker]:hidden">
              <span className="font-medium group-open:underline underline-offset-4">Pages comparées</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {fetched.length} / {comparison.pages.length} {plural(comparison.pages.length, "lue")}
              </span>
            </summary>
            <ul className="divide-y border-t">
              {comparison.pages.map((p) => (
                <li key={p.url} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.url} className="group/src inline-flex min-w-0 max-w-full items-center gap-1 font-mono text-xs hover:underline underline-offset-4">
                    <span className="truncate">{p.domain}</span>
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                  </a>
                  <Badge variant="secondary" className="font-normal">
                    {p.typeLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Q{p.questions.map((q) => q + 1).join(", Q")} · {p.engines.join(", ")}
                  </span>
                  {p.error ? <span className="ml-auto text-xs text-destructive">{p.error}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Lecture du modèle
 * -------------------------------------------------------------------------- */

function Score3({ label, value }: { label: string; value: 0 | 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex gap-0.5" aria-label={`${label} ${value} sur 3`}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("block h-2 w-3 rounded-sm", i <= value ? "bg-signal" : "bg-muted")} />
        ))}
      </span>
      <span className="font-mono tabular-nums">{value}/3</span>
    </span>
  );
}

function JudgeSection({ judge }: { judge: JudgeQuestionNotes[] }) {
  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Lecture du modèle</h3>
        <p className="text-xs text-muted-foreground">Avis du modèle, pas une règle : une lecture automatique varie d&apos;un appel à l&apos;autre. Les notes alimentent B1, B2 et B4 ; forces, manques et actions sont reproduits tels quels.</p>
      </div>
      {!judge.length ? (
        <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">Le modèle n&apos;a pas été sollicité : aucun moteur OpenAI ou Anthropic disponible, ou plafond de dépense atteint. La grille a utilisé ses replis heuristiques.</p>
      ) : (
        <ol className="space-y-2">
          {judge.map((j, i) => (
            <li key={i}>
              <details className="group rounded-lg border">
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm select-none [&::-webkit-details-marker]:hidden">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 group-open:underline underline-offset-4">{j.question}</span>
                  <span className="flex flex-wrap items-center gap-3">
                    <Score3 label="adéquation" value={j.fit} />
                    <Score3 label="réponse directe" value={j.directAnswer} />
                    <Score3 label="spécificité" value={j.specificity} />
                  </span>
                </summary>
                <div className="space-y-3 border-t px-3 py-3 text-sm">
                  <p className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="font-normal">
                      question {INTENT_LABEL[j.intent as QuestionIntent] ?? j.intent}
                    </Badge>
                    {j.place ? (
                      <Badge variant="secondary" className="font-normal">
                        lieu attendu : {j.place}
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="font-normal">
                      page : {(PAGE_TYPE_LABEL as Record<string, string>)[j.pageType as PageType] ?? j.pageType}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground">{j.fitNote}</p>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Réponse directe</p>
                    {j.directAnswerPassage ? (
                      <blockquote className="border-l-2 border-signal/50 pl-3 text-sm italic">{j.directAnswerPassage}</blockquote>
                    ) : (
                      <p className="text-sm text-muted-foreground">Absente : aucun passage court ne répond à la question dans le premier quart de la page.</p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <JudgeList title="Forces" items={j.strengths} tone="text-signal" />
                    <JudgeList title="Manques" items={j.gaps} tone="text-rival" />
                    <JudgeList title="Actions" items={j.actions} tone="text-foreground" />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function JudgeList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <p className={cn("mb-1 text-xs font-medium", tone)}>{title}</p>
      {items.length ? (
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {items.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Rien de signalé.</p>
      )}
    </div>
  );
}
