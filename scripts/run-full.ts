import "dotenv/config";
import { getDb } from "@/db";
import { executeTask, finishRun, markRunRunning, planRun } from "@/lib/runs";
import { USD_TO_EUR } from "@/lib/pricing";

/** Run complet sans workflow (séquentiel, pour la ligne de commande). */
async function main() {
  const db = await getDb();
  const project = await db.query.projects.findFirst();
  if (!project) throw new Error("Aucun projet : lancer pnpm seed d'abord");

  const plan = await planRun(project.id, "cli");
  console.log(`Run ${plan.runId} : ${plan.tasks.length} tâches, plafond ${plan.costCapUsd.toFixed(2)} USD`);
  if (plan.tasks.length === 0) {
    await finishRun(plan.runId, "failed", "Aucune tâche : vérifier les prompts actifs, les moteurs et les clés API");
    console.log("Aucune tâche (clés API manquantes ?), run marqué en échec.");
    process.exit(1);
  }
  await markRunRunning(plan.runId);

  let cost = 0;
  let errors = 0;
  for (const [i, task] of plan.tasks.entries()) {
    const o = await executeTask(plan.runId, task);
    cost += o.costUsd;
    if (o.error) errors++;
    console.log(`  [${i + 1}/${plan.tasks.length}] ${o.error ? "ERREUR " + o.error : "ok"}  cumul ${cost.toFixed(3)} USD`);
    if (cost > plan.costCapUsd) {
      await finishRun(plan.runId, "failed", "Plafond de coût dépassé");
      console.log("Plafond dépassé, arrêt.");
      process.exit(1);
    }
  }
  await finishRun(plan.runId, errors === plan.tasks.length && plan.tasks.length > 0 ? "failed" : "done");
  console.log(`Terminé : ${errors} erreur(s), ~${(cost * USD_TO_EUR).toFixed(2)} EUR`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
