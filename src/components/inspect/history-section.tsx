import Link from "next/link";
import type { UrlHistoryRow } from "@/lib/inspect/queries";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Section } from "./section";

export function HistorySection({ rows, days }: { rows: UrlHistoryRow[]; days: number }) {
  return (
    <Section title="Historique dans les runs quotidiens" description={`Apparitions de cette URL dans les sources des réponses des ${days} derniers jours, paramètres de suivi ignorés.`}>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Cette URL n&apos;est jamais apparue dans les sources des runs quotidiens.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-3">Date</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead className="w-32">Moteur</TableHead>
                <TableHead className="w-16 pr-3 text-right">Rang</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.resultId}-${r.rank}`} className="relative">
                  <TableCell className="pl-3 text-muted-foreground">
                    <Link href={`/runs?result=${r.resultId}`} className="after:absolute after:inset-0 hover:underline underline-offset-4">
                      {formatDateTime(r.date)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal">
                    <span className="line-clamp-2 leading-snug">{r.promptText}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.engineLabel}</Badge>
                  </TableCell>
                  <TableCell className="pr-3 text-right font-mono text-sm tabular-nums">{r.rank}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}
