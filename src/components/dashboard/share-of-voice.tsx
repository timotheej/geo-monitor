import Link from "next/link";
import type { EntityShare } from "@/lib/dashboard-queries";
import { formatInt, formatRate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar } from "@/components/dashboard/rate";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";

/** Barres horizontales marque et concurrents : citation (pleine) et mention (fine), tri décroissant. */
export function ShareOfVoiceBars({ rows }: { rows: EntityShare[] }) {
  const measured = rows.length > 0 && rows[0].answers > 0;
  const competitors = rows.filter((r) => r.entityType === "competitor").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Share of voice</CardTitle>
        <CardDescription>Part des réponses où chaque acteur est cité (barre pleine) ou mentionné (barre fine).</CardDescription>
      </CardHeader>
      <CardContent>
        {!measured ? (
          <EmptyCard title="Rien à comparer pour l'instant" className="border-0 bg-muted/30 py-6">
            Le classement se remplit après le premier run.
          </EmptyCard>
        ) : (
          <ol className="space-y-3">
            {rows.map((r) => {
              const brand = r.entityType === "brand";
              const color = brand ? "var(--signal)" : "var(--rival)";
              return (
                <li key={`${r.entityType}-${r.entityId}`} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={cn("truncate", brand && "font-medium text-signal")}>{r.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      <span className={cn("text-foreground", brand && "text-signal")}>{formatRate(r.citationRate)}</span> cité
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      {formatRate(r.mentionRate)} mentionné
                    </span>
                  </div>
                  <Bar value={r.citationRate ?? 0} color={color} />
                  <Bar value={r.mentionRate ?? 0} color={color} thin className="opacity-50" />
                </li>
              );
            })}
          </ol>
        )}
        {measured && competitors === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Aucun concurrent déclaré :{" "}
            <Link href="/settings?tab=competitors" className="underline underline-offset-4 hover:text-foreground">
              ajoutez-en
            </Link>{" "}
            pour comparer.
          </p>
        ) : measured ? (
          <p className="mt-4 text-xs text-muted-foreground">Sur {formatInt(rows[0].answers)} réponses analysées.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
