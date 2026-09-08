import type { DomainOpportunity } from "@/lib/dashboard-queries";
import { formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EngineMark } from "@/components/engines/engine-logo";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";
import { AddCompetitorButton } from "@/components/competitors/add-competitor-button";

/** Domaines cités quand la marque ne l'est pas : les sites où obtenir une mention ou une fiche. */
export function DomainsInstead({ rows, hasData, projectId }: { rows: DomainOpportunity[]; hasData: boolean; projectId: string }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Domaines cités à notre place</CardTitle>
        <CardDescription>
          Sites que les moteurs citent dans des réponses où la marque est absente. « Présent » signifie que la marque est citée dans au moins une réponse où ce domaine apparaît aussi.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <EmptyCard title={hasData ? "La marque est citée partout où une source apparaît" : "Pas encore de sources"} className="mx-5 my-3 border-0 bg-muted/30">
            {hasData ? "Aucun domaine tiers n'apparaît sans la marque sur la période." : "Les domaines apparaissent après le premier run avec recherche web."}
          </EmptyCard>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Domaine</TableHead>
                <TableHead className="w-28 text-right">Sans nous</TableHead>
                <TableHead className="w-24 text-right">Réponses</TableHead>
                <TableHead className="w-24">Marque</TableHead>
                <TableHead className="w-28 pr-5">Moteurs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.domain} className="group">
                  <TableCell className="pl-5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm">{r.domain}</span>
                      {r.entity ? (
                        <Badge variant="outline" className="border-rival/50 text-rival">
                          {r.entityName}
                        </Badge>
                      ) : (
                        <AddCompetitorButton projectId={projectId} domain={r.domain} />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatInt(r.withoutBrand)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">{formatInt(r.answers)}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1.5 text-xs", r.brandPresent ? "text-signal" : "text-muted-foreground")}>
                      <span className={cn("size-2 rounded-full", r.brandPresent ? "bg-signal" : "border border-dashed border-muted-foreground/50")} />
                      {r.brandPresent ? "présente" : "absente"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-5">
                    <span className="flex items-center gap-1">
                      {r.engines.map((e) => (
                        <Tooltip key={e.id}>
                          <TooltipTrigger render={<span className="inline-flex" />}>
                            <EngineMark provider={e.provider} size="sm" />
                          </TooltipTrigger>
                          <TooltipContent>{e.label}</TooltipContent>
                        </Tooltip>
                      ))}
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
