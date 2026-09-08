import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Opportunity } from "@/lib/dashboard-queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyCard } from "@/components/empty-card";

/** Prompts où un concurrent est cité et pas la marque : le premier chantier. */
export function QuickOpportunities({ rows, hasData }: { rows: Opportunity[]; hasData: boolean }) {
  return (
    <Card>
      <CardHeader className="grid-cols-[1fr_auto] items-start">
        <div className="space-y-1">
          <CardTitle>Opportunités rapides</CardTitle>
          <CardDescription>Prompts où un concurrent est cité alors que la marque ne l&apos;est pas.</CardDescription>
        </div>
        <Link href="/sources" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Tout voir
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyCard
            title={hasData ? "Aucun prompt perdu face à un concurrent" : "Pas encore de réponses"}
            className="border-0 bg-muted/30 py-6"
            action={hasData ? { href: "/settings?tab=competitors", label: "Vérifier les concurrents" } : undefined}
          >
            {hasData
              ? "Sur la période, aucun concurrent déclaré n'est cité sans la marque. Vérifiez que leurs domaines sont bien renseignés."
              : "Les opportunités apparaissent après le premier run."}
          </EmptyCard>
        ) : (
          <ol className="divide-y">
            {rows.map((o) => (
              <li key={o.promptId} className="group relative flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-1">
                  <Link href={`/prompts/${o.promptId}`} className="line-clamp-2 text-sm leading-snug after:absolute after:inset-0 group-hover:underline underline-offset-4">
                    {o.text}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1">
                    {o.competitors.map((c) => (
                      <Badge key={c.id} variant="outline" className="border-rival/50 text-rival">
                        {c.name}
                        <span className="font-mono text-[10px] tabular-nums opacity-70">{c.answers}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                  {o.answers} rép.
                </span>
                <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
