import { Suspense } from "react";
import { getCurrentProject } from "@/lib/queries";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";

// Pages authentifiées et lues en base : jamais prérendues au build.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const project = await getCurrentProject();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 border-b" />}>
          <Header projectId={project?.id ?? null} projectName={project?.name ?? "Aucun projet"} brandName={project?.brandName ?? ""} />
        </Suspense>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
