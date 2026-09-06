import "dotenv/config";
/** Résumé chiffré du projet : vue d'ensemble, top domaines, matrice prompts × moteurs, détections. */
import { getDb, schema } from "@/db";
import { getOverview, getTopDomains, getPromptMatrix } from "@/lib/queries";
import { eq } from "drizzle-orm";
async function main() {
  const db = await getDb();
  const p = (await db.query.projects.findFirst())!;
  console.log(JSON.stringify(await getOverview(p.id, 30)));
  console.log((await getTopDomains(p.id, 30, 8)).map((d) => `${d.domain} ${d.count} ${d.entityName ?? ""}`).join(" | "));
  const m = await getPromptMatrix(p.id, 30);
  for (const r of m) console.log(r.prompt.webSearch ? "web " : "mem ", Object.values(r.cells).map((c) => c.status).join(","), "|", r.prompt.text.slice(0, 60));
  const det = await db.select().from(schema.detections).where(eq(schema.detections.entityType, "brand"));
  console.log("brand detections:", det.length, "cited", det.filter((d) => d.cited).length, "mentioned", det.filter((d) => d.mentioned).length);
  const comp = await db.select({ id: schema.detections.entityId, cited: schema.detections.cited, mentioned: schema.detections.mentioned }).from(schema.detections).where(eq(schema.detections.entityType, "competitor"));
  const byId: Record<string, { c: number; m: number }> = {};
  for (const d of comp) { byId[d.id] ??= { c: 0, m: 0 }; if (d.cited) byId[d.id].c++; if (d.mentioned) byId[d.id].m++; }
  const comps = await db.query.competitors.findMany();
  for (const c of comps) console.log("competitor", c.name, byId[c.id] ?? { c: 0, m: 0 });
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
