import "dotenv/config";
import { count } from "drizzle-orm";
import * as schema from "@/db/schema";

/**
 * Copie intégrale de la base locale (PGlite) vers une base Postgres cible, identifiants conservés.
 *   TARGET_DATABASE_URL=postgres://... pnpm db:copy-to-prod
 * Refuse d'écraser une cible qui contient déjà des résultats ou des inspections, sauf avec --force.
 */
async function main() {
  const target = process.env.TARGET_DATABASE_URL;
  if (!target) throw new Error("TARGET_DATABASE_URL requis");
  const force = process.argv.includes("--force");

  const { drizzle: pglite } = await import("drizzle-orm/pglite");
  const { drizzle: pg } = await import("drizzle-orm/postgres-js");
  const src = pglite({ connection: { dataDir: process.env.PGLITE_DIR ?? "./.data/pglite" }, schema });
  const dst = pg({ connection: { url: target, max: 2, prepare: false }, schema });

  const [[r], [i]] = await Promise.all([dst.select({ n: count() }).from(schema.results), dst.select({ n: count() }).from(schema.inspections)]);
  const targetRuns = await dst.select({ id: schema.runs.id, startedAt: schema.runs.startedAt, doneCount: schema.runs.doneCount, status: schema.runs.status }).from(schema.runs);
  console.log(`Cible : ${r.n} résultat(s), ${i.n} inspection(s), ${targetRuns.length} run(s)`);
  for (const run of targetRuns) console.log(`  run ${run.id} ${run.startedAt.toISOString()} ${run.status} ${run.doneCount} tâches`);
  if (process.argv.includes("--check")) {
    await dst.$client.end();
    await src.$client.close();
    return;
  }
  if ((r.n > 0 || i.n > 0) && !force) throw new Error(`La cible contient déjà ${r.n} résultat(s) et ${i.n} inspection(s) : relancer avec --force pour écraser`);

  // Ordre de suppression : enfants d'abord.
  for (const t of [schema.pageAnalyses, schema.comparisonPages, schema.inspectionAnswers, schema.inspections, schema.detections, schema.results, schema.runs, schema.prompts, schema.competitors, schema.engines, schema.projects]) {
    await dst.delete(t);
  }

  // Ordre d'insertion : parents d'abord, par lots.
  const tables = [
    ["projects", schema.projects],
    ["engines", schema.engines],
    ["competitors", schema.competitors],
    ["prompts", schema.prompts],
    ["runs", schema.runs],
    ["results", schema.results],
    ["detections", schema.detections],
    ["inspections", schema.inspections],
    ["inspection_answers", schema.inspectionAnswers],
    ["page_analyses", schema.pageAnalyses],
    ["comparison_pages", schema.comparisonPages],
  ] as const;
  for (const [name, table] of tables) {
    const rows = await src.select().from(table);
    for (let k = 0; k < rows.length; k += 200) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await dst.insert(table).values(rows.slice(k, k + 200) as any);
    }
    console.log(`${name.padEnd(19)} ${rows.length}`);
  }
  await dst.$client.end();
  await src.$client.close();
  console.log("Copie terminée.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
