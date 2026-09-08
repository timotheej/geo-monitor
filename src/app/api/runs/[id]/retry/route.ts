import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { retryFailedTasks } from "@/lib/launch-run";

/** Rejoue les tâches en erreur d'un run : corps optionnel `{ engineId }` ou `{ provider }`. */
export async function POST(request: Request, ctx: RouteContext<"/api/runs/[id]/retry">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { engineId?: string; provider?: string };
  let engineId = body.engineId;
  if (!engineId && body.provider) {
    const db = await getDb();
    engineId = (await db.query.engines.findFirst({ where: (e, { eq }) => eq(e.provider, body.provider as "openai") }))?.id;
  }
  try {
    return NextResponse.json(await retryFailedTasks(id, engineId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 409 });
  }
}
