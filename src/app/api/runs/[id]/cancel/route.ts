import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/launch-run";

export async function POST(_: Request, ctx: RouteContext<"/api/runs/[id]/cancel">) {
  const { id } = await ctx.params;
  return NextResponse.json(await cancelRun(id));
}
