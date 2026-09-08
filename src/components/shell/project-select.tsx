"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProjectOption = { id: string; name: string; brandName: string };

/**
 * Sélecteur de projet de l'en-tête. Un seul projet aujourd'hui : le projet courant est
 * toujours le premier en base (getCurrentProject), la liste sert à préparer le multi-projet.
 */
export function ProjectSelect({ projects, currentId }: { projects: ProjectOption[]; currentId: string | null }) {
  const current = projects.find((p) => p.id === currentId) ?? null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="-ml-2 max-w-64 gap-1.5 px-2 font-medium" aria-label="Changer de projet" />}
      >
        <span className="truncate">{current?.name ?? "Aucun projet"}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Projets</DropdownMenuLabel>
        {projects.length === 0 ? (
          <DropdownMenuItem disabled>Aucun projet en base</DropdownMenuItem>
        ) : (
          projects.map((p) => {
            const active = p.id === currentId;
            return (
              <DropdownMenuItem key={p.id} className={cn("gap-2", active && "font-medium")} disabled={!active && projects.length > 1}>
                <Check className={cn("size-4", active ? "opacity-100" : "opacity-0")} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{p.name}</span>
                  {p.brandName ? <span className="truncate text-xs font-normal text-muted-foreground">{p.brandName}</span> : null}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />} className="gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          Paramètres du projet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
