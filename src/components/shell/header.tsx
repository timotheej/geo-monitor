"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { launchRunAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const PERIOD_ITEMS = [
  { value: "7", label: "7 derniers jours" },
  { value: "30", label: "30 derniers jours" },
  { value: "90", label: "90 derniers jours" },
];

function PeriodSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = PERIOD_ITEMS.some((p) => p.value === params.get("days")) ? (params.get("days") as string) : "30";

  function onChange(value: string | null) {
    if (!value) return;
    const next = new URLSearchParams(params.toString());
    if (value === "30") next.delete("days");
    else next.set("days", value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select items={PERIOD_ITEMS} value={current} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label="Période" className="min-w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {PERIOD_ITEMS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LaunchRunButton({ projectId }: { projectId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function launch() {
    if (!projectId) return;
    startTransition(async () => {
      try {
        const res = await launchRunAction(projectId);
        if (res.tasks === 0) {
          toast.warning("Aucune tâche à exécuter", {
            description: "Vérifiez qu'au moins un prompt est actif, qu'un moteur est activé et que sa clé API est renseignée.",
            action: { label: "Voir le run", onClick: () => router.push(`/runs/${res.runId}`) },
          });
        } else {
          toast.success(`Run lancé : ${res.tasks} tâche${res.tasks > 1 ? "s" : ""}`, {
            description: "Les résultats arrivent au fil de l'eau, la page des runs se met à jour seule.",
            action: { label: "Suivre", onClick: () => router.push(`/runs/${res.runId}`) },
          });
        }
        router.refresh();
      } catch (e) {
        toast.error("Le run n'a pas pu démarrer", { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (
    <Button size="sm" onClick={launch} disabled={pending || !projectId}>
      <Play data-icon="inline-start" />
      {pending ? "Lancement" : "Lancer un run"}
    </Button>
  );
}

export function Header({ projectId, projectName, brandName }: { projectId: string | null; projectName: string; brandName: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-6 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<Link href="/settings" className="truncate text-sm font-medium hover:underline underline-offset-4" />}>
            {projectName}
          </TooltipTrigger>
          <TooltipContent>Modifier le projet</TooltipContent>
        </Tooltip>
        {brandName ? <span className="hidden truncate text-sm text-muted-foreground sm:inline">marque suivie : {brandName}</span> : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <PeriodSelect />
        <LaunchRunButton projectId={projectId} />
      </div>
    </header>
  );
}
