"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { cancelRun, launchRun } from "@/lib/launch-run";
import { normalizeDomain } from "@/lib/detection";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

const list = (v: unknown) =>
  (Array.isArray(v) ? v : String(v ?? "").split(/[,\n]/)).map((s) => String(s).trim()).filter(Boolean);
const domainList = (v: unknown) => list(v).map(normalizeDomain).filter(Boolean);

function revalidateAll() {
  for (const p of ["/", "/prompts", "/runs", "/settings"]) revalidatePath(p);
}

// ---------- Auth ----------

export async function login(_: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;
  if (!expected || password !== expected) return { error: "Mot de passe incorrect" };
  (await cookies()).set(AUTH_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}

// ---------- Runs ----------

export async function launchRunAction(projectId: string) {
  const launched = await launchRun(projectId, "manual");
  revalidateAll();
  return launched;
}

export async function cancelRunAction(runId: string) {
  const r = await cancelRun(runId);
  revalidateAll();
  revalidatePath(`/runs/${runId}`);
  return r;
}

// ---------- Prompts ----------

const promptSchema = z.object({
  projectId: z.string().min(1),
  text: z.string().trim().min(5, "Le prompt doit faire au moins 5 caractères"),
  lang: z.string().trim().min(2).default("fr"),
  tags: z.array(z.string()).default([]),
  webSearch: z.boolean().default(true),
});

export async function createPrompt(input: z.input<typeof promptSchema>) {
  const data = promptSchema.parse({ ...input, tags: list(input.tags) });
  const db = await getDb();
  const [row] = await db.insert(schema.prompts).values(data).returning();
  revalidateAll();
  return row;
}

export async function setPromptActive(id: string, active: boolean) {
  const db = await getDb();
  await db.update(schema.prompts).set({ active }).where(eq(schema.prompts.id, id));
  revalidateAll();
}

export async function deletePrompt(id: string) {
  const db = await getDb();
  await db.delete(schema.prompts).where(eq(schema.prompts.id, id));
  revalidateAll();
}

/**
 * Import CSV : une ligne par prompt. Colonnes optionnelles séparées par ";" :
 * texte;lang;tag1,tag2;web (oui/non). Sans en-tête. Les lignes vides sont ignorées.
 */
export async function importPromptsCsv(projectId: string, csv: string) {
  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [text, lang, tags, web] = line.split(";").map((s) => s?.trim() ?? "");
      return promptSchema.parse({
        projectId,
        text,
        lang: lang || "fr",
        tags: list(tags),
        webSearch: web ? !/^(non|no|false|0)$/i.test(web) : true,
      });
    });
  if (rows.length === 0) return { imported: 0 };
  const db = await getDb();
  await db.insert(schema.prompts).values(rows);
  revalidateAll();
  return { imported: rows.length };
}

// ---------- Projet ----------

const projectSchema = z.object({
  name: z.string().trim().min(1),
  brandName: z.string().trim().min(1),
  aliases: z.array(z.string()),
  domains: z.array(z.string()).min(1, "Au moins un domaine"),
  locale: z.string().trim().min(2),
  repeats: z.coerce.number().int().min(1).max(10),
  costCapEur: z.coerce.number().min(0.5).max(500),
  inspectionCostCapEur: z.coerce.number().min(0.1).max(50).default(0.5),
  inspectionsPerDay: z.coerce.number().int().min(1).max(200).default(20),
});

export async function updateProject(projectId: string, input: Record<string, unknown>) {
  const data = projectSchema.parse({ ...input, aliases: list(input.aliases), domains: domainList(input.domains) });
  const db = await getDb();
  await db.update(schema.projects).set(data).where(eq(schema.projects.id, projectId));
  revalidateAll();
}

const competitorSchema = z.object({
  name: z.string().trim().min(1),
  aliases: z.array(z.string()),
  domains: z.array(z.string()).min(1, "Au moins un domaine"),
});

export async function addCompetitor(projectId: string, input: Record<string, unknown>) {
  const data = competitorSchema.parse({ ...input, aliases: list(input.aliases), domains: domainList(input.domains) });
  const db = await getDb();
  await db.insert(schema.competitors).values({ ...data, projectId });
  revalidateAll();
}

export async function deleteCompetitor(id: string) {
  const db = await getDb();
  await db.delete(schema.competitors).where(eq(schema.competitors.id, id));
  revalidateAll();
}

// ---------- Moteurs ----------

export async function updateEngine(id: string, input: { enabled?: boolean; model?: string; maxSearches?: number }) {
  const db = await getDb();
  const current = await db.query.engines.findFirst({ where: eq(schema.engines.id, id) });
  if (!current) throw new Error("Moteur introuvable");
  await db
    .update(schema.engines)
    .set({
      enabled: input.enabled ?? current.enabled,
      model: input.model?.trim() || current.model,
      config: { ...current.config, ...(input.maxSearches ? { maxSearches: input.maxSearches } : {}) },
    })
    .where(eq(schema.engines.id, id));
  revalidateAll();
}
