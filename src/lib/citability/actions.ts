"use server";

import { revalidatePath } from "next/cache";
import type { PageAnalysis } from "@/db/schema";
import { analyzeInspection, AnalysisError } from "./analysis";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Lance l'analyse de citabilité d'une inspection terminée (synchrone, 20 à 60 s) et renvoie la ligne,
 * y compris en `failed` (l'erreur est alors dans `data.error`). `force` ignore l'analyse récente.
 */
export async function analyzeInspectionAction(inspectionId: string, force = false): Promise<Result<PageAnalysis>> {
  try {
    const analysis = await analyzeInspection(inspectionId, { force });
    revalidatePath(`/inspect/${inspectionId}`);
    revalidatePath("/sources");
    return { ok: true, data: analysis };
  } catch (err) {
    if (err instanceof AnalysisError) return { ok: false, error: err.message };
    throw err;
  }
}
