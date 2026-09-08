"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/queries";
import { formatDay } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { engineColor } from "@/components/engines/engine-logo";
import { EmptyCard } from "@/components/empty-card";

type Metric = "cited" | "mentioned";
type EngineRef = { id: string; label: string; provider: string };

/** Courbe par moteur du taux de citation ou de mention, par jour. */
export function TrendChart({ series, engines, days }: { series: SeriesPoint[]; engines: EngineRef[]; days: number }) {
  const [metric, setMetric] = useState<Metric>("cited");

  const known = new Map<string, EngineRef>(engines.map((e) => [e.id, e]));
  for (const p of series) if (!known.has(p.engineId)) known.set(p.engineId, { id: p.engineId, label: p.engineLabel, provider: "unknown" });
  const engineIds = Array.from(known.keys());
  const config: ChartConfig = Object.fromEntries(engineIds.map((id) => [id, { label: known.get(id)!.label, color: engineColor(known.get(id)!.provider) }]));

  const byDay = new Map<string, Record<string, number | string | null>>();
  for (const p of series) {
    const row = byDay.get(p.day) ?? { day: p.day };
    row[p.engineId] = p.total ? Math.round((p[metric] / p.total) * 1000) / 10 : null;
    byDay.set(p.day, row);
  }
  const data = Array.from(byDay.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const enough = data.length >= 3;

  return (
    <Card>
      <CardHeader className="grid-cols-[1fr_auto] items-start">
        <div className="space-y-1">
          <CardTitle>Tendance par moteur</CardTitle>
          <CardDescription>
            {metric === "cited" ? "Taux de citation" : "Taux de mention"} par jour sur les {days} derniers jours.
          </CardDescription>
        </div>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList aria-label="Indicateur">
            <TabsTrigger value="cited">Citation</TabsTrigger>
            <TabsTrigger value="mentioned">Mention</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {!enough ? (
          <EmptyCard title="La tendance apparaît après quelques runs" className="h-64 justify-center border-0 bg-muted/30">
            {data.length === 0
              ? "Aucune réponse sur la période. Lancez un run, puis laissez le cron quotidien accumuler des points."
              : `${data.length} jour${data.length > 1 ? "s" : ""} de données pour l'instant, il en faut trois pour tracer une courbe honnête.`}
          </EmptyCard>
        ) : (
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
              {engineIds.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  stroke={`var(--color-${id})`}
                  strokeWidth={2}
                  dot={data.length < 6 ? { r: 3 } : false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
