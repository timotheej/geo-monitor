import type { Metadata } from "next";
import { getCurrentProject, getEngines, getPromptMatrix } from "@/lib/queries";
import { getThemeSummary } from "@/lib/dashboard-queries";
import { firstParam, parseDays } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { PromptsTable } from "@/components/prompts/prompts-table";
import { PromptsTabs } from "@/components/prompts/prompts-tabs";
import { ThemeOverview } from "@/components/prompts/theme-overview";
import { AddPromptDialog } from "@/components/prompts/add-prompt-dialog";
import { ImportCsvDialog } from "@/components/prompts/import-csv-dialog";
import { PromptMatrix } from "@/components/dashboard/prompt-matrix";
import { NoProject } from "@/components/dashboard/empty-state";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Thèmes et prompts" };

export default async function PromptsPage({ searchParams }: PageProps<"/prompts">) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const [matrix, themes, engines] = await Promise.all([getPromptMatrix(project.id, days), getThemeSummary(project.id, days), getEngines()]);
  const rows = matrix.map((m) => ({ prompt: m.prompt, citationRate30: m.citationRate }));
  const active = rows.filter((r) => r.prompt.active).length;
  const tab = firstParam(sp.tab) === "manage" ? "manage" : "themes";

  return (
    <div className="space-y-6">
      <PageTitle
        title="Thèmes et prompts"
        description={`Où on gagne, où on perd : ${rows.length} prompt${rows.length > 1 ? "s" : ""}, dont ${active} actif${active > 1 ? "s" : ""}, lus sur ${days} jours.`}
        actions={
          <>
            <ImportCsvDialog projectId={project.id} />
            <AddPromptDialog projectId={project.id} />
          </>
        }
      />
      <PromptsTabs
        initialTab={tab}
        manageCount={rows.length}
        themes={
          <div className="space-y-6">
            <ThemeOverview rows={themes} days={days} />
            {rows.length > 0 ? (
              <PromptMatrix
                rows={matrix}
                engines={engines.filter((e) => e.enabled)}
                days={days}
              />
            ) : null}
          </div>
        }
        manage={<PromptsTable rows={rows} projectId={project.id} initialTag={firstParam(sp.tag)} />}
      />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
