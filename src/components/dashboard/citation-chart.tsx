"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/queries";
import { formatDay } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const DASHES = [undefined, undefined, "4 3", "2 3"];

export function CitationChart({ series, engines, days }: { series: SeriesPoint[]; engines: Array<{ id: string; label: string }>; days: number }) {
  const known = new Map(engines.map((e) => [e.id, e.label]));
  for (const p of series) if (!known.has(p.engineId)) known.set(p.engineId, p.engineLabel);
  const engineIds = Array.from(known.keys());

  const config: ChartConfig = Object.fromEntries(
    engineIds.map((id, i) => [id, { label: known.get(id), color: PALETTE[i % PALETTE.length] }]),
  );

  const byDay = new Map<string, Record<string, number | string | null>>();
  for (const p of series) {
    const row = byDay.get(p.day) ?? { day: p.day };
    row[p.engineId] = p.total ? Math.round((p.cited / p.total) * 1000) / 10 : null;
    byDay.set(p.day, row);
  }
  const data = Array.from(byDay.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taux de citation par moteur</CardTitle>
        <CardDescription>Par jour, sur les {days} derniers jours. Une réponse compte comme citée si un domaine de la marque figure dans ses sources.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(v) => formatDay(String(v))} />
            <YAxis domain={[0, 100]} width={44} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} %`} />
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  indicator="line"
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
            {engineIds.map((id, i) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={`var(--color-${id})`}
                strokeWidth={2}
                strokeDasharray={DASHES[i % DASHES.length]}
                dot={data.length < 3 ? { r: 3 } : false}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
