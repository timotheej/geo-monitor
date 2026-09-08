import { NextResponse } from "next/server";
import { getCurrentProject } from "@/lib/queries";
import { getInspections } from "@/lib/inspect/queries";
import { InspectionError, prepareInspection } from "@/lib/inspect/service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? (await getCurrentProject())?.id;
  if (!projectId) return NextResponse.json({ inspections: [] });
  return NextResponse.json({ inspections: await getInspections(projectId, Number(searchParams.get("limit") ?? 20)) });
}

/** Étape A : `{ "url": "...", "projectId"?: "...", "force"?: true }` */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: string; projectId?: string; force?: boolean };
  const projectId = body.projectId ?? (await getCurrentProject())?.id;
  if (!projectId || !body.url) return NextResponse.json({ error: "url requise" }, { status: 400 });
  try {
    return NextResponse.json(await prepareInspection(projectId, body.url, { force: body.force === true }));
  } catch (err) {
    if (err instanceof InspectionError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
