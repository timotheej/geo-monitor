import type { ThemeMatrix } from "@/lib/dashboard-queries";
import { formatInt, formatRate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EngineMark, engineColor } from "@/components/engines/engine-logo";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";

/** Matrice thème × moteur : taux de citation, couleur graduée du gris clair à la couleur du moteur. */
export function ThemeMatrixTable({ matrix, days }: { matrix: ThemeMatrix; days: number }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Thèmes × moteurs</CardTitle>
        <CardDescription>Taux de citation de la marque par thème (tags des prompts) et par moteur sur {days} jours. Survolez une cellule pour le nombre de réponses.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {matrix.themes.length === 0 ? (
          <EmptyCard title="Pas encore de réponses à croiser" className="mx-5 my-3 border-0 bg-muted/30" action={{ href: "/prompts", label: "Voir les prompts" }}>
            La matrice se remplit après le premier run. Ajoutez des tags aux prompts pour regrouper les questions par thème.
          </EmptyCard>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Thème</TableHead>
                {matrix.engines.map((e) => (
                  <TableHead key={e.id} className="w-32 text-center">
                    <span className="inline-flex items-center gap-1.5">
                      <EngineMark provider={e.provider} size="sm" />
                      {e.label}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.themes.map((theme) => (
                <TableRow key={theme} className="hover:bg-transparent">
                  <TableCell className="pl-5 font-medium">{theme}</TableCell>
                  {matrix.engines.map((e) => {
                    const cell = matrix.cells[theme]?.[e.id];
                    const r = cell && cell.total ? cell.cited / cell.total : null;
                    const color = engineColor(e.provider);
                    const bg = r === null ? undefined : `color-mix(in oklch, ${color} ${Math.round(8 + r * 92)}%, white)`;
                    const dark = r !== null && r >= 0.55;
                    return (
                      <TableCell key={e.id} className="p-1.5 text-center">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span
                                className={cn(
                                  "grid h-9 w-full place-items-center rounded-md font-mono text-sm tabular-nums",
                                  r === null ? "bg-muted/40 text-muted-foreground/50" : dark ? "text-white" : "text-foreground",
                                )}
                                style={bg ? { backgroundColor: bg } : undefined}
                              />
                            }
                          >
                            {formatRate(r)}
                          </TooltipTrigger>
                          <TooltipContent>
                            {cell ? `${formatInt(cell.cited)} citée${cell.cited > 1 ? "s" : ""} sur ${formatInt(cell.total)} réponse${cell.total > 1 ? "s" : ""}` : "Pas de réponse"}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
