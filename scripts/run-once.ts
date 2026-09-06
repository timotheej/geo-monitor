import "dotenv/config";
import { parseArgs } from "node:util";
import type { Engine } from "@/db/schema";
import { DEFAULT_ENGINES, hasApiKey, runPrompt, supportsMode } from "@/lib/engines";
import { detect } from "@/lib/detection";
import { estimateCostUsd } from "@/lib/pricing";

/**
 * Teste un prompt sur les moteurs configurés, sans base de données.
 *   pnpm run:once --prompt "Meilleurs sites pour louer à Lyon ?" --brand Gatto --domain gatto.city
 *   pnpm run:once --prompt "..." --engine anthropic --no-search
 */
const { values } = parseArgs({
  options: {
    prompt: { type: "string", short: "p" },
    engine: { type: "string", short: "e" },
    brand: { type: "string", default: "Gatto" },
    domain: { type: "string", default: "gatto.city" },
    "no-search": { type: "boolean", default: false },
    lang: { type: "string", default: "fr" },
  },
});

async function main() {
  if (!values.prompt) throw new Error("--prompt requis");
  const webSearch = !values["no-search"];
  const engines = DEFAULT_ENGINES.filter((e) => !values.engine || e.provider === values.engine);
  const entity = { type: "brand" as const, id: "brand", terms: [values.brand!], domains: [values.domain!] };

  for (const def of engines) {
    const engine: Engine = { id: def.provider, enabled: true, config: {}, createdAt: new Date(), ...def };
    console.log(`\n=== ${engine.label} (${engine.model}) ${webSearch ? "avec" : "sans"} recherche web`);
    if (!hasApiKey(engine.provider)) {
      console.log("  clé API absente, ignoré");
      continue;
    }
    if (!supportsMode(engine.provider, webSearch)) {
      console.log("  mode non supporté, ignoré");
      continue;
    }
    try {
      const a = await runPrompt(engine, values.prompt, { webSearch, lang: values.lang!, country: "FR" });
      const [d] = detect(a.text, a.sources, [entity]);
      console.log(`  ${a.latencyMs} ms, ${a.usage.inputTokens ?? "?"} in / ${a.usage.outputTokens ?? "?"} out, ${a.usage.searches ?? 0} recherches, ~${estimateCostUsd(engine.provider, engine.config, a.usage, engine.model).toFixed(4)} USD`);
      console.log(`  cité : ${d.cited ? `oui (rang ${d.citationRank})` : "non"} | mentionné : ${d.mentioned ? `oui (${d.matchedTerms.join(", ")})` : "non"}`);
      console.log(`  sources (${a.sources.length}) :`);
      for (const s of a.sources) console.log(`    - ${s.domain}  ${s.url}`);
      console.log("  --- réponse ---");
      console.log(a.text.split("\n").map((l) => "  " + l).join("\n"));
    } catch (err) {
      console.log("  ERREUR :", err instanceof Error ? err.message : err);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
