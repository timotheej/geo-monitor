import type { Overview } from "@/lib/queries";
import { formatDelta, formatEur, formatInt, formatRate } from "@/lib/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function Tile({
  label,
  value,
  delta,
  hint,
  accent,
  empty,
  sub,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint: string;
  accent?: boolean;
  empty?: boolean;
  sub?: string;
}) {
  const d = formatDelta(delta);
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4 first:pl-5 sm:border-l first:sm:border-l-0">
      <Tooltip>
        <TooltipTrigger render={<span className="w-fit cursor-default text-sm text-muted-foreground decoration-dotted underline-offset-4 hover:underline" />}>
          {label}
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-pretty">{hint}</TooltipContent>
      </Tooltip>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-3xl tracking-tight tabular-nums", accent && !empty ? "text-signal" : "", empty ? "text-muted-foreground/60" : "")}>
          {value}
        </span>
        {d ? (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              (delta ?? 0) > 0 ? "text-signal" : (delta ?? 0) < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {d}
          </span>
        ) : null}
      </div>
      {empty ? <span className="text-xs text-muted-foreground">pas encore mesuré</span> : sub ? <span className="font-mono text-xs text-muted-foreground tabular-nums">{sub}</span> : null}
    </div>
  );
}

export function KpiStrip({ overview }: { overview: Overview }) {
  const noData = overview.answers === 0;
  return (
    <section aria-label="Indicateurs" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
        <Tile
          label="Taux de citation"
          value={formatRate(overview.citationRate)}
          delta={overview.citationDelta}
          accent
          empty={overview.citationRate === null}
          hint="Part des réponses où un domaine de la marque apparaît dans les sources. Variation vs la période précédente."
        />
        <Tile
          label="Taux de mention"
          value={formatRate(overview.mentionRate)}
          delta={overview.mentionDelta}
          empty={overview.mentionRate === null}
          hint="Part des réponses où le nom de la marque ou un alias apparaît dans le texte."
        />
        <Tile
          label="Share of voice"
          value={formatRate(overview.shareOfVoice)}
          empty={overview.shareOfVoice === null}
          hint="Citations de la marque rapportées aux citations de la marque et des concurrents."
        />
        <Tile
          label="Coût du mois"
          value={formatEur(overview.costMonthEur)}
          sub={`runs ${formatEur(overview.costRunsEur)}, inspections ${formatEur(overview.costInspectionsEur)}`}
          hint={`Estimation des appels API depuis le 1er du mois, convertie en euros : ${formatEur(overview.costRunsEur)} pour les runs quotidiens et ${formatEur(overview.costInspectionsEur)} pour les inspections d'URL. Indicatif, pas une facture.`}
        />
      </div>
      <div className="border-t px-5 py-2 text-xs text-muted-foreground">
        {noData ? "Aucune réponse analysée sur la période." : `${formatInt(overview.answers)} réponse${overview.answers > 1 ? "s" : ""} analysée${overview.answers > 1 ? "s" : ""} sur la période.`}
      </div>
    </section>
  );
}
