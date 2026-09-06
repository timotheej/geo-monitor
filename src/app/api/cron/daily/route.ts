import { NextResponse } from "next/server";
import { launchAllProjects } from "@/lib/launch-run";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const launched = await launchAllProjects("cron");
  return NextResponse.json({ launched });
}
