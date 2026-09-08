"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addCompetitorFromDomain } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Un clic ajoute le domaine comme concurrent suivi ; les détections des prochains runs le prendront en compte. */
export function AddCompetitorButton({ projectId, domain, className }: { projectId: string; domain: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      title="Suivre ce domaine comme concurrent"
      aria-label={`Suivre ${domain} comme concurrent`}
      className={cn("h-6 px-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100", className)}
      onClick={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addCompetitorFromDomain(projectId, domain);
          if (r.ok) toast.success(`${r.data.name} suivi comme concurrent`, { description: `Détections recalculées sur ${r.data.recomputed} réponses. Alias et domaines modifiables dans Paramètres.` });
          else toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <Plus data-icon="inline-start" />
      {pending ? "Ajout" : "Concurrent"}
    </Button>
  );
}
