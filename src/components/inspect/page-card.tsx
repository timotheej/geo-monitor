import { APP_TIMEZONE } from "@/lib/format";
import type { PageSnapshot } from "@/db/schema";
import { formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Section, Fact } from "./section";

function orDash(v: string | null | undefined) {
  return v ? v : <span className="text-muted-foreground/60">-</span>;
}

function formatPublished(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE, day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function PageCard({ page }: { page: PageSnapshot | null }) {
  if (!page || page.fetchError) {
    return (
      <Section title="Fiche de la page" description="Ce que notre serveur a pu lire dans le HTML brut.">
        <p className="text-sm text-muted-foreground">Aucune donnée : la page n&apos;a pas pu être récupérée.</p>
      </Section>
    );
  }
  return (
    <Section title="Fiche de la page" description="Ce que notre serveur a pu lire dans le HTML brut, sans JavaScript.">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label="Titre" mono={false}>
          {orDash(page.title)}
        </Fact>
        <Fact label="H1" mono={false}>
          {orDash(page.h1)}
        </Fact>
        <div className="sm:col-span-2">
          <Fact label="Meta description" mono={false}>
            {orDash(page.description)}
          </Fact>
        </div>
      </dl>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-4">
        <Fact label="Langue">{orDash(page.lang)}</Fact>
        <Fact label="Mots">{formatInt(page.wordCount)}</Fact>
        <Fact label="Publiée le" mono={false}>
          {orDash(formatPublished(page.publishedAt))}
        </Fact>
        <Fact label="Sous-titres (H2)">{page.h2.length}</Fact>
      </dl>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Fact label="Canonical">
          {page.canonical ? (
            <a href={page.canonical} target="_blank" rel="noopener noreferrer" className="text-xs break-all hover:underline underline-offset-4">
              {page.canonical}
            </a>
          ) : (
            <span className="text-muted-foreground/60">aucune</span>
          )}
        </Fact>
        <Fact label="Meta robots">{page.robotsMeta ? page.robotsMeta : <span className="text-muted-foreground/60">aucune</span>}</Fact>
        <div className="sm:col-span-2">
          <Fact label="Données structurées (JSON-LD)" mono={false}>
            {page.jsonLdTypes.length ? (
              <span className="flex flex-wrap gap-1">
                {page.jsonLdTypes.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono font-normal">
                    {t}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground/60">aucune</span>
            )}
          </Fact>
        </div>
      </dl>
      {page.h2.length ? (
        <details className="group text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">Voir les sous-titres</summary>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {page.h2.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}
