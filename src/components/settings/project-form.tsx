"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Project } from "@/db/schema";
import { updateProject } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = Object.fromEntries(fd.entries());
    startTransition(async () => {
      try {
        await updateProject(project.id, input);
        toast.success("Projet enregistré");
        router.refresh();
      } catch (err) {
        toast.error("Projet non enregistré", { description: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Projet et marque</CardTitle>
          <CardDescription>Ce que les règles de détection cherchent dans les réponses : les domaines pour la citation, le nom et les alias pour la mention.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="p-name">Nom du projet</FieldLabel>
                <Input id="p-name" name="name" defaultValue={project.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-brand">Nom de la marque</FieldLabel>
                <Input id="p-brand" name="brandName" defaultValue={project.brandName} required />
                <FieldDescription>Cherché tel quel, avec frontières de mot.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="p-aliases">Alias</FieldLabel>
              <Input id="p-aliases" name="aliases" defaultValue={project.aliases.join(", ")} placeholder="Gatto.city, gatto city" />
              <FieldDescription>Autres façons d&apos;écrire la marque, séparées par des virgules.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="p-domains">Domaines</FieldLabel>
              <Input id="p-domains" name="domains" defaultValue={project.domains.join(", ")} placeholder="gatto.city" required className="font-mono" />
              <FieldDescription>Sous-domaines inclus automatiquement. Au moins un domaine.</FieldDescription>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="p-locale">Locale</FieldLabel>
                <Input id="p-locale" name="locale" defaultValue={project.locale} className="font-mono" required />
                <FieldDescription>Langue et pays passés aux moteurs.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="p-repeats">Répétitions</FieldLabel>
                <Input id="p-repeats" name="repeats" type="number" min={1} max={10} defaultValue={project.repeats} className="font-mono" required />
                <FieldDescription>Réponses par prompt et par moteur à chaque run.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="p-cap">Plafond par run (€)</FieldLabel>
                <Input id="p-cap" name="costCapEur" type="number" min={0.5} max={500} step={0.5} defaultValue={project.costCapEur} className="font-mono" required />
                <FieldDescription>Au-delà, le run s&apos;arrête en échec.</FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement" : "Enregistrer"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
