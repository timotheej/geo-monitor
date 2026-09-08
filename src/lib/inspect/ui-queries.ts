import { inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Inspection } from "@/db/schema";
import { getInspections } from "./queries";

/** Une inspection avec le résumé de ses réponses, pour la liste. */
export type InspectionSummary = Inspection & {
  /** Réponses sans erreur */
  ok: number;
  /** Réponses où l'URL exacte est citée */
  urlCited: number;
  /** Réponses où une autre page du domaine est citée (URL exacte non citée) */
  domainCited: number;
};

export async function getInspectionSummaries(projectId: string, limit = 50): Promise<InspectionSummary[]> {
  const list = await getInspections(projectId, limit);
  if (list.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({
      inspectionId: schema.inspectionAnswers.inspectionId,
      ok: sql<number>`coalesce(sum(case when ${schema.inspectionAnswers.error} is null then 1 else 0 end), 0)::int`,
      urlCited: sql<number>`coalesce(sum(case when ${schema.inspectionAnswers.urlCited} then 1 else 0 end), 0)::int`,
      domainCited: sql<number>`coalesce(sum(case when ${schema.inspectionAnswers.domainCited} and not ${schema.inspectionAnswers.urlCited} then 1 else 0 end), 0)::int`,
    })
    .from(schema.inspectionAnswers)
    .where(
      inArray(
        schema.inspectionAnswers.inspectionId,
        list.map((i) => i.id),
      ),
    )
    .groupBy(schema.inspectionAnswers.inspectionId);
  const byId = new Map(rows.map((r) => [r.inspectionId, r]));
  return list.map((i) => {
    const r = byId.get(i.id);
    return { ...i, ok: r?.ok ?? 0, urlCited: r?.urlCited ?? 0, domainCited: r?.domainCited ?? 0 };
  });
}
