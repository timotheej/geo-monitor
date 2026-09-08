import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import { inspectionWorkflow } from "@/workflows/inspection-workflow";
import { InspectionError, launchInspection } from "@/lib/inspect/service";

/** Étape B : `{ "questions"?: string[], "engineIds"?: string[], "providers"?: ["openai", ...] }`. Par défaut les questions et moteurs du brouillon. */
export async function POST(request: Request, ctx: RouteContext<"/api/inspections/[id]/launch">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { questions?: string[]; engineIds?: string[]; providers?: string[] };
  const db = await getDb();
  const insp = await db.query.inspections.findFirst({ where: eq(schema.inspections.id, id) });
  if (!insp) return NextResponse.json({ error: "Inspection introuvable" }, { status: 404 });
  let engineIds = body.engineIds ?? insp.engineIds;
  if (body.providers?.length) {
    const engines = await db.query.engines.findMany();
    engineIds = engines.filter((e) => body.providers!.includes(e.provider)).map((e) => e.id);
  }
  try {
    const plan = await launchInspection(id, { questions: body.questions ?? insp.questions.map((q) => q.text), engineIds });
    const run = await start(inspectionWorkflow, [id, plan.tasks, plan.costCapUsd]);
    return NextResponse.json({ inspectionId: id, tasks: plan.tasks.length, workflowRunId: run.runId });
  } catch (err) {
    if (err instanceof InspectionError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
