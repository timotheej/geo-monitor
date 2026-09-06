import type { getRun } from "@/lib/queries";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatEur, formatLatency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResultLink } from "@/components/result/result-link";
import { StatusDot } from "@/components/status-dot";
import { cn } from "@/lib/utils";

type Rows = NonNullable<Awaited<ReturnType<typeof getRun>>>["results"];

function YesNo({ value, tone }: { value: boolean | null; tone: "signal" | "rival" }) {
  if (value === null) return <span className="text-muted-foreground/50">-</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", value ? (tone === "signal" ? "text-signal" : "text-rival") : "text-muted-foreground")}>
      <StatusDot status={value ? (tone === "signal" ? "cited" : "mentioned") : "none"} />
      {value ? "oui" : "non"}
    </span>
  );
}

export function RunResultsTable({ results, live }: { results: Rows; live: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Prompt</TableHead>
            <TableHead className="w-28">Moteur</TableHead>
            <TableHead className="w-20">Cité</TableHead>
            <TableHead className="w-24">Mentionné</TableHead>
            <TableHead className="w-20 text-right">Latence</TableHead>
            <TableHead className="w-24 text-right">Coût</TableHead>
            <TableHead className="w-40 pr-4">Erreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                {live ? "Les premiers résultats arrivent dans quelques secondes." : "Aucun résultat : ce run n'a exécuté aucune tâche."}
              </TableCell>
            </TableRow>
          ) : (
            results.map(({ result, promptText, engineLabel, cited, mentioned }) => (
              <TableRow key={result.id} className="relative">
                <TableCell className="max-w-0 pl-4 whitespace-normal">
                  <ResultLink resultId={result.id} className="line-clamp-2 leading-snug after:absolute after:inset-0 hover:underline underline-offset-4">
                    {promptText}
                  </ResultLink>
                  <span className="text-xs text-muted-foreground">{result.webSearch ? "web" : "mémoire"}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{engineLabel}</Badge>
                </TableCell>
                <TableCell>
                  <YesNo value={result.error ? null : cited} tone="signal" />
                </TableCell>
                <TableCell>
                  <YesNo value={result.error ? null : mentioned} tone="rival" />
                </TableCell>
                <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">{formatLatency(result.latencyMs)}</TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{formatEur(result.costEstimate * USD_TO_EUR, true)}</TableCell>
                <TableCell className="pr-4">
                  {result.error ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="relative z-10 block max-w-40 truncate font-mono text-xs text-destructive" />}>
                        {result.error}
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm break-words">{result.error}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground/50">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
