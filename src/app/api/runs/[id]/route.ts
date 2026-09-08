import { NextResponse } from "next/server";
import { getRun } from "@/lib/queries";

/** Détail d'un run avec ses résultats (texte brut exclu) : statut par tâche, erreurs, coût. */
export async function GET(_: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const data = await getRun(id);
  if (!data) return NextResponse.json({ error: "Run introuvable" }, { status: 404 });
  return NextResponse.json({
    run: data.run,
    results: data.results.map((r) => ({
      id: r.result.id,
      engine: r.engineLabel,
      prompt: r.promptText,
      webSearch: r.result.webSearch,
      cited: r.cited ?? false,
      mentioned: r.mentioned ?? false,
      sources: r.result.sources.length,
      costEstimate: r.result.costEstimate,
      latencyMs: r.result.latencyMs,
      error: r.result.error,
    })),
  });
}
