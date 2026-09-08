import type { getEngineDomains } from "@/lib/dashboard-queries";
import { formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EngineMark, engineColor } from "@/components/engines/engine-logo";
import { Bar } from "@/components/dashboard/rate";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";

type Rows = Awaited<ReturnType<typeof getEngineDomains>>;

/** Pour chaque moteur, ses domaines les plus cités : on voit d'un coup d'œil sur quoi chaque IA s'appuie. */
export function EngineDomains({ rows }: { rows: Rows }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Sources par moteur</h2>
        <p className="text-xs text-muted-foreground">Les 8 domaines les plus cités par chaque moteur sur la période, avec la part des réponses qui les citent.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyCard title="Aucune source pour l'instant">Les domaines cités apparaissent après le premier run avec recherche web.</EmptyCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ engine, answers, domains }) => {
            const color = engineColor(engine.provider);
            return (
              <Card key={engine.id} size="sm">
                <CardHeader className="grid-cols-[auto_1fr] items-center gap-2">
                  <EngineMark provider={engine.provider} />
                  <div>
                    <CardTitle>{engine.label}</CardTitle>
                    <CardDescription className="font-mono text-xs tabular-nums">{formatInt(answers)} réponses</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {domains.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">Aucune source renvoyée par ce moteur.</p>
                  ) : (
                    <ol className="space-y-2">
                      {domains.map((d, i) => (
                        <li key={d.domain} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={cn("truncate text-sm", d.entity === "brand" && "font-medium text-signal")}>{d.domain}</span>
                            {d.entity ? (
                              <Badge variant="outline" className={cn(d.entity === "brand" ? "border-signal/50 text-signal" : "border-rival/50 text-rival")}>
                                {d.entity === "brand" ? "marque" : d.entityName}
                              </Badge>
                            ) : null}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatInt(d.count)}</span>
                          <Bar value={d.count} max={answers} color={d.entity === "brand" ? "var(--signal)" : d.entity === "competitor" ? "var(--rival)" : color} thin className="col-start-2 col-end-4" />
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
