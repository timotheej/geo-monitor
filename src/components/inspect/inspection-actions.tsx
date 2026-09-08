"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { addInspectionQuestionsAsPromptsAction, prepareInspectionAction } from "@/lib/inspect/actions";
import { Button } from "@/components/ui/button";
import { DeleteInspectionButton } from "./inspections-table";

export function InspectionActions({
  inspectionId,
  projectId,
  url,
  hasQuestions,
  running,
}: {
  inspectionId: string;
  projectId: string;
  url: string;
  hasQuestions: boolean;
  running: boolean;
}) {
  const router = useRouter();
  const [relaunching, startRelaunch] = useTransition();
  const [adding, startAdd] = useTransition();

  function relaunch() {
    startRelaunch(async () => {
      try {
        const res = await prepareInspectionAction(projectId, url, true);
        if (!res.ok) {
          toast.error("Relance impossible", { description: res.error });
          return;
        }
        if (res.data.questionsError) toast.warning("Page analysée, questions non générées", { description: `${res.data.questionsError} Saisissez-les à la main.` });
        else toast.success("Page analysée à nouveau", { description: "Relisez les questions puis lancez le test." });
        router.push(`/inspect/${res.data.inspectionId}`);
      } catch (e) {
        toast.error("Relance impossible", { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  function addPrompts() {
    startAdd(async () => {
      try {
        const res = await addInspectionQuestionsAsPromptsAction(inspectionId);
        if (!res.ok) {
          toast.error("Ajout impossible", { description: res.error });
          return;
        }
        const n = res.data.added;
        if (n === 0) toast.info("Rien à ajouter", { description: "Ces questions font déjà partie des prompts suivis." });
        else
          toast.success(`${n} question${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} aux prompts suivis`, {
            description: "Tag « inspection ». Elles seront mesurées à chaque run quotidien.",
            action: { label: "Voir les prompts", onClick: () => router.push("/prompts") },
          });
      } catch (e) {
        toast.error("Ajout impossible", { description: e instanceof Error ? e.message : String(e) });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={relaunch} disabled={relaunching || running}>
        <RotateCw data-icon="inline-start" className={relaunching ? "animate-spin" : ""} />
        {relaunching ? "Analyse de la page..." : "Relancer"}
      </Button>
      <Button variant="outline" size="sm" onClick={addPrompts} disabled={adding || !hasQuestions}>
        <ListPlus data-icon="inline-start" />
        {adding ? "Ajout" : "Ajouter les questions aux prompts suivis"}
      </Button>
      <DeleteInspectionButton inspectionId={inspectionId} url={url} variant="text" afterDelete={() => router.push("/inspect")} />
    </div>
  );
}
