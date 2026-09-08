"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Play, X } from "lucide-react";
import { toast } from "sonner";
import type { InspectionQuestion } from "@/db/schema";
import { launchInspectionAction } from "@/lib/inspect/actions";
import { MAX_QUESTIONS } from "@/lib/inspect/limits";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatEur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Section } from "./section";
import { cn } from "@/lib/utils";

export type EngineChoice = { id: string; label: string; model: string; enabled: boolean; hasKey: boolean };

export function TestSection({
  inspectionId,
  initialQuestions,
  questionsReused,
  engines,
  defaultEngineIds,
  avgCostUsd,
  fetchFailed,
}: {
  inspectionId: string;
  initialQuestions: InspectionQuestion[];
  questionsReused: boolean;
  engines: EngineChoice[];
  defaultEngineIds: string[];
  avgCostUsd: Record<string, number>;
  fetchFailed: boolean;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<string[]>(initialQuestions.length ? initialQuestions.map((q) => q.text) : [""]);
  const [engineIds, setEngineIds] = useState<string[]>(defaultEngineIds.filter((id) => engines.some((e) => e.id === id && e.enabled && e.hasKey)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validQuestions = questions.map((q) => q.trim()).filter((q) => q.length >= 10);
  const costUsd = engineIds.reduce((sum, id) => sum + (avgCostUsd[id] ?? 0), 0) * validQuestions.length;
  const costEur = costUsd * USD_TO_EUR;
  const canLaunch = validQuestions.length > 0 && engineIds.length > 0 && !pending;

  function update(i: number, value: string) {
    setQuestions((qs) => qs.map((q, j) => (j === i ? value : q)));
  }
  function remove(i: number) {
    setQuestions((qs) => (qs.length > 1 ? qs.filter((_, j) => j !== i) : qs));
  }
  function add() {
    setQuestions((qs) => (qs.length < MAX_QUESTIONS ? [...qs, ""] : qs));
  }
  function toggleEngine(id: string, on: boolean) {
    setEngineIds((ids) => (on ? Array.from(new Set([...ids, id])) : ids.filter((x) => x !== id)));
  }

  function launch() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await launchInspectionAction(inspectionId, validQuestions, engineIds);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        toast.success(`Test lancé : ${res.data.tasks} réponse${res.data.tasks > 1 ? "s" : ""} attendue${res.data.tasks > 1 ? "s" : ""}`, {
          description: "Les réponses arrivent au fil de l'eau, la page se met à jour seule.",
        });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <Section
      title="Questions et test"
      description="Étape 2, payante. Relisez les questions : elles doivent être celles d'un internaute qui ne connaît ni la page ni la marque."
    >
      {fetchFailed && initialQuestions.length === 0 ? (
        <p className="rounded-lg border border-rival/40 bg-rival/10 p-3 text-sm text-muted-foreground">
          La page n&apos;a pas pu être lue, aucune question n&apos;a été générée. Saisissez-les à la main pour lancer le test malgré tout.
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Questions ({questions.length} / {MAX_QUESTIONS})
          </span>
          {questionsReused ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              questions réutilisées d&apos;une inspection précédente
            </Badge>
          ) : null}
        </div>
        <ol className="space-y-2">
          {questions.map((q, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 shrink-0 pt-2 text-right font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <Textarea
                value={q}
                onChange={(e) => update(i, e.target.value)}
                rows={1}
                className="min-h-9"
                placeholder="Question telle qu'un internaute la poserait (10 caractères minimum)"
                aria-label={`Question ${i + 1}`}
                disabled={pending}
              />
              <Button variant="ghost" size="icon-sm" aria-label="Retirer cette question" disabled={questions.length <= 1 || pending} onClick={() => remove(i)} className="mt-0.5 text-muted-foreground hover:text-destructive">
                <X />
              </Button>
            </li>
          ))}
        </ol>
        <Button variant="outline" size="sm" onClick={add} disabled={questions.length >= MAX_QUESTIONS || pending} className="ml-7">
          <Plus data-icon="inline-start" />
          Ajouter une question
        </Button>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Moteurs</span>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {engines.map((e) => {
            const usable = e.enabled && e.hasKey;
            const checked = engineIds.includes(e.id);
            const perAnswer = avgCostUsd[e.id] ?? 0;
            return (
              <li key={e.id}>
                <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2", checked && "border-signal/50 bg-signal/5", !usable && "cursor-not-allowed opacity-60")}>
                  <input type="checkbox" className="size-4 accent-signal" checked={checked} disabled={!usable || pending} onChange={(ev) => toggleEngine(e.id, ev.target.checked)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{e.label}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {!e.hasKey ? "clé API absente" : !e.enabled ? "moteur désactivé" : `≈ ${formatEur(perAnswer * USD_TO_EUR, true)} par réponse`}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {validQuestions.length} question{validQuestions.length > 1 ? "s" : ""} × {engineIds.length} moteur{engineIds.length > 1 ? "s" : ""}, coût estimé{" "}
          <span className="font-mono text-foreground tabular-nums">≈ {formatEur(costEur)}</span>
          <span className="block text-xs">D&apos;après le coût moyen réel de chaque moteur dans les runs. Indicatif.</span>
        </p>
        <Button onClick={launch} disabled={!canLaunch}>
          <Play data-icon="inline-start" />
          {pending ? "Lancement" : `Lancer le test (≈ ${formatEur(costEur)})`}
        </Button>
      </div>
    </Section>
  );
}
