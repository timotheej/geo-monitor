"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type PromptsTab = "themes" | "manage";

/** Onglets Thèmes / Gestion, état dans l'URL (`?tab=manage`) pour rester partageable. */
export function PromptsTabs({ initialTab, themes, manage, manageCount }: { initialTab: PromptsTab; themes: React.ReactNode; manage: React.ReactNode; manageCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === "manage") next.set("tab", "manage");
    else {
      next.delete("tab");
      next.delete("tag");
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs defaultValue={initialTab} onValueChange={onChange}>
      <TabsList variant="line">
        <TabsTrigger value="themes">Thèmes</TabsTrigger>
        <TabsTrigger value="manage">Gestion ({manageCount})</TabsTrigger>
      </TabsList>
      <TabsContent value="themes" className="pt-4">
        {themes}
      </TabsContent>
      <TabsContent value="manage" className="pt-4">
        {manage}
      </TabsContent>
    </Tabs>
  );
}
