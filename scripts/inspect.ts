import "dotenv/config";
import { parseArgs } from "node:util";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { answerInspectionQuestion, finishInspection, launchInspection, prepareInspection } from "@/lib/inspect/service";
import { getUrlHistory } from "@/lib/inspect/queries";

/**
 * Inspection d'URL en ligne de commande, sans workflow.
 *   pnpm inspect --url https://rablab.ca/blog/...            (étape A seule, gratuite)
 *   pnpm inspect --url ... --launch [--engine openai]        (étape B, payante)
 */
const { values } = parseArgs({ options: { url: { type: "string" }, launch: { type: "boolean", default: false }, engine: { type: "string" }, force: { type: "boolean", default: false } } });

async function main() {
  if (!values.url) throw new Error("--url requis");
  const db = await getDb();
  const project = await db.query.projects.findFirst();
  if (!project) throw new Error("Aucun projet, lancer pnpm seed");

  const prep = await prepareInspection(project.id, values.url, { force: values.force });
  const insp = (await db.query.inspections.findFirst({ where: eq(schema.inspections.id, prep.inspectionId) }))!;
  console.log(`\n=== Inspection ${insp.id} ${prep.reused ? "(récente, réutilisée)" : ""}`);
  const p = insp.page!;
  console.log(`Page : HTTP ${p.httpStatus}, ${p.responseMs} ms, ${p.redirects} redirection(s)${p.fetchError ? ", ERREUR " + p.fetchError : ""}`);
  console.log(`  titre : ${p.title}\n  h1 : ${p.h1}\n  description : ${p.description.slice(0, 120)}\n  lang ${p.lang}, ${p.wordCount} mots, publié ${p.publishedAt ?? "?"}, canonical ${p.canonical ?? "-"}, robots meta ${p.robotsMeta ?? "-"}, JSON-LD ${p.jsonLdTypes.join(",") || "-"}${p.jsSuspect ? ", SOUPÇON JS" : ""}`);
  const a = insp.access!;
  console.log(`Accès : robots.txt ${a.robotsFound ? "présent" : "absent"}, llms.txt ${a.llmsTxt ? "oui" : "non"}, ${a.allAllowed ? "tous les agents IA autorisés" : "BLOCAGES : " + a.agents.filter((x) => !x.allowed).map((x) => x.agent).join(", ")}`);
  console.log(`Questions (${insp.questions.length}${insp.questionsReused ? ", réutilisées" : ""}, ~${insp.costEstimate.toFixed(4)} USD) :`);
  for (const q of insp.questions) console.log(`  - [${q.lang}] ${q.text}`);
  if (!prep.reused && "rejected" in prep) {
    for (const r of prep.rejected) console.log(`  rejetée (« ${r.term} ») : ${r.text}`);
    if (prep.questionsError) console.log(`  génération impossible : ${prep.questionsError}`);
  }

  const history = await getUrlHistory(project.id, values.url);
  console.log(`Historique dans les runs : ${history.length} apparition(s)`);
  for (const h of history.slice(0, 5)) console.log(`  - ${h.date.toISOString().slice(0, 10)} ${h.engineLabel} rang ${h.rank} : ${h.promptText.slice(0, 70)}`);

  if (!values.launch) return process.exit(0);
  const engines = await db.query.engines.findMany();
  const engineIds = values.engine ? engines.filter((e) => e.provider === values.engine).map((e) => e.id) : insp.engineIds;
  const plan = await launchInspection(insp.id, { questions: insp.questions.map((q) => q.text), engineIds });
  console.log(`\nÉtape B : ${plan.tasks.length} tâches, plafond ${plan.costCapUsd.toFixed(2)} USD`);
  let cost = 0;
  for (const t of plan.tasks) {
    const o = await answerInspectionQuestion(insp.id, t);
    cost += o.costUsd;
    const ans = await db.query.inspectionAnswers.findFirst({ where: eq(schema.inspectionAnswers.inspectionId, insp.id), with: { engine: true } , orderBy: (x, { desc }) => desc(x.createdAt) });
    const q = insp.questions[t.questionIndex].text;
    console.log(`  ${ans?.engine.label} | ${o.error ? "ERREUR " + o.error : ans?.urlCited ? `URL CITÉE rang ${ans.urlRank}` : ans?.domainCited ? `domaine cité rang ${ans.domainRank}` : "non cité"} | ${ans?.sources.length ?? 0} sources | ${o.costUsd.toFixed(3)} USD | ${q.slice(0, 60)}`);
    if (ans && !ans.urlCited) console.log(`      cités à la place : ${ans.sources.slice(0, 4).map((s) => s.domain).join(", ")}`);
    if (cost > plan.costCapUsd) { await finishInspection(insp.id, "failed", "Plafond dépassé"); console.log("Plafond dépassé"); process.exit(1); }
  }
  await finishInspection(insp.id, "done");
  console.log(`Terminé : ${cost.toFixed(3)} USD`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
