import Link from "next/link";
import { Check, KeyRound, X } from "lucide-react";
import type { EngineKeyStatus } from "@/lib/ui-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyDashboard({ keys, promptCount }: { keys: EngineKeyStatus[]; promptCount: number }) {
  const ready = keys.filter((k) => k.enabled && k.hasKey);
  const missing = keys.filter((k) => k.enabled && !k.hasKey);

  return (
    <Card>
      <CardContent className="grid gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-md">
          <h2 className="text-lg font-medium tracking-tight">Pas encore de réponses analysées</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Le tableau de bord se remplit dès qu&apos;un run a interrogé les moteurs. Deux choses sont nécessaires : au moins une clé
            API dans <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code>, puis un run lancé depuis le
            bouton en haut à droite. Le cron quotidien prendra ensuite le relais.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/settings?tab=engines" />}>
              Vérifier les moteurs
            </Button>
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/prompts" />}>
              {promptCount} prompt{promptCount > 1 ? "s" : ""} actif{promptCount > 1 ? "s" : ""}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-muted-foreground" />
            Clés API détectées
          </div>
          <ul className="space-y-2">
            {keys.map((k) => (
              <li key={k.id} className={cn("flex items-center gap-3 text-sm", !k.enabled && "opacity-50")}>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full",
                    k.hasKey ? "bg-signal/20 text-signal" : "bg-muted text-muted-foreground",
                  )}
                >
                  {k.hasKey ? <Check className="size-3" /> : <X className="size-3" />}
                </span>
                <span className="w-24">{k.label}</span>
                <code className="font-mono text-xs text-muted-foreground">{k.envVar}</code>
                {!k.enabled ? <span className="ml-auto text-xs text-muted-foreground">désactivé</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {ready.length === 0
              ? "Aucune clé trouvée : un run se terminerait immédiatement en échec. Ajoutez une clé puis redémarrez le serveur."
              : missing.length === 0
                ? "Tous les moteurs actifs ont une clé. Lancez un run."
                : `${ready.length} moteur${ready.length > 1 ? "s" : ""} prêt${ready.length > 1 ? "s" : ""}, les autres seront ignorés jusqu'à ce que leur clé soit ajoutée.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function NoProject() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-lg font-medium">Aucun projet en base</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Lancez <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">pnpm seed</code> pour créer le projet Gatto.city, ses
        concurrents et les moteurs par défaut.
      </p>
    </div>
  );
}
