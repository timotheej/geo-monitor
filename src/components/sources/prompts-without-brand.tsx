import Link from "next/link";
import type { PromptWithoutBrand } from "@/lib/dashboard-queries";
import { formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyCard } from "@/components/empty-card";

/** Prompts jamais cités sur la période, ceux où les concurrents sont cités en premier. */
export function PromptsWithoutBrand({ rows, hasData }: { rows: PromptWithoutBrand[]; hasData: boolean }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Prompts sans nous</CardTitle>
        <CardDescription>Questions posées sur la période où la marque n&apos;a jamais été citée. Les prompts où des concurrents sont cités viennent en premier.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <EmptyCard title={hasData ? "La marque est citée au moins une fois sur chaque prompt" : "Pas encore de réponses"} className="mx-5 my-3 border-0 bg-muted/30">
            {hasData ? "Rien à rattraper sur la période." : "La liste apparaît après le premier run."}
          </EmptyCard>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Prompt</TableHead>
                <TableHead className="w-48">Concurrents cités</TableHead>
                <TableHead className="w-24 text-right">Réponses</TableHead>
                <TableHead className="w-28 pr-5 text-right">Mentionnée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.promptId}>
                  <TableCell className="max-w-0 pl-5 whitespace-normal">
                    <Link href={`/prompts/${r.promptId}`} className="line-clamp-2 text-sm leading-snug underline-offset-4 hover:underline">
                      {r.text}
                    </Link>
                    {r.tags.length ? (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="font-normal">
                            {t}
                          </Badge>
                        ))}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {r.competitors.length === 0 ? (
                        <span className="text-xs text-muted-foreground">aucun</span>
                      ) : (
                        r.competitors.map((c) => (
                          <Badge key={c} variant="outline" className="border-rival/50 text-rival">
                            {c}
                          </Badge>
                        ))
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatInt(r.answers)}</TableCell>
                  <TableCell className="pr-5 text-right font-mono text-sm text-muted-foreground tabular-nums">
                    {r.mentioned ? `${formatInt(r.mentioned)} fois` : "jamais"}
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
