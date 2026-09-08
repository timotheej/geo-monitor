"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { InspectionSummary } from "@/lib/inspect/ui-queries";
import { deleteInspectionAction } from "@/lib/inspect/actions";
import { shortUrl } from "@/lib/inspect/verdict";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatDateTime, formatEur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InspectionStatusBadge } from "./inspection-status";
import { cn } from "@/lib/utils";

export function DeleteInspectionButton({
  inspectionId,
  url,
  afterDelete,
  variant = "icon",
}: {
  inspectionId: string;
  url: string;
  afterDelete?: () => void;
  variant?: "icon" | "text";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {variant === "icon" ? (
        <Button variant="ghost" size="icon-xs" aria-label="Supprimer cette inspection" className="relative z-10 text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
          <Trash2 />
        </Button>
      ) : (
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
          <Trash2 data-icon="inline-start" />
          Supprimer
        </Button>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette inspection ?</AlertDialogTitle>
          <AlertDialogDescription>Le rapport et les réponses des moteurs seront supprimés. Les prompts éventuellement ajoutés au suivi quotidien restent en place.</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="truncate rounded-md bg-muted/50 px-3 py-2 font-mono text-xs">{shortUrl(url)}</p>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await deleteInspectionAction(inspectionId);
                  toast.success("Inspection supprimée");
                  setOpen(false);
                  if (afterDelete) afterDelete();
                  else router.refresh();
                } catch (e) {
                  toast.error("Suppression impossible", { description: e instanceof Error ? e.message : String(e) });
                }
              })
            }
          >
            {pending ? "Suppression" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Summary({ row }: { row: InspectionSummary }) {
  if (row.status === "running") {
    return (
      <span className="flex items-center gap-2">
        <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-signal" style={{ width: `${row.plannedCount ? Math.min(100, (row.doneCount / row.plannedCount) * 100) : 0}%` }} />
        </span>
        <span className="font-mono text-xs tabular-nums">
          {row.doneCount} / {row.plannedCount}
        </span>
      </span>
    );
  }
  if (row.status === "draft") return <span className="text-xs text-muted-foreground">test non lancé</span>;
  if (row.ok === 0) return <span className="text-xs text-muted-foreground">{row.status === "failed" ? "aucune réponse" : "-"}</span>;
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <span className={cn("font-mono tabular-nums", row.urlCited > 0 ? "text-signal" : "text-muted-foreground")}>
        URL citée {row.urlCited} / {row.ok}
      </span>
      {row.domainCited > 0 ? <span className="text-muted-foreground">autre page du site : {row.domainCited}</span> : null}
    </span>
  );
}

export function InspectionsTable({ rows }: { rows: InspectionSummary[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">URL</TableHead>
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="w-28">Statut</TableHead>
            <TableHead className="w-24 text-right">Questions</TableHead>
            <TableHead className="w-44">Résultat</TableHead>
            <TableHead className="w-24 text-right">Coût</TableHead>
            <TableHead className="w-12 pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="relative">
              <TableCell className="max-w-0 pl-4">
                <Link href={`/inspect/${row.id}`} className="block truncate font-mono text-xs after:absolute after:inset-0 hover:underline underline-offset-4" title={row.url}>
                  {shortUrl(row.url)}
                </Link>
                {row.page?.title ? <span className="block truncate text-xs text-muted-foreground">{row.page.title}</span> : null}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
              <TableCell>
                <InspectionStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{row.questions.length}</TableCell>
              <TableCell>
                <Summary row={row} />
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums">{formatEur(row.costEstimate * USD_TO_EUR)}</TableCell>
              <TableCell className="pr-3 text-right">
                <DeleteInspectionButton inspectionId={row.id} url={row.url} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
