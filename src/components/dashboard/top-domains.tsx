import type { DomainRow } from "@/lib/queries";
import { formatInt, formatRate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TopDomains({ rows }: { rows: DomainRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Domaines les plus cités</CardTitle>
        <CardDescription>Sources renvoyées par les moteurs sur la période, tous prompts confondus.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Aucune source pour l&apos;instant.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.domain} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn("truncate text-sm", r.entity === "brand" && "font-medium text-signal")}>{r.domain}</span>
                  {r.entity ? (
                    <Badge variant="outline" className={cn(r.entity === "brand" ? "border-signal/50 text-signal" : "border-rival/50 text-rival")}>
                      {r.entity === "brand" ? "marque" : r.entityName}
                    </Badge>
                  ) : null}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatInt(r.count)} <span className="text-muted-foreground/60">({formatRate(r.share)})</span>
                </span>
                <span className="col-start-2 col-end-4 h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", r.entity === "brand" ? "bg-signal" : r.entity === "competitor" ? "bg-rival/70" : "bg-muted-foreground/40")}
                    style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
