"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Competitor } from "@/db/schema";
import { addCompetitor, deleteCompetitor } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

function DeleteCompetitor({ competitor }: { competitor: Competitor }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon-xs" aria-label={`Supprimer ${competitor.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {competitor.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Ses détections passées disparaissent du share of voice. Les réponses brutes sont conservées, un recalcul pourra les réintégrer si vous le rajoutez.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await deleteCompetitor(competitor.id);
                  toast.success(`${competitor.name} supprimé`);
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

export function CompetitorsPanel({ projectId, competitors }: { projectId: string; competitors: Competitor[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(e.currentTarget).entries());
    startTransition(async () => {
      try {
        await addCompetitor(projectId, input);
        toast.success(`${String(input.name)} ajouté aux concurrents`);
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        toast.error("Concurrent non ajouté", { description: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Concurrents suivis</CardTitle>
          <CardDescription>Mêmes règles de détection que pour la marque. Ils alimentent le share of voice et le surlignage des réponses.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {competitors.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Aucun concurrent. Sans concurrent, le share of voice vaut toujours 100 %.</p>
          ) : (
            <ul className="divide-y border-t">
              {competitors.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-rival" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.domains.map((d) => (
                        <Badge key={d} variant="outline" className="font-mono font-normal text-muted-foreground">
                          {d}
                        </Badge>
                      ))}
                      {c.aliases.map((a) => (
                        <Badge key={a} variant="secondary" className="font-normal">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <DeleteCompetitor competitor={c} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <form ref={formRef} onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un concurrent</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="c-name">Nom</FieldLabel>
                <Input id="c-name" name="name" required placeholder="SeLoger" />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-domains">Domaines</FieldLabel>
                <Input id="c-domains" name="domains" required placeholder="seloger.com" className="font-mono" />
                <FieldDescription>Séparés par des virgules, au moins un.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="c-aliases">Alias</FieldLabel>
                <Input id="c-aliases" name="aliases" placeholder="Se Loger" />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Ajout en cours" : "Ajouter"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
