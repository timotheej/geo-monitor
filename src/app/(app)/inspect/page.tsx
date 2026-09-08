import type { Metadata } from "next";
import { getCurrentProject } from "@/lib/queries";
import { getInspectionSummaries } from "@/lib/inspect/ui-queries";
import { PageTitle } from "@/components/page-title";
import { NoProject } from "@/components/dashboard/empty-state";
import { AutoRefresh } from "@/components/runs/auto-refresh";
import { InspectForm } from "@/components/inspect/inspect-form";
import { InspectionsTable } from "@/components/inspect/inspections-table";
import { InspectEmptyState } from "@/components/inspect/inspect-empty-state";

export const metadata: Metadata = { title: "Inspecter une URL" };
/** Liste lue en base à chaque requête, jamais figée au build. */
export const dynamic = "force-dynamic";

export default async function InspectPage() {
  const project = await getCurrentProject();
  if (!project) return <NoProject />;
  const rows = await getInspectionSummaries(project.id, 50);
  const running = rows.some((r) => r.status === "running");

  return (
    <div className="space-y-6">
      <PageTitle
        title="Inspecter une URL"
        description="Une page précise est-elle lisible par les robots IA, et les moteurs la citent-ils quand on leur pose les questions auxquelles elle répond ?"
      />
      <InspectForm projectId={project.id} disabled={running} />
      {rows.length === 0 ? (
        <InspectEmptyState />
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Inspections passées</h2>
          <InspectionsTable rows={rows} />
        </section>
      )}
      <AutoRefresh active={running} intervalMs={3000} />
    </div>
  );
}
