"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Prompt } from "@/db/schema";
import { deletePrompt, setPromptActive } from "@/lib/actions";
import { formatRate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

export type PromptRow = { prompt: Prompt; citationRate30: number | null };

const ALL = "__all__";
const ACTIVE_ITEMS = [
  { value: ALL, label: "Actifs et inactifs" },
  { value: "active", label: "Actifs seulement" },
  { value: "inactive", label: "Inactifs seulement" },
];

function ActiveSwitch({ prompt }: { prompt: Prompt }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Switch
      size="sm"
      checked={prompt.active}
      disabled={pending}
      aria-label={prompt.active ? "Désactiver ce prompt" : "Activer ce prompt"}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          try {
            await setPromptActive(prompt.id, checked);
            toast.success(checked ? "Prompt activé" : "Prompt désactivé");
            router.refresh();
          } catch (e) {
            toast.error("Impossible de modifier le prompt", { description: e instanceof Error ? e.message : String(e) });
          }
        })
      }
    />
  );
}

function DeleteButton({ prompt }: { prompt: Prompt }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon-xs" aria-label="Supprimer ce prompt" className="text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce prompt ?</AlertDialogTitle>
          <AlertDialogDescription>
            Tous les résultats et détections associés seront supprimés avec lui, et les métriques passées changeront. Pour garder
            l&apos;historique, désactivez-le plutôt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="line-clamp-3 rounded-md bg-muted/50 px-3 py-2 text-sm">{prompt.text}</p>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await deletePrompt(prompt.id);
                  toast.success("Prompt supprimé");
                  setOpen(false);
                  router.refresh();
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

export function PromptsTable({ rows }: { rows: PromptRow[]; projectId: string }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState(ALL);
  const [activeFilter, setActiveFilter] = useState(ALL);

  const tags = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.prompt.tags))).sort(), [rows]);
  const tagItems = [{ value: ALL, label: "Tous les tags" }, ...tags.map((t) => ({ value: t, label: t }))];

  const filtered = rows.filter(({ prompt }) => {
    if (q && !prompt.text.toLowerCase().includes(q.toLowerCase())) return false;
    if (tag !== ALL && !prompt.tags.includes(tag)) return false;
    if (activeFilter === "active" && !prompt.active) return false;
    if (activeFilter === "inactive" && prompt.active) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans le texte" className="pl-8" aria-label="Rechercher un prompt" />
        </div>
        <Select items={tagItems} value={tag} onValueChange={(v) => setTag(v ?? ALL)}>
          <SelectTrigger aria-label="Filtrer par tag" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tagItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={ACTIVE_ITEMS} value={activeFilter} onValueChange={(v) => setActiveFilter(v ?? ALL)}>
          <SelectTrigger aria-label="Filtrer par statut" className="min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVE_ITEMS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} / {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Texte</TableHead>
              <TableHead className="w-16">Langue</TableHead>
              <TableHead className="w-40">Tags</TableHead>
              <TableHead className="w-24">Mode</TableHead>
              <TableHead className="w-28 text-right">Citation 30 j</TableHead>
              <TableHead className="w-16 text-center">Actif</TableHead>
              <TableHead className="w-12 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  {rows.length === 0 ? "Aucun prompt. Ajoutez-en un ou importez un CSV." : "Aucun prompt ne correspond aux filtres."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ prompt, citationRate30 }) => (
                <TableRow key={prompt.id} className={cn(!prompt.active && "text-muted-foreground")}>
                  <TableCell className="max-w-0 pl-4 whitespace-normal">
                    <span className="line-clamp-2 leading-snug">{prompt.text}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs uppercase">{prompt.lang}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {prompt.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-muted-foreground">
                      {prompt.webSearch ? "web" : "mémoire"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    <span className={cn(citationRate30 === null ? "text-muted-foreground/60" : citationRate30 > 0 ? "text-signal" : "")}>
                      {formatRate(citationRate30)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <ActiveSwitch prompt={prompt} />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <DeleteButton prompt={prompt} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
