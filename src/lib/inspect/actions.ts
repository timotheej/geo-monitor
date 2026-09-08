"use server";

import { revalidatePath } from "next/cache";
import { start } from "workflow/api";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { inspectionWorkflow } from "@/workflows/inspection-workflow";
import { InspectionError, launchInspection, prepareInspection } from "./service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof InspectionError) return { ok: false, error: err.message };
    throw err;
  }
}

function revalidate(id?: string) {
  revalidatePath("/inspect");
  revalidatePath("/");
  if (id) revalidatePath(`/inspect/${id}`);
}

/** Étape A. Renvoie l'id de l'inspection (brouillon) ou l'erreur à afficher. */
export async function prepareInspectionAction(projectId: string, url: string, force = false) {
  const r = await wrap(() => prepareInspection(projectId, url, { force }));
  if (r.ok) revalidate(r.data.inspectionId);
  return r;
}

/** Étape B. Lance le workflow sur les questions validées et les moteurs choisis. */
export async function launchInspectionAction(inspectionId: string, questions: string[], engineIds: string[]) {
  const r = await wrap(async () => {
    const plan = await launchInspection(inspectionId, { questions, engineIds });
    const run = await start(inspectionWorkflow, [inspectionId, plan.tasks, plan.costCapUsd]);
    return { tasks: plan.tasks.length, workflowRunId: run.runId };
  });
  revalidate(inspectionId);
  return r;
}

export async function deleteInspectionAction(inspectionId: string) {
  const db = await getDb();
  await db.delete(schema.inspections).where(eq(schema.inspections.id, inspectionId));
  revalidate();
}

/** Ajoute les questions de l'inspection aux prompts suivis quotidiennement, avec un tag dédié. */
export async function addInspectionQuestionsAsPromptsAction(inspectionId: string) {
  const db = await getDb();
  const insp = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, inspectionId) });
  if (!insp) return { ok: false as const, error: "Inspection introuvable" };
  const existing = await db.query.prompts.findMany({ where: eq(schema.prompts.projectId, insp.projectId), columns: { text: true } });
  const known = new Set(existing.map((p) => p.text.trim().toLowerCase()));
  const slug = insp.normalizedUrl.split("/").filter(Boolean).pop()?.slice(0, 40) ?? "page";
  const rows = insp.questions
    .filter((q) => !known.has(q.text.trim().toLowerCase()))
    .map((q) => ({ projectId: insp.projectId, text: q.text, lang: q.lang, tags: ["inspection", slug], webSearch: true }));
  if (rows.length) await db.insert(schema.prompts).values(rows);
  revalidatePath("/prompts");
  return { ok: true as const, data: { added: rows.length } };
}
