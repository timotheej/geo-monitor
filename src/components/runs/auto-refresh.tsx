"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Rafraîchit les données serveur toutes les 5 s tant qu'un run est en attente ou en cours. */
export function AutoRefresh({ active, intervalMs = 5000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);
  return null;
}
