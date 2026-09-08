import type { BrandPage } from "@/lib/dashboard-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyCard } from "@/components/empty-card";
import { BrandPageRow } from "./brand-page-row";

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
          <Table className="table-fixed">
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
                <BrandPageRow key={r.url} page={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
