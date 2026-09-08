import { ExternalLink } from "lucide-react";
import type { getInspection } from "@/lib/inspect/queries";
import { CELL_LABEL, cellKind, citedInstead, computeVerdict, plural, sourceOwner, type CellKind } from "@/lib/inspect/verdict";
import { USD_TO_EUR } from "@/lib/pricing";
import { formatEur, formatLatency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Section } from "./section";
import { cn } from "@/lib/utils";

type Detail = NonNullable<Awaited<ReturnType<typeof getInspection>>>;
type Answer = Detail["inspection"]["answers"][number];

const DOT: Record<CellKind, string> = {
  url: "bg-signal",
  domain: "bg-signal/45",
  competitor: "bg-rival",
  none: "bg-muted-foreground/35",
  error: "bg-destructive",
  pending: "border border-dashed border-muted-foreground/40 bg-transparent",
};

const TEXT: Record<CellKind, string> = {
  url: "text-signal",
  domain: "text-signal/80",
  competitor: "text-rival",
  none: "text-muted-foreground",
  error: "text-destructive",
  pending: "text-muted-foreground/60",
};

function Dot({ kind }: { kind: CellKind }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT[kind])} />;
}

function cellText(kind: CellKind, a: Answer | undefined) {
  if (kind === "url") return `URL citée${a?.urlRank ? `, rang ${a.urlRank}` : ""}`;
  if (kind === "domain") return `Autre page du site${a?.domainRank ? `, rang ${a.domainRank}` : ""}`;
  return CELL_LABEL[kind];
}

export function AnswersSection({ data }: { data: Detail }) {
  const { inspection, engines } = data;
  const competitors = inspection.project.competitors;
  const brandDomains = inspection.project.domains;
  const answers = inspection.answers;
  const usedEngines = inspection.engineIds.map((id) => engines.find((e) => e.id === id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const byKey = new Map(answers.map((a) => [`${a.questionIndex}:${a.engineId}`, a]));
  const verdict = computeVerdict(answers, competitors);
  const instead = citedInstead(answers, brandDomains, competitors);
  const live = inspection.status === "running";

  const headline =
    verdict.ok === 0
      ? live
        ? "Les premières réponses arrivent dans quelques secondes."
        : "Aucune réponse exploitable."
      : verdict.urlCited > 0
        ? `URL citée dans ${verdict.urlCited} ${plural(verdict.urlCited, "réponse")} sur ${verdict.ok}`
        : `URL jamais citée sur ${verdict.ok} ${plural(verdict.ok, "réponse")}`;

  return (
    <Section
      title="Résultat du test"
      description={
        usedEngines.length
          ? `${inspection.questions.length} ${plural(inspection.questions.length, "question")} posée${inspection.questions.length > 1 ? "s" : ""} à ${usedEngines.map((e) => e.label).join(", ")}, avec recherche web.`
          : undefined
      }
    >
      <div className="rounded-lg bg-muted/40 p-4">
        <p className={cn("text-lg font-medium tracking-tight", verdict.urlCited > 0 ? "text-signal" : "")}>{headline}</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {verdict.domainOnly > 0 ? (
            <li>
              Une autre page du site citée dans {verdict.domainOnly} {plural(verdict.domainOnly, "réponse")}
            </li>
          ) : null}
          {verdict.competitorOnly > 0 ? (
            <li>
              Un concurrent cité sans la marque dans {verdict.competitorOnly} {plural(verdict.competitorOnly, "réponse")}
            </li>
          ) : null}
          {verdict.errors > 0 ? (
            <li className="text-destructive">
              {verdict.errors} {plural(verdict.errors, "erreur")} de moteur
            </li>
          ) : null}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Une réponse par question est un instantané, pas une tendance. Relance l&apos;inspection plus tard ou ajoute les questions au suivi quotidien.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="min-w-56 px-3 py-2 font-medium">Question</th>
              {usedEngines.map((e) => (
                <th key={e.id} className="min-w-48 px-3 py-2 font-medium">
                  {e.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {inspection.questions.map((q, qi) => (
              <tr key={qi} className="align-top">
                <td className="px-3 py-2.5">
                  <span className="mr-2 font-mono text-xs text-muted-foreground tabular-nums">{qi + 1}</span>
                  {q.text}
                  {q.source === "manual" ? <span className="ml-2 text-xs text-muted-foreground">(saisie)</span> : null}
                </td>
                {usedEngines.map((e) => {
                  const a = byKey.get(`${qi}:${e.id}`);
                  const kind = cellKind(a, competitors);
                  return (
                    <td key={e.id} className="px-3 py-2.5">
                      {a ? (
                        <details className="group">
                          <summary className={cn("flex cursor-pointer list-none items-center gap-2 text-xs select-none [&::-webkit-details-marker]:hidden", TEXT[kind])}>
                            <Dot kind={kind} />
                            <span className="group-open:underline underline-offset-4">{cellText(kind, a)}</span>
                          </summary>
                          <AnswerDetail answer={a} brandDomains={brandDomains} competitors={competitors} />
                        </details>
                      ) : (
                        <span className={cn("flex items-center gap-2 text-xs", TEXT[kind])}>
                          <Dot kind={kind} />
                          {live ? "en attente" : "-"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(["url", "domain", "competitor", "none", "error"] as CellKind[]).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <Dot kind={k} />
            {CELL_LABEL[k].toLowerCase()}
          </li>
        ))}
        <li className="ml-auto">Cliquez sur une cellule pour voir les sources et la réponse.</li>
      </ul>

      {instead.length ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">
            Cités à la place <span className="text-muted-foreground">(réponses sans l&apos;URL)</span>
          </h3>
          <ul className="divide-y rounded-lg border">
            {instead.map((row) => (
              <li key={row.domain} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{row.domain}</span>
                {row.owner ? <OwnerBadge owner={row.owner} /> : null}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {row.count} {plural(row.count, "réponse")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function OwnerBadge({ owner }: { owner: { kind: "brand" | "competitor"; name: string } }) {
  return (
    <Badge variant="outline" className={cn("font-normal", owner.kind === "brand" ? "border-signal/50 text-signal" : "border-rival/50 text-rival")}>
      {owner.name}
    </Badge>
  );
}

function AnswerDetail({ answer, brandDomains, competitors }: { answer: Answer; brandDomains: string[]; competitors: Detail["inspection"]["project"]["competitors"] }) {
  return (
    <div className="mt-2 space-y-2 border-l-2 border-muted pl-3 text-xs">
      <p className="font-mono text-muted-foreground tabular-nums">
        {formatLatency(answer.latencyMs)} · {formatEur(answer.costEstimate * USD_TO_EUR, true)}
      </p>
      {answer.error ? <p className="font-mono break-words text-destructive">{answer.error}</p> : null}
      {answer.sources.length ? (
        <ol className="space-y-0.5">
          {answer.sources.map((s, i) => {
            const owner = sourceOwner(s, brandDomains, competitors);
            const exact = answer.urlCited && answer.urlRank === i + 1;
            return (
              <li key={`${s.url}-${i}`} className="flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-right font-mono text-muted-foreground tabular-nums">{i + 1}</span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.url} className={cn("group/src flex min-w-0 items-center gap-1 hover:underline underline-offset-4", exact && "font-medium text-signal")}>
                  <span className="truncate">{s.domain}</span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 group-hover/src:opacity-100" />
                </a>
                {owner ? <OwnerBadge owner={owner} /> : null}
              </li>
            );
          })}
        </ol>
      ) : !answer.error ? (
        <p className="text-muted-foreground">Aucune source renvoyée.</p>
      ) : null}
      {answer.rawText ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">Réponse brute</summary>
          <p className="mt-1 max-h-72 overflow-y-auto leading-relaxed whitespace-pre-wrap text-foreground">{answer.rawText}</p>
        </details>
      ) : null}
    </div>
  );
}
