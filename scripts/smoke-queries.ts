import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { detect } from "@/lib/detection";
import { entitiesFor } from "@/lib/runs";
import { getOverview, getPromptMatrix, getResultDetail, getRun, getTimeSeries, getTopDomains } from "@/lib/queries";

/** Insère un run factice avec des résultats simulés puis exécute chaque requête du dashboard. Dev uniquement. */
async function main() {
  const db = await getDb();
  const project = await db.query.projects.findFirst({ with: { competitors: true } });
  if (!project) throw new Error("seed d'abord");
  const promptList = await db.query.prompts.findMany();
  const engineList = await db.query.engines.findMany();
  const [run] = await db.insert(schema.runs).values({ projectId: project.id, trigger: "cli", status: "done", plannedCount: 0 }).returning();

  const fakes = [
    { text: "Pour louer à Lyon, regardez SeLoger, Leboncoin et Gatto.city qui propose des annonces entre particuliers.", sources: ["https://www.seloger.com/x", "https://blog.gatto.city/y", "https://www.leboncoin.fr/z"] },
    { text: "Les sites les plus connus sont Leboncoin et PAP.", sources: ["https://www.leboncoin.fr/a", "https://www.pap.fr/b"] },
    { text: "Bien'ici est une bonne option.", sources: ["https://www.bienici.com/c"] },
  ];
  let i = 0;
  for (const p of promptList.slice(0, 6)) {
    for (const e of engineList) {
      const f = fakes[i++ % fakes.length];
      const sources = f.sources.map((url) => ({ url, domain: new URL(url).hostname.replace(/^www\./, "") }));
      const [r] = await db
        .insert(schema.results)
        .values({ runId: run.id, promptId: p.id, engineId: e.id, repeatIndex: 0, webSearch: p.webSearch, rawText: f.text, sources, usage: { inputTokens: 500, outputTokens: 300, searches: 1 }, costEstimate: 0.02, latencyMs: 1200 })
        .returning();
      const d = detect(f.text, sources, entitiesFor(project, project.competitors));
      await db.insert(schema.detections).values(d.map((x) => ({ ...x, resultId: r.id })));
    }
  }
  await db.update(schema.runs).set({ doneCount: i, plannedCount: i, costEstimate: i * 0.02, finishedAt: new Date() }).where(eq(schema.runs.id, run.id));

  console.log("overview", await getOverview(project.id, 30));
  console.log("series", (await getTimeSeries(project.id, 30)).slice(0, 3));
  const matrix = await getPromptMatrix(project.id, 30);
  console.log("matrix rows", matrix.length, matrix[0]?.citationRate, Object.values(matrix[0]?.cells ?? {}).map((c) => c.status));
  console.log("domains", await getTopDomains(project.id, 30, 5));
  const detail = await getRun(run.id);
  console.log("run results", detail?.results.length, detail?.results[0]?.cited);
  const rd = await getResultDetail(detail!.results[0].result.id);
  console.log("result detail entities", rd?.entities.map((e) => e.name), "detections", rd?.result.detections.length);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
