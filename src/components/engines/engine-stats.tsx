import type { EngineStats } from "@/lib/dashboard-queries";
import { formatEur, formatInt, formatLatency, formatRate } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EngineMark } from "@/components/engines/engine-logo";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";

function Stat({ label, value, hint, muted }: { label: string; value: string; hint: string; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Tooltip>
        <TooltipTrigger render={<span className="w-fit cursor-default text-xs text-muted-foreground decoration-dotted underline-offset-4 hover:underline" />}>{label}</TooltipTrigger>
        <TooltipContent className="max-w-64 text-pretty">{hint}</TooltipContent>
      </Tooltip>
      <span className={cn("font-mono text-lg tracking-tight tabular-nums", muted && "text-muted-foreground/60")}>{value}</span>
    </div>
  );
}

/** Chiffres clés par moteur : latence médiane, coût moyen, sources moyennes, part avec sources. */
export function EngineStatsGrid({ rows }: { rows: EngineStats[] }) {
  if (rows.length === 0) {
    return (
      <EmptyCard title="Pas encore de chiffres par moteur" action={{ href: "/settings?tab=engines", label: "Vérifier les moteurs" }}>
        Lancez un run pour comparer latence, coût et sources de chaque moteur.
      </EmptyCard>
    );
  }
  return (
    <section aria-label="Chiffres clés par moteur" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((r) => (
        <article key={r.engine.id} className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <header className="flex items-center gap-3">
            <EngineMark provider={r.engine.provider} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.engine.label}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{r.model}</p>
            </div>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {formatInt(r.answers)} rép.
              {r.errors ? <span className="text-destructive">, {r.errors} err.</span> : null}
            </span>
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <Stat label="Latence" value={formatLatency(r.medianLatencyMs)} hint="Latence médiane des réponses sans erreur." muted={r.medianLatencyMs === null} />
            <Stat label="Coût / rép." value={formatEur(r.avgCostEur, true)} hint="Coût moyen estimé d'une réponse, en euros." muted={r.avgCostEur === null} />
            <Stat
              label="Sources"
              value={r.avgSources === null ? "-" : r.avgSources.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
              hint="Nombre moyen de sources renvoyées par réponse."
              muted={r.avgSources === null}
            />
            <Stat label="Avec source" value={formatRate(r.withSourcesRate)} hint="Part des réponses qui citent au moins une source. Sans source, seule la mention peut compter." muted={r.withSourcesRate === null} />
          </dl>
        </article>
      ))}
    </section>
  );
}
