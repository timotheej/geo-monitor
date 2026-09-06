import type { Metadata } from "next";
import { getCurrentProject, getRuns } from "@/lib/queries";
import { firstParam } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { RunsTable } from "@/components/runs/runs-table";
import { AutoRefresh } from "@/components/runs/auto-refresh";
import { NoProject } from "@/components/dashboard/empty-state";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Runs" };

export default async function RunsPage({ searchParams }: PageProps<"/runs">) {
  const sp = await searchParams;
  const project = await getCurrentProject();
  if (!project) return <NoProject />;
  const runs = await getRuns(project.id, 100);
  const live = runs.some((r) => r.status === "pending" || r.status === "running");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Runs"
        description="Chaque run interroge tous les moteurs actifs sur tous les prompts actifs. Le cron en lance un chaque matin à 7 h."
      />
      <RunsTable runs={runs} />
      <AutoRefresh active={live} />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
