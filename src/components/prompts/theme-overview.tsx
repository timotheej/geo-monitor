import Link from "next/link";
import type { ThemeRow } from "@/lib/dashboard-queries";
import { formatInt, formatRate } from "@/lib/format";
import { EngineDot, engineColor } from "@/components/engines/engine-logo";
import { Bar, RateValue } from "@/components/dashboard/rate";
import { EmptyCard } from "@/components/empty-card";

/** Un bloc par thème (tag) : taux marque, nombre de prompts, mini-barres par moteur. */
export function ThemeOverview({ rows, days }: { rows: ThemeRow[]; days: number }) {
  if (rows.length === 0) {
    return (
      <EmptyCard title="Aucun prompt pour l'instant">
        Ajoutez les questions que vos clients posent aux assistants IA, avec un tag par thème (ex. « location », « prix ») pour lire la visibilité par sujet.
      </EmptyCard>
    );
  }
  const measured = rows.some((r) => r.answers > 0);
  return (
    <div className="space-y-3">
      {!measured ? (
        <EmptyCard title="Les taux par thème apparaissent après le premier run" className="bg-muted/30">
          Les prompts sont prêts. Lancez un run depuis l&apos;en-tête pour interroger les moteurs.
        </EmptyCard>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => (
          <article key={t.theme} className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <header className="flex items-baseline justify-between gap-3">
              <h3 className="truncate text-sm font-medium">{t.theme}</h3>
              <Link href={`/prompts?tab=manage&tag=${encodeURIComponent(t.theme)}`} className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums underline-offset-4 hover:underline">
                {formatInt(t.promptCount)} prompt{t.promptCount > 1 ? "s" : ""}
              </Link>
            </header>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">Citation</dt>
                <dd>
                  <RateValue value={t.citationRate} className="text-2xl tracking-tight" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mention</dt>
                <dd>
                  <RateValue value={t.mentionRate} accent="none" className="text-2xl tracking-tight" />
                </dd>
              </div>
            </dl>
            {t.engines.length > 0 ? (
              <ul className="space-y-1.5">
                {t.engines.map((e) => {
                  const r = e.total ? e.cited / e.total : 0;
                  return (
                    <li key={e.id} className="grid grid-cols-[minmax(0,6rem)_1fr_3rem] items-center gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <EngineDot provider={e.provider} />
                        <span className="truncate">{e.label}</span>
                      </span>
                      <Bar value={r} color={engineColor(e.provider)} thin />
                      <span className="text-right font-mono text-muted-foreground tabular-nums">{formatRate(r)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Pas de réponse sur {days} jours.</p>
            )}
            <p className="mt-auto font-mono text-xs text-muted-foreground tabular-nums">{formatInt(t.answers)} réponse{t.answers > 1 ? "s" : ""}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
