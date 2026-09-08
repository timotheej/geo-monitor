import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { appendEngineToRun } from "@/lib/launch-run";
import type { Provider } from "@/db/schema";

/** Complète un run terminé avec un moteur : `{ "engineId": "..." }` ou `{ "provider": "google" }`. */
export async function POST(request: Request, ctx: RouteContext<"/api/runs/[id]/append">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { engineId?: string; provider?: Provider };
  let engineId = body.engineId;
  if (!engineId && body.provider) {
    const db = await getDb();
    const engine = await db.query.engines.findFirst({ where: (e, { eq }) => eq(e.provider, body.provider!) });
    if (!engine) return NextResponse.json({ error: `Aucun moteur pour le fournisseur ${body.provider}` }, { status: 404 });
    engineId = engine.id;
  }
  if (!engineId) return NextResponse.json({ error: "engineId ou provider requis" }, { status: 400 });
  try {
    return NextResponse.json(await appendEngineToRun(id, engineId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 409 });
  }
}
