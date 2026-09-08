import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProject } from "@/lib/queries";
import { getPrompt, getPromptCompetitors, getPromptHistory } from "@/lib/dashboard-queries";
import { firstParam, parseDays } from "@/lib/ui-queries";
import { formatInt, formatRate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NoProject } from "@/components/dashboard/empty-state";
import { RateValue, Bar } from "@/components/dashboard/rate";
import { PromptResultsTable, PromptTimeline } from "@/components/prompts/prompt-history";
import { ResultSheet } from "@/components/result/result-sheet";

export const metadata: Metadata = { title: "Fiche prompt" };

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3 sm:border-l first:sm:border-l-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums">{children}</span>
    </div>
  );
}

export default async function PromptDetailPage({ params, searchParams }: PageProps<"/prompts/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const days = parseDays(sp.days);
  const project = await getCurrentProject();
  if (!project) return <NoProject />;
  const prompt = await getPrompt(id);
  if (!prompt || prompt.projectId !== project.id) notFound();

  const [results, competitors] = await Promise.all([getPromptHistory(id, days), getPromptCompetitors(id, days)]);
  const ok = results.filter((r) => !r.error);
  const cited = ok.filter((r) => r.cited).length;
  const mentioned = ok.filter((r) => r.mentioned).length;
  const rivals = competitors.filter((c) => c.cited > 0 || c.mentioned > 0);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground" nativeButton={false} render={<Link href="/prompts" />}>
          <ArrowLeft data-icon="inline-start" />
          Thèmes et prompts
        </Button>
        <h1 className="max-w-3xl text-xl leading-snug font-medium tracking-tight text-balance">{prompt.text}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {prompt.tags.map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
          <Badge variant="outline" className="text-muted-foreground">
            {prompt.webSearch ? "recherche web" : "mémoire du modèle"}
          </Badge>
          <Badge variant="outline" className="font-mono text-muted-foreground uppercase">
            {prompt.lang}
          </Badge>
          {!prompt.active ? <Badge variant="outline" className="text-muted-foreground">désactivé</Badge> : null}
        </div>
      </div>

      <section className="grid grid-cols-2 divide-y rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-4 sm:divide-y-0">
        <Stat label="Réponses">{formatInt(ok.length)}</Stat>
        <Stat label="Citation">
          <RateValue value={ok.length ? cited / ok.length : null} />
        </Stat>
        <Stat label="Mention">
          <RateValue value={ok.length ? mentioned / ok.length : null} accent="none" />
        </Stat>
        <Stat label="Concurrents cités">{rivals.filter((c) => c.cited > 0).length}</Stat>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <PromptTimeline results={results} days={days} />
        <Card>
          <CardHeader>
            <CardTitle>Concurrents sur ce prompt</CardTitle>
            <CardDescription>Part des réponses où chaque concurrent est cité ou mentionné.</CardDescription>
          </CardHeader>
          <CardContent>
            {competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun concurrent déclaré.{" "}
                <Link href="/settings?tab=competitors" className="underline underline-offset-4 hover:text-foreground">
                  En ajouter
                </Link>
              </p>
            ) : rivals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun concurrent cité ni mentionné sur la période.</p>
            ) : (
              <ol className="space-y-3">
                {rivals.map((c) => (
                  <li key={c.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        <span className="text-rival">{formatRate(c.answers ? c.cited / c.answers : null)}</span> cité
                        <span className="mx-1.5 text-muted-foreground/50">·</span>
                        {formatRate(c.answers ? c.mentioned / c.answers : null)} mentionné
                      </span>
                    </div>
                    <Bar value={c.answers ? c.cited / c.answers : 0} color="var(--rival)" />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <PromptResultsTable results={results} />
      <ResultSheet resultId={firstParam(sp.result)} />
    </div>
  );
}
