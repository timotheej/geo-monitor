import { NextResponse } from "next/server";
import { launchRun } from "@/lib/launch-run";
import { getCurrentProject, getRuns } from "@/lib/queries";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: string };
  const projectId = body.projectId ?? (await getCurrentProject())?.id;
  if (!projectId) return NextResponse.json({ error: "projectId requis" }, { status: 400 });
  const launched = await launchRun(projectId, "manual");
  return NextResponse.json(launched);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? (await getCurrentProject())?.id;
  if (!projectId) return NextResponse.json({ runs: [] });
  const limit = Number(searchParams.get("limit") ?? 20);
  return NextResponse.json({ runs: await getRuns(projectId, limit) });
}
