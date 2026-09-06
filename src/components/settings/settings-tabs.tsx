"use client";

import { useRouter } from "next/navigation";
import type { Competitor, Project } from "@/db/schema";
import type { EngineKeyStatus } from "@/lib/ui-queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectForm } from "./project-form";
import { CompetitorsPanel } from "./competitors-panel";
import { EnginesPanel } from "./engines-panel";

export function SettingsTabs({
  project,
  competitors,
  engines,
  initialTab,
}: {
  project: Project;
  competitors: Competitor[];
  engines: EngineKeyStatus[];
  initialTab: "project" | "competitors" | "engines";
}) {
  const router = useRouter();
  return (
    <Tabs defaultValue={initialTab} onValueChange={(v) => router.replace(v === "project" ? "/settings" : `/settings?tab=${v}`, { scroll: false })}>
      <TabsList variant="line">
        <TabsTrigger value="project">Projet</TabsTrigger>
        <TabsTrigger value="competitors">Concurrents ({competitors.length})</TabsTrigger>
        <TabsTrigger value="engines">Moteurs ({engines.filter((e) => e.enabled).length} actifs)</TabsTrigger>
      </TabsList>
      <TabsContent value="project" className="pt-4">
        <ProjectForm project={project} />
      </TabsContent>
      <TabsContent value="competitors" className="pt-4">
        <CompetitorsPanel projectId={project.id} competitors={competitors} />
      </TabsContent>
      <TabsContent value="engines" className="pt-4">
        <EnginesPanel engines={engines} />
      </TabsContent>
    </Tabs>
  );
}
