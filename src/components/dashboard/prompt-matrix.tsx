import Link from "next/link";
import type { Engine } from "@/db/schema";
import type { MatrixRow } from "@/lib/queries";
import { formatRate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot, StatusLegend, STATUS_LABEL } from "@/components/status-dot";
import { ResultLink } from "@/components/result/result-link";
import { cn } from "@/lib/utils";

export function PromptMatrix({ rows, engines, days }: { rows: MatrixRow[]; engines: Engine[]; days: number }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Prompts × moteurs</CardTitle>
        <CardDescription>Dernier résultat connu pour chaque couple, et taux de citation sur {days} jours. Une pastille ouvre la réponse brute, le texte ouvre la fiche du prompt.</CardDescription>
        <StatusLegend className="mt-1" />
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-8">
            <p className="text-sm text-muted-foreground">Aucun prompt pour l&apos;instant. Ajoutez les questions que vos clients posent aux assistants IA.</p>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/prompts" />}>
              Gérer les prompts
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Prompt</TableHead>
                <TableHead className="w-24 text-center">Mode</TableHead>
                {engines.map((e) => (
                  <TableHead key={e.id} className="w-24 text-center">
                    {e.label}
                  </TableHead>
                ))}
                <TableHead className="w-28 pr-5 text-right">Citation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ prompt, cells, citationRate }) => (
                <TableRow key={prompt.id} className={cn(!prompt.active && "opacity-50")}>
                  <TableCell className="max-w-0 pl-5 whitespace-normal">
                    <Link href={`/prompts/${prompt.id}`} className="line-clamp-2 text-sm leading-snug underline-offset-4 hover:underline">
                      {prompt.text}
                    </Link>
                    {!prompt.active ? <span className="text-xs text-muted-foreground">désactivé</span> : null}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-muted-foreground">
                      {prompt.webSearch ? "web" : "mémoire"}
                    </Badge>
                  </TableCell>
                  {engines.map((e) => {
                    const cell = cells[e.id] ?? { status: "empty" as const, resultId: null };
                    const dot = (
                      <span className="grid size-7 place-items-center rounded-md">
                        <StatusDot status={cell.status} className="size-3" />
                      </span>
                    );
                    return (
                      <TableCell key={e.id} className="text-center">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              cell.resultId ? (
                                <ResultLink
                                  resultId={cell.resultId}
                                  className="inline-flex rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                                  aria-label={`${e.label} : ${STATUS_LABEL[cell.status]}`}
                                />
                              ) : (
                                <span className="inline-flex" />
                              )
                            }
                          >
                            {dot}
                          </TooltipTrigger>
                          <TooltipContent>{STATUS_LABEL[cell.status]}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                  <TableCell className="pr-5 text-right font-mono text-sm tabular-nums">
                    <span className={cn(citationRate === null ? "text-muted-foreground/60" : citationRate > 0 ? "text-signal" : "")}>
                      {formatRate(citationRate)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
