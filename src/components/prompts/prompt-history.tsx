import Link from "next/link";
import type { PromptResult } from "@/lib/dashboard-queries";
import { formatDateTime, formatEur, formatInt, formatLatency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EngineMark } from "@/components/engines/engine-logo";
import { StatusDot, StatusLegend, STATUS_LABEL } from "@/components/status-dot";
import { ResultLink } from "@/components/result/result-link";
import { EmptyCard } from "@/components/empty-card";

/** Historique par moteur : une pastille par réponse, chronologique, qui ouvre le drawer. */
export function PromptTimeline({ results, days }: { results: PromptResult[]; days: number }) {
  const byEngine = new Map<string, { engine: PromptResult["engine"]; items: PromptResult[] }>();
  for (const r of results) {
    const g = byEngine.get(r.engine.id) ?? { engine: r.engine, items: [] };
    g.items.push(r);
    byEngine.set(r.engine.id, g);
  }
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Historique par moteur</CardTitle>
        <CardDescription>Une pastille par réponse sur {days} jours, de la plus ancienne à la plus récente. Cliquez pour ouvrir la réponse.</CardDescription>
        <StatusLegend className="mt-1" />
      </CardHeader>
      <CardContent>
        {results.length === 0 ? (
          <EmptyCard title="Aucune réponse sur la période" className="border-0 bg-muted/30 py-6">
            Ce prompt n&apos;a pas encore été posé aux moteurs sur {days} jours. Vérifiez qu&apos;il est actif, puis lancez un run.
          </EmptyCard>
        ) : (
          <ul className="space-y-3">
            {Array.from(byEngine.values()).map(({ engine, items }) => {
              const cited = items.filter((i) => i.status === "cited").length;
              return (
                <li key={engine.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <EngineMark provider={engine.provider} size="sm" />
                    <span className="truncate">{engine.label}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {items.map((r) => (
                      <Tooltip key={r.id}>
                        <TooltipTrigger
                          render={
                            <ResultLink
                              resultId={r.id}
                              aria-label={`${formatDateTime(r.createdAt)} : ${STATUS_LABEL[r.status]}`}
                              className="grid size-6 place-items-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                          }
                        >
                          <StatusDot status={r.status} className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatDateTime(r.createdAt)}, {STATUS_LABEL[r.status].toLowerCase()}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {cited} / {items.length} cité{cited > 1 ? "s" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Liste des réponses, la plus récente en premier, avec ouverture du drawer. */
export function PromptResultsTable({ results }: { results: PromptResult[] }) {
  const rows = [...results].reverse();
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Réponses</CardTitle>
        <CardDescription>Chaque ligne ouvre la réponse brute avec ses sources et ses détections.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Aucune réponse sur la période.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Date</TableHead>
                <TableHead className="w-32">Moteur</TableHead>
                <TableHead className="w-28">Marque</TableHead>
                <TableHead>Concurrents cités</TableHead>
                <TableHead className="w-20 text-right">Sources</TableHead>
                <TableHead className="w-20 text-right">Latence</TableHead>
                <TableHead className="w-24 pr-5 text-right">Coût</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="relative">
                  <TableCell className="pl-5 font-mono text-xs tabular-nums">
                    <ResultLink resultId={r.id} className="after:absolute after:inset-0 hover:underline underline-offset-4">
                      {formatDateTime(r.createdAt)}
                    </ResultLink>
                    <Link href={`/runs/${r.runId}`} className="relative z-10 ml-2 text-muted-foreground underline-offset-4 hover:underline">
                      run
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      <EngineMark provider={r.engine.provider} size="sm" />
                      {r.engine.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-xs">
                      <StatusDot status={r.status} />
                      {r.status === "cited" ? "citée" : r.status === "mentioned" ? "mentionnée" : r.status === "error" ? "erreur" : "absente"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {r.competitors.length === 0 ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        r.competitors.map((c) => (
                          <Badge key={c} variant="outline" className="border-rival/50 text-rival">
                            {c}
                          </Badge>
                        ))
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{r.error ? "-" : formatInt(r.sourcesCount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{formatLatency(r.latencyMs)}</TableCell>
                  <TableCell className="pr-5 text-right font-mono text-xs tabular-nums">{formatEur(r.costEur, true)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
