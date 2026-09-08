"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { EngineKeyStatus } from "@/lib/ui-queries";
import { updateEngine } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function EngineCard({ engine }: { engine: EngineKeyStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(enabled: boolean) {
    startTransition(async () => {
      try {
        await updateEngine(engine.id, { enabled });
        toast.success(`${engine.label} ${enabled ? "activé" : "désactivé"}`);
        router.refresh();
      } catch (e) {
        toast.error("Modification impossible", { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const model = String(fd.get("model") ?? "").trim();
    const raw = String(fd.get("maxSearches") ?? "").trim();
    const maxSearches = raw ? Number(raw) : undefined;
    startTransition(async () => {
      try {
        await updateEngine(engine.id, { model, maxSearches });
        toast.success(`${engine.label} enregistré`);
        router.refresh();
      } catch (err) {
        toast.error("Moteur non enregistré", { description: err instanceof Error ? err.message : String(err) });
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <Card className={cn(!engine.enabled && "opacity-70")}>
        <CardHeader className="grid-cols-[1fr_auto] items-center">
          <div>
            <CardTitle>{engine.label}</CardTitle>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs">
              <span className={cn("grid size-4 place-items-center rounded-full", engine.hasKey ? "bg-signal/20 text-signal" : "bg-muted text-muted-foreground")}>
                {engine.hasKey ? <Check className="size-2.5" /> : <X className="size-2.5" />}
              </span>
              <code className="font-mono text-muted-foreground">{engine.envVar}</code>
              <span className="text-muted-foreground">{engine.hasKey ? "détectée" : "absente"}</span>
            </p>
          </div>
          <Switch checked={engine.enabled} disabled={pending} onCheckedChange={toggle} aria-label={`Activer ${engine.label}`} />
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`m-${engine.id}`}>Modèle</FieldLabel>
              <Input id={`m-${engine.id}`} name="model" defaultValue={engine.model} className="font-mono" required />
              <FieldDescription>Identifiant exact chez {engine.provider}.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`s-${engine.id}`}>Recherches max par réponse</FieldLabel>
              <Input id={`s-${engine.id}`} name="maxSearches" type="number" min={1} max={20} defaultValue={engine.maxSearches ?? ""} placeholder="défaut du moteur (5)" className="font-mono" />
              <FieldDescription>Limite le coût des prompts en mode web.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Enregistrer
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export function EnginesPanel({ engines }: { engines: EngineKeyStatus[] }) {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Les clés API se renseignent dans <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> (ou dans les variables
        d&apos;environnement Vercel), jamais ici. Un moteur activé sans clé est ignoré au moment du run.
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {engines.map((e) => (
          <EngineCard key={e.id} engine={e} />
        ))}
      </div>
    </div>
  );
}
