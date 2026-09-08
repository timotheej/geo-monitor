import type { EntityShare } from "@/lib/dashboard-queries";
import { formatInt } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bar, RateDelta, RateValue } from "@/components/dashboard/rate";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";

/** Classement marque + concurrents : citation, mention, variation, prompts où ils apparaissent. */
export function CompetitorRanking({ rows, days }: { rows: EntityShare[]; days: number }) {
  const measured = rows.length > 0 && rows[0].answers > 0;
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Classement</CardTitle>
        <CardDescription>Qui prend notre place : part des réponses où chaque acteur est cité ou mentionné sur {days} jours, variation vs période précédente.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {!measured ? (
          <EmptyCard title="Rien à classer pour l'instant" className="mx-5 my-3 border-0 bg-muted/30" action={{ href: "/settings?tab=competitors", label: "Déclarer des concurrents" }}>
            Le classement se remplit après le premier run. Chaque concurrent a besoin d&apos;au moins un domaine pour compter les citations.
          </EmptyCard>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pl-5">#</TableHead>
                <TableHead>Acteur</TableHead>
                <TableHead className="w-40">Share of voice</TableHead>
                <TableHead className="w-28 text-right">Citation</TableHead>
                <TableHead className="w-24 text-right">Variation</TableHead>
                <TableHead className="w-24 text-right">Mention</TableHead>
                <TableHead className="w-24 pr-5 text-right">Prompts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const brand = r.entityType === "brand";
                return (
                  <TableRow key={`${r.entityType}-${r.entityId}`} className={cn(brand && "bg-signal/5 hover:bg-signal/10")}>
                    <TableCell className="pl-5 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 shrink-0 rounded-full", brand ? "bg-signal" : "bg-rival")} />
                        <span className={cn("truncate text-sm", brand && "font-medium")}>{r.name}</span>
                        {brand ? (
                          <Badge variant="outline" className="border-signal/50 text-signal">
                            marque
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Bar value={r.share ?? 0} color={brand ? "var(--signal)" : "var(--rival)"} className="flex-1" />
                        <RateValue value={r.share} accent="none" className="w-10 text-right text-xs" />
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <RateValue value={r.citationRate} accent={brand ? "signal" : "rival"} className="text-sm" />
                    </TableCell>
                    <TableCell className="text-right">
                      <RateDelta points={r.citationDelta} />
                      {r.citationDelta === null ? <span className="text-xs text-muted-foreground/60">-</span> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <RateValue value={r.mentionRate} accent="none" className="text-sm" />
                    </TableCell>
                    <TableCell className="pr-5 text-right font-mono text-sm tabular-nums">{formatInt(r.promptCount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
