"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Square } from "lucide-react";
import { toast } from "sonner";
import { cancelRunAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

/** Arrête un run en cours. Les tâches déjà parties se terminent, aucune nouvelle ne démarre. */
export function StopRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await cancelRunAction(runId);
          toast[r.cancelled ? "success" : "info"](r.cancelled ? "Run arrêté" : "Ce run n'était plus en cours");
          router.refresh();
        })
      }
    >
      <Square data-icon="inline-start" />
      {pending ? "Arrêt" : "Arrêter le run"}
    </Button>
  );
}
