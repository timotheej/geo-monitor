import type { Metadata } from "next";
import { getCurrentProject, getOverview } from "@/lib/queries";
import { getBrandPages, getDomainsInsteadOfUs, getPromptsWithoutBrand } from "@/lib/dashboard-queries";
import { firstParam, parseDays } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { NoProject } from "@/components/dashboard/empty-state";
import { DomainsInstead } from "@/components/sources/domains-instead";
import { BrandPages } from "@/components/sources/brand-pages";
import { PromptsWithoutBrand } from "@/components/sources/prompts-without-brand";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Sources et opportunités" };

export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const sp = await searchParams;
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;

  const [overview, domains, pages, prompts] = await Promise.all([
    getOverview(project.id, days),
    getDomainsInsteadOfUs(project.id, days, 20),
    getBrandPages(project.id, days, 50),
    getPromptsWithoutBrand(project.id, days),
  ]);
  const hasData = overview.answers > 0;

  return (
    <div className="space-y-6">
      <PageTitle title="Sources et opportunités" description={`Qu'est-ce que je fais lundi ? Les sites à travailler, les pages qui marchent et les questions perdues, sur ${days} jours.`} />
      <DomainsInstead rows={domains} hasData={hasData} />
      <div className="grid gap-6 xl:grid-cols-2">
        <BrandPages rows={pages} brandName={project.brandName} hasDomains={project.domains.length > 0} />
        <PromptsWithoutBrand rows={prompts} hasData={hasData} />
      </div>
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
