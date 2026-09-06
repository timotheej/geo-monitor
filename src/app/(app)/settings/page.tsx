import type { Metadata } from "next";
import { getCurrentProject } from "@/lib/queries";
import { firstParam, getEngineKeyStatus } from "@/lib/ui-queries";
import { PageTitle } from "@/components/page-title";
import { NoProject } from "@/components/dashboard/empty-state";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const [project, engines] = await Promise.all([getCurrentProject(), getEngineKeyStatus()]);
  if (!project) return <NoProject />;
  const tab = firstParam(sp.tab);
  const initial = tab === "competitors" || tab === "engines" ? tab : "project";

  return (
    <div className="space-y-6">
      <PageTitle title="Paramètres" description="Marque suivie, concurrents et moteurs interrogés. Les changements s'appliquent au prochain run." />
      <SettingsTabs project={project} competitors={project.competitors} engines={engines} initialTab={initial} />
    </div>
  );
}
