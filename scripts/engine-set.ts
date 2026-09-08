import "dotenv/config";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Modifie un moteur sans passer par l'interface : pnpm engine:set --provider anthropic --model claude-haiku-4-5 --max-searches 2 [--enabled true|false] */
const { values } = parseArgs({
  options: {
    provider: { type: "string" },
    model: { type: "string" },
    "max-searches": { type: "string" },
    enabled: { type: "string" },
  },
});

async function main() {
  if (!values.provider) throw new Error("--provider requis");
  const db = await getDb();
  const engine = await db.query.engines.findFirst({ where: eq(schema.engines.provider, values.provider as "openai") });
  if (!engine) throw new Error(`Moteur introuvable : ${values.provider}`);
  const config = { ...engine.config, ...(values["max-searches"] ? { maxSearches: Number(values["max-searches"]) } : {}) };
  await db
    .update(schema.engines)
    .set({ model: values.model ?? engine.model, enabled: values.enabled ? values.enabled === "true" : engine.enabled, config })
    .where(eq(schema.engines.id, engine.id));
  const after = await db.query.engines.findFirst({ where: eq(schema.engines.id, engine.id) });
  console.log(`${after!.label} : ${after!.model}, recherches max ${after!.config.maxSearches ?? "défaut"}, ${after!.enabled ? "activé" : "désactivé"}`);
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
