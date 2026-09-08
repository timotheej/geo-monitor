import { NextResponse } from "next/server";
import { analyzeInspection, AnalysisError, getAnalysisForInspection } from "@/lib/citability/analysis";

/** Lance (ou renvoie) l'analyse de citabilité d'une inspection terminée : `{ "force"?: true, "judge"?: false }`. */
export async function POST(request: Request, ctx: RouteContext<"/api/inspections/[id]/analyze">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { force?: boolean; judge?: boolean };
  try {
    return NextResponse.json({ analysis: await analyzeInspection(id, { force: body.force === true, judge: body.judge !== false }) });
  } catch (err) {
    if (err instanceof AnalysisError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}

export async function GET(_: Request, ctx: RouteContext<"/api/inspections/[id]/analyze">) {
  const { id } = await ctx.params;
  const analysis = await getAnalysisForInspection(id);
  if (!analysis) return NextResponse.json({ error: "Pas d'analyse" }, { status: 404 });
  return NextResponse.json({ analysis });
}
