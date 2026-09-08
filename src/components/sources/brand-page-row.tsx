"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, ExternalLink, ScanSearch } from "lucide-react";
import type { BrandPage } from "@/lib/dashboard-queries";
import { formatDateTime, formatInt } from "@/lib/format";
import { normalizeUrl } from "@/lib/inspect/url";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EngineMark } from "@/components/engines/engine-logo";
import { ResultLink } from "@/components/result/result-link";
import { cn } from "@/lib/utils";

/** Une page de la marque, dépliable : chaque réponse où elle apparaît, avec le prompt, le moteur et le rang. */
export function BrandPageRow({ page }: { page: BrandPage }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow className={cn("cursor-pointer", open && "bg-muted/30")} onClick={() => setOpen((o) => !o)}>
        <TableCell className="max-w-0 pl-3 whitespace-normal">
          <span className="flex items-start gap-1.5">
            <ChevronRight className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden />
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="group flex min-w-0 items-start gap-1 underline-offset-4 hover:underline"
            >
              <span className="line-clamp-2 font-mono text-xs leading-snug break-all text-signal">{normalizeUrl(page.url) ?? page.url}</span>
              <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </a>
          </span>
        </TableCell>
        <TableCell className="text-right font-mono text-sm tabular-nums">{formatInt(page.count)}</TableCell>
        <TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">{formatInt(page.promptCount)}</TableCell>
        <TableCell>
          <span className="flex items-center gap-1">
            {page.engines.map((e) => (
              <Tooltip key={e.id}>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <EngineMark provider={e.provider} size="sm" />
                </TooltipTrigger>
                <TooltipContent>{e.label}</TooltipContent>
              </Tooltip>
            ))}
          </span>
        </TableCell>
        <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label="Inspecter cette URL"
                  nativeButton={false}
                  render={<Link href={`/inspect?url=${encodeURIComponent(page.url)}`} />}
                />
              }
            >
              <ScanSearch />
            </TooltipTrigger>
            <TooltipContent>Inspecter cette URL</TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="bg-muted/20 px-5 py-3 whitespace-normal">
            {/* w-0 + min-w-full : le contenu prend la largeur de la cellule sans élargir le tableau */}
            <div className="w-0 min-w-full">
            <p className="mb-2 text-xs text-muted-foreground">
              {page.citations.length} réponse{page.citations.length > 1 ? "s" : ""} où cette page apparaît dans les sources, la plus récente en premier. Cliquez sur une ligne pour lire la réponse.
            </p>
            <ul className="divide-y rounded-md border bg-background">
              {page.citations.map((c) => (
                <li key={c.resultId}>
                  <ResultLink resultId={c.resultId} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                    <EngineMark provider={c.engine.provider} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{c.promptText}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                      {c.cited ? `rang ${c.rank}` : "lue, non utilisée"}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{formatDateTime(c.date)}</span>
                  </ResultLink>
                </li>
              ))}
            </ul>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
