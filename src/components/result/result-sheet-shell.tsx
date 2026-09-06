"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";

/** Drawer contrôlé par le searchParam `result` : fermer retire le paramètre de l'URL. */
export function ResultSheetShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onOpenChange(open: boolean) {
    if (open) return;
    const next = new URLSearchParams(params.toString());
    next.delete("result");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-2 sm:max-w-xl">
        {children}
      </SheetContent>
    </Sheet>
  );
}
