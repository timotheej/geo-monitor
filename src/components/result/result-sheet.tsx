import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getResultDetail } from "@/lib/queries";
import { findMentionSpans, domainMatches } from "@/lib/detection";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatDateLong, formatEur, formatInt, formatLatency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ResultSheetShell } from "./result-sheet-shell";
import { cn } from "@/lib/utils";

type Entity = NonNullable<Awaited<ReturnType<typeof getResultDetail>>>["entities"][number];

/** Segments du texte brut, chaque segment porte au plus une entité. */
function segment(text: string, entities: Entity[]) {
  const spans = entities
    .flatMap((e) => findMentionSpans(text, e.terms).map((s) => ({ ...s, entity: e })))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Array<{ text: string; entity: Entity | null }> = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue;
    if (s.start > cursor) out.push({ text: text.slice(cursor, s.start), entity: null });
    out.push({ text: text.slice(s.start, s.end), entity: s.entity });
    cursor = s.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), entity: null });
  return out;
}

function entityFor(domain: string, entities: Entity[]) {
  return entities.find((e) => e.domains.some((d) => domainMatches(domain, d))) ?? null;
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{children}</dd>
    </div>
  );
}

export async function ResultSheet({ resultId }: { resultId: string | undefined }) {
  if (!resultId) return null;
  const detail = await getResultDetail(resultId);

  if (!detail) {
    return (
      <ResultSheetShell>
        <SheetHeader>
          <SheetTitle>Résultat introuvable</SheetTitle>
          <SheetDescription>Ce résultat a peut-être été supprimé avec son prompt ou son run.</SheetDescription>
        </SheetHeader>
      </ResultSheetShell>
    );
  }

  const { result, entities } = detail;
  const usage = result.usage ?? {};
  const segments = result.rawText ? segment(result.rawText, entities) : [];
  const detectionByEntity = new Map(result.detections.map((d) => [d.entityId, d]));

  return (
    <ResultSheetShell>
      <SheetHeader className="pr-12">
        <SheetDescription className="mb-1 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{result.engine.label}</Badge>
          <span className="font-mono text-xs">{result.engine.model}</span>
          <Badge variant="outline" className="text-muted-foreground">
            {result.webSearch ? "recherche web" : "mémoire du modèle"}
          </Badge>
        </SheetDescription>
        <SheetTitle className="text-base leading-snug text-balance">{result.prompt.text}</SheetTitle>
        <p className="text-xs text-muted-foreground">
          {formatDateLong(result.createdAt)},{" "}
          <Link href={`/runs/${result.runId}`} className="underline underline-offset-4 hover:text-foreground">
            voir le run
          </Link>
        </p>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-4">
          <Meta label="Latence">{formatLatency(result.latencyMs)}</Meta>
          <Meta label="Tokens">
            {usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0) ? (
              <>
                {formatInt(usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0))}
                {usage.inputTokens !== undefined ? (
                  <span className="text-muted-foreground"> ({formatInt(usage.inputTokens)} + {formatInt(usage.outputTokens ?? 0)})</span>
                ) : null}
              </>
            ) : (
              "-"
            )}
          </Meta>
          <Meta label="Recherches">{usage.searches ?? 0}</Meta>
          <Meta label="Coût estimé">{formatEur(result.costEstimate * USD_TO_EUR, true)}</Meta>
        </dl>

        {result.error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <p className="mb-1 font-medium text-destructive">Le moteur a renvoyé une erreur</p>
            <p className="font-mono text-xs break-words text-destructive/90">{result.error}</p>
          </div>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Détections</h3>
            <span className="text-xs text-muted-foreground">
              <span className="mr-2 inline-block size-2 rounded-full bg-signal align-middle" />
              marque
              <span className="mr-2 ml-3 inline-block size-2 rounded-full bg-rival align-middle" />
              concurrent
            </span>
          </div>
          <ul className="divide-y rounded-lg border">
            {entities.map((e) => {
              const d = detectionByEntity.get(e.id);
              const isBrand = e.type === "brand";
              return (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className={cn("size-2 shrink-0 rounded-full", isBrand ? "bg-signal" : "bg-rival")} />
                  <span className={cn("min-w-0 flex-1 truncate", isBrand && "font-medium")}>{e.name}</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <Badge variant={d?.cited ? "default" : "outline"} className={cn(d?.cited ? "" : "text-muted-foreground")}>
                      {d?.cited ? `cité, rang ${d.citationRank}` : "non cité"}
                    </Badge>
                    <Badge variant={d?.mentioned ? "secondary" : "outline"} className={cn(d?.mentioned ? "" : "text-muted-foreground")}>
                      {d?.mentioned ? `mentionné, rang ${d.mentionRank}` : "non mentionné"}
                    </Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">
            Sources <span className="text-muted-foreground">({result.sources.length})</span>
          </h3>
          {result.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {result.webSearch ? "Aucune source renvoyée par le moteur." : "Pas de sources en mode mémoire : seule la mention compte."}
            </p>
          ) : (
            <ol className="space-y-1">
              {result.sources.map((s, i) => {
                const owner = entityFor(s.domain, entities);
                return (
                  <li key={`${s.url}-${i}`} className="flex items-start gap-2 text-sm">
                    <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium group-hover:underline underline-offset-4">{s.domain}</span>
                        {owner ? (
                          <Badge
                            variant="outline"
                            className={cn(owner.type === "brand" ? "border-signal/50 text-signal" : "border-rival/50 text-rival")}
                          >
                            {owner.name}
                          </Badge>
                        ) : null}
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                      {s.title ? <span className="block truncate text-xs text-muted-foreground">{s.title}</span> : null}
                    </a>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <Separator />

        <section>
          <h3 className="mb-2 text-sm font-medium">Réponse brute</h3>
          {segments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Réponse vide.</p>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {segments.map((seg, i) =>
                seg.entity ? (
                  <mark
                    key={i}
                    title={seg.entity.name}
                    className={cn(
                      "rounded-sm px-0.5 text-foreground",
                      seg.entity.type === "brand" ? "bg-signal/25 ring-1 ring-signal/40" : "bg-rival/20 ring-1 ring-rival/40",
                    )}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </p>
          )}
        </section>
      </div>
    </ResultSheetShell>
  );
}
