import Link from "next/link";
import { ExternalLink, ScanSearch } from "lucide-react";
import type { BrandPage } from "@/lib/dashboard-queries";
import { formatInt } from "@/lib/format";
import { normalizeUrl } from "@/lib/inspect/url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EngineMark } from "@/components/engines/engine-logo";
import { EmptyCard } from "@/components/empty-card";

/** URL de la marque apparues dans les sources : ce qui marche déjà, à consolider. */
export function BrandPages({ rows, brandName, hasDomains }: { rows: BrandPage[]; brandName: string; hasDomains: boolean }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Nos pages citées</CardTitle>
        <CardDescription>Pages de {brandName} renvoyées comme sources par les moteurs, regroupées sans paramètres de suivi.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {!hasDomains ? (
          <EmptyCard title="Aucun domaine déclaré pour la marque" className="mx-5 my-3 border-0 bg-muted/30" action={{ href: "/settings", label: "Renseigner les domaines" }}>
            Sans domaine, impossible de reconnaître les pages de la marque dans les sources.
          </EmptyCard>
        ) : rows.length === 0 ? (
          <EmptyCard title="Aucune page de la marque citée sur la période" className="mx-5 my-3 border-0 bg-muted/30" action={{ href: "/inspect", label: "Inspecter une URL" }}>
            Inspectez une page clé pour vérifier qu&apos;elle est lisible par les robots IA et testée sur les questions auxquelles elle répond.
          </EmptyCard>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">URL</TableHead>
                <TableHead className="w-20 text-right">Citations</TableHead>
                <TableHead className="w-20 text-right">Prompts</TableHead>
                <TableHead className="w-24">Moteurs</TableHead>
                <TableHead className="w-12 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.url}>
                  <TableCell className="max-w-0 pl-5 whitespace-normal">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1 underline-offset-4 hover:underline">
                      <span className="line-clamp-2 font-mono text-xs leading-snug break-all text-signal">{normalizeUrl(r.url) ?? r.url}</span>
                      <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">{formatInt(r.count)}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground tabular-nums">{formatInt(r.promptCount)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      {r.engines.map((e) => (
                        <Tooltip key={e.id}>
                          <TooltipTrigger render={<span className="inline-flex" />}>
                            <EngineMark provider={e.provider} size="sm" />
                          </TooltipTrigger>
                          <TooltipContent>{e.label}</TooltipContent>
                        </Tooltip>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                            aria-label="Inspecter cette URL"
                            nativeButton={false}
                            render={<Link href={`/inspect?url=${encodeURIComponent(r.url)}`} />}
                          />
                        }
                      >
                        <ScanSearch />
                      </TooltipTrigger>
                      <TooltipContent>Inspecter cette URL</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
