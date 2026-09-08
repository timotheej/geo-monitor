"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { prepareInspectionAction } from "@/lib/inspect/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InspectForm({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await prepareInspectionAction(projectId, value);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (res.data.reused) {
          toast.info("Inspection récente réutilisée", { description: "Cette URL a été analysée il y a moins d'une heure. Le bouton « Relancer » du rapport force une nouvelle analyse." });
        } else if (res.data.questionsError) {
          toast.warning("Questions non générées", { description: `${res.data.questionsError} Saisissez-les à la main dans le rapport.` });
        } else if (res.data.rejected?.length) {
          const n = res.data.rejected.length;
          toast.warning(`${n} question${n > 1 ? "s" : ""} écartée${n > 1 ? "s" : ""}`, { description: "Elles nommaient la marque ou un domaine suivi, ce qui fausserait la mesure." });
        }
        router.push(`/inspect/${res.data.inspectionId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <label htmlFor="inspect-url" className="mb-2 block text-sm font-medium">
        URL de la page à inspecter
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="inspect-url"
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://exemple.fr/blog/article"
          className="font-mono"
          disabled={pending || disabled}
          required
          autoComplete="off"
        />
        <Button type="submit" disabled={pending || disabled || !url.trim()} className="sm:w-40">
          <ScanSearch data-icon="inline-start" />
          {pending ? "Analyse de la page..." : "Analyser"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {disabled
            ? "Une inspection est en cours : attendez sa fin avant d'en lancer une autre."
            : "Cette première étape est gratuite : lecture de la page, contrôle des robots IA et proposition de questions. Aucun moteur n'est interrogé avant votre validation."}
        </p>
      )}
    </form>
  );
}
