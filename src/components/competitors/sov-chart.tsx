"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { SovPoint } from "@/lib/dashboard-queries";
import { formatDay } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyCard } from "@/components/empty-card";

const RIVAL_SHADES = ["var(--rival)", "oklch(0.7 0.11 65)", "oklch(0.5 0.12 65)", "oklch(0.78 0.08 65)", "oklch(0.42 0.1 65)"];

/** Share of voice (citations) dans le temps : aires empilées, la marque en bas. */
export function SovChart({ series, days }: { series: SovPoint[]; days: number }) {
  const entities = new Map<string, { name: string; brand: boolean }>();
  for (const p of series) entities.set(p.entityId, { name: p.name, brand: p.entityType === "brand" });
  const ids = Array.from(entities.keys()).sort((a, b) => Number(entities.get(b)!.brand) - Number(entities.get(a)!.brand));
  let rivalIndex = 0;
  const config: ChartConfig = Object.fromEntries(
    ids.map((id) => {
      const e = entities.get(id)!;
      return [id, { label: e.name, color: e.brand ? "var(--signal)" : RIVAL_SHADES[rivalIndex++ % RIVAL_SHADES.length] }];
    }),
  );

  const byDay = new Map<string, Record<string, number | string>>();
  for (const p of series) {
    const row = byDay.get(p.day) ?? { day: p.day };
    row[p.entityId] = p.cited;
    byDay.set(p.day, row);
  }
  const data = Array.from(byDay.values())
    .map((row) => {
      const total = ids.reduce((s, id) => s + Number(row[id] ?? 0), 0);
      const out: Record<string, number | string | null> = { day: row.day };
      for (const id of ids) out[id] = total ? Math.round((Number(row[id] ?? 0) / total) * 1000) / 10 : null;
      return out;
    })
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const enough = data.length >= 3;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share of voice dans le temps</CardTitle>
        <CardDescription>Répartition des citations entre la marque et les concurrents, par jour, sur {days} jours.</CardDescription>
      </CardHeader>
      <CardContent>
        {!enough ? (
          <EmptyCard title="La courbe apparaît après quelques runs" className="h-64 justify-center border-0 bg-muted/30">
            {data.length === 0 ? "Aucune citation sur la période." : `${data.length} jour${data.length > 1 ? "s" : ""} de données, il en faut trois pour lire une tendance.`}
          </EmptyCard>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-64 w-full">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} stackOffset="none">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(v) => formatDay(String(v))} />
              <YAxis domain={[0, 100]} width={44} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} %`} />
              <ChartTooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(v) => formatDay(String(v))}
                    formatter={(value, name) => (
                      <span className="flex w-full items-center justify-between gap-4">
                        <span className="text-muted-foreground">{config[String(name)]?.label ?? name}</span>
                        <span className="font-mono tabular-nums">{value === null ? "-" : `${value} %`}</span>
                      </span>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {ids.map((id) => (
                <Area key={id} type="monotone" dataKey={id} stackId="sov" stroke={`var(--color-${id})`} fill={`var(--color-${id})`} fillOpacity={0.35} strokeWidth={1.5} connectNulls isAnimationActive={false} />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
