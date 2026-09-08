import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { CompetitorOverlap } from "@/lib/dashboard-queries";
import { formatInt } from "@/lib/format";
import { normalizeUrl } from "@/lib/inspect/url";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyCard } from "@/components/empty-card";

/** Pour chaque concurrent : les prompts où il est cité sans nous, et ses pages les plus citées. */
export function CompetitorOverlapList({ rows }: { rows: CompetitorOverlap[] }) {
  if (rows.length === 0) {
    return (
      <EmptyCard title="Aucun concurrent déclaré" action={{ href: "/settings?tab=competitors", label: "Ajouter un concurrent" }}>
        Déclarez vos concurrents avec leurs domaines pour voir où ils prennent la place de la marque.
      </EmptyCard>
    );
  }
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Recouvrement par concurrent</h2>
        <p className="text-xs text-muted-foreground">Les prompts où le concurrent est cité alors que la marque ne l&apos;est pas, et ses pages qui reviennent le plus dans les sources.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((c) => (
          <Card key={c.id} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rival" />
                {c.name}
              </CardTitle>
              <CardDescription>
                {c.prompts.length === 0 ? "Aucun prompt gagné sans nous." : `${c.prompts.length} prompt${c.prompts.length > 1 ? "s" : ""} où il est cité sans la marque.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Prompts cités sans nous</h4>
                {c.prompts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Rien sur la période.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {c.prompts.map((p) => (
                      <li key={p.promptId} className="flex items-start gap-2 text-sm">
                        <Link href={`/prompts/${p.promptId}`} className="line-clamp-2 min-w-0 flex-1 leading-snug underline-offset-4 hover:underline">
                          {p.text}
                        </Link>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{formatInt(p.answers)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div>
                <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Pages les plus citées</h4>
                {c.pages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucune page de ce concurrent dans les sources.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {c.pages.map((p) => (
                      <li key={p.url} className="flex items-start gap-2 text-sm">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-1 items-center gap-1 underline-offset-4 hover:underline">
                          <span className="truncate font-mono text-xs">{normalizeUrl(p.url) ?? p.url}</span>
                          <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{formatInt(p.count)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
