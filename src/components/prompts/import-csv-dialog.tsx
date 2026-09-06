"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { importPromptsCsv } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE = `Quels sites pour louer un appartement à Lyon ?;fr;location,lyon;oui
Comment trouver un logement sans agence ?;fr;location;non
Where can I rent a flat in Paris?;en;location,paris`;

export function ImportCsvDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [pending, startTransition] = useTransition();
  const lines = csv.split(/\r?\n/).filter((l) => l.trim()).length;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const content = String(new FormData(e.currentTarget).get("csv") ?? csv);
    startTransition(async () => {
      try {
        const { imported } = await importPromptsCsv(projectId, content);
        toast.success(`${imported} prompt${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}`);
        setOpen(false);
        setCsv("");
        router.refresh();
      } catch (err) {
        toast.error("Import annulé, aucune ligne n'a été enregistrée", { description: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload data-icon="inline-start" />
        Importer CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>Importer des prompts</DialogTitle>
            <DialogDescription>Une ligne par prompt, sans en-tête. Les lignes vides sont ignorées.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
            <p className="mb-1 font-medium text-foreground">Format des colonnes, séparées par un point-virgule</p>
            <p className="text-muted-foreground">
              <code className="font-mono text-foreground">texte;langue;tag1,tag2;web</code>. Seul le texte est obligatoire. Langue par
              défaut <code className="font-mono">fr</code>. Dernière colonne <code className="font-mono">oui</code> ou{" "}
              <code className="font-mono">non</code> pour la recherche web (oui par défaut).
            </p>
          </div>
          <Field>
            <FieldLabel htmlFor="csv">Contenu</FieldLabel>
            <Textarea
              id="csv"
              name="csv"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={EXAMPLE}
              required
              spellCheck={false}
              className="min-h-40 font-mono text-xs"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Import en cours" : lines > 0 ? `Importer ${lines} ligne${lines > 1 ? "s" : ""}` : "Importer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
