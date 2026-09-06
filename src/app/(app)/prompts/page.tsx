import type { Metadata } from "next";
import { getCurrentProject, getPromptMatrix } from "@/lib/queries";
import { firstParam } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { PromptsTable } from "@/components/prompts/prompts-table";
import { AddPromptDialog } from "@/components/prompts/add-prompt-dialog";
import { ImportCsvDialog } from "@/components/prompts/import-csv-dialog";
import { NoProject } from "@/components/dashboard/empty-state";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Prompts" };

export default async function PromptsPage({ searchParams }: PageProps<"/prompts">) {
  const sp = await searchParams;
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const matrix = await getPromptMatrix(project.id, 30);
  const rows = matrix.map((m) => ({ prompt: m.prompt, citationRate30: m.citationRate }));
  const active = rows.filter((r) => r.prompt.active).length;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Prompts"
        description={`${rows.length} prompt${rows.length > 1 ? "s" : ""}, dont ${active} actif${active > 1 ? "s" : ""}. Un prompt est immuable : désactivez-le plutôt que de le modifier, l'historique reste cohérent.`}
        actions={
          <>
            <ImportCsvDialog projectId={project.id} />
            <AddPromptDialog projectId={project.id} />
          </>
        }
      />
      <PromptsTable rows={rows} projectId={project.id} />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
