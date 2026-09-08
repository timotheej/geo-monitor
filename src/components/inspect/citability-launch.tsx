"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, LoaderCircle, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { analyzeInspectionAction } from "@/lib/citability/actions";
import { Button } from "@/components/ui/button";

const PENDING_LABEL = "Analyse en cours, 20 à 60 s";

function useAnalyze(inspectionId: string, force: boolean) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run() {
    start(async () => {
      try {
        const res = await analyzeInspectionAction(inspectionId, force);
        if (!res.ok) {
          toast.error("Analyse impossible", { description: res.error });
          return;
        }
        if (res.data.status === "failed") toast.error("L'analyse s'est arrêtée", { description: res.data.error ?? "Erreur inconnue" });
        else toast.success(`Indice de citabilité : ${res.data.score ?? 0} sur 100`, { description: "Le détail par bloc, la comparaison et la lecture du modèle sont affichés dans le rapport." });
        router.refresh();
      } catch (e) {
        toast.error("Analyse impossible", { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }
  return { pending, run };
}

/** État vide de la section Citabilité : explication, coût, bouton, puis état d'attente (l'action est synchrone). */
export function CitabilityLaunch({ inspectionId, questions, costLabel, judgeAvailable }: { inspectionId: string; questions: number; costLabel: string; judgeAvailable: boolean }) {
  const { pending, run } = useAnalyze(inspectionId, false);
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 text-sm">
        <p className="font-medium">Indice de citabilité sur 100, en trois blocs : Accès, Contenu, Résultat.</p>
        <p className="text-muted-foreground">
          Relit la page et son robots.txt, applique la grille de points, récupère les pages citées à sa place pour les comparer signal par signal, et fait lire la page par un modèle pour chacune des {questions} question{questions > 1 ? "s" : ""} du test.
        </p>
        <p className="text-xs text-muted-foreground">
          Coût estimé <span className="font-mono text-foreground tabular-nums">{costLabel}</span>
          {judgeAvailable ? " (lecture par le modèle, 0,003 USD par question ; les récupérations de pages sont gratuites)." : " : aucun moteur OpenAI ou Anthropic activé, la lecture par le modèle est sautée et la grille utilise ses replis."}
        </p>
      </div>
      <Button onClick={run} disabled={pending} className="shrink-0" aria-live="polite">
        {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Gauge data-icon="inline-start" />}
        {pending ? PENDING_LABEL : "Analyser la citabilité"}
      </Button>
    </div>
  );
}

/** Relance en `force` : après un échec, une grille changée ou une analyse ancienne. */
export function CitabilityRelaunch({ inspectionId, label = "Relancer l'analyse", size = "sm" }: { inspectionId: string; label?: string; size?: "sm" | "default" }) {
  const { pending, run } = useAnalyze(inspectionId, true);
  return (
    <Button variant="outline" size={size} onClick={run} disabled={pending} aria-live="polite">
      <RotateCw data-icon="inline-start" className={pending ? "animate-spin" : ""} />
      {pending ? PENDING_LABEL : label}
    </Button>
  );
}
