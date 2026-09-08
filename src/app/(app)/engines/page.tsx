import type { Metadata } from "next";
import { getCurrentProject } from "@/lib/queries";
import { getEngineDomains, getEngineStats, getEngineThemeMatrix } from "@/lib/dashboard-queries";
import { firstParam, parseDays } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { NoProject } from "@/components/dashboard/empty-state";
import { ThemeMatrixTable } from "@/components/engines/theme-matrix";
import { EngineDomains } from "@/components/engines/engine-domains";
import { EngineStatsGrid } from "@/components/engines/engine-stats";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Moteurs" };

export default async function EnginesPage({ searchParams }: PageProps<"/engines">) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const [matrix, domains, stats] = await Promise.all([getEngineThemeMatrix(project.id, days), getEngineDomains(project.id, days, 8), getEngineStats(project.id, days)]);

  return (
    <div className="space-y-6">
      <PageTitle title="Moteurs" description={`Les assistants IA se comportent-ils pareil ? Comparaison sur ${days} jours.`} />
      <EngineStatsGrid rows={stats} />
      <ThemeMatrixTable matrix={matrix} days={days} />
      <EngineDomains rows={domains} />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
