import Link from "next/link";
import type { EngineCard as EngineCardRow } from "@/lib/dashboard-queries";
import type { EngineKeyStatus } from "@/lib/ui-queries";
import { formatEur, formatInt } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { EngineMark, engineColor } from "@/components/engines/engine-logo";
import { RateDelta, RateValue } from "@/components/dashboard/rate";
import { EmptyCard } from "@/components/empty-card";
import { cn } from "@/lib/utils";

function EngineCard({ card, hasKey }: { card: EngineCardRow; hasKey: boolean }) {
  const color = engineColor(card.provider);
  return (
    <article
      className={cn("relative flex flex-col gap-4 overflow-hidden rounded-xl bg-card p-4 ring-1 ring-foreground/10", !hasKey && "opacity-60")}
      aria-label={card.label}
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: color }} />
      <header className="flex items-center gap-3">
        <EngineMark provider={card.provider} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{card.label}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{card.model}</p>
        </div>
        {!hasKey ? (
          <Badge variant="outline" className="text-muted-foreground">
            clé API absente
          </Badge>
        ) : null}
      </header>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Citation</dt>
          <dd className="flex items-baseline gap-2">
            <RateValue value={card.citationRate} className="text-2xl tracking-tight" />
            <RateDelta points={card.citationDelta} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Mention</dt>
          <dd className="flex items-baseline gap-2">
            <RateValue value={card.mentionRate} accent="none" className="text-2xl tracking-tight" />
            <RateDelta points={card.mentionDelta} />
          </dd>
        </div>
      </dl>
      <footer className="mt-auto flex items-center justify-between font-mono text-xs text-muted-foreground tabular-nums">
        <span>
          {formatInt(card.answers)} réponse{card.answers > 1 ? "s" : ""}
        </span>
        <span>{formatEur(card.costEur)}</span>
      </footer>
    </article>
  );
}

export function EngineCards({ cards, keys }: { cards: EngineCardRow[]; keys: EngineKeyStatus[] }) {
  const keyById = new Map(keys.map((k) => [k.id, k.hasKey]));
  const enabled = cards.filter((c) => c.enabled);
  if (enabled.length === 0) {
    return (
      <EmptyCard title="Aucun moteur activé" action={{ href: "/settings?tab=engines", label: "Activer un moteur" }}>
        Activez au moins un moteur dans les paramètres pour que les runs interrogent les assistants IA.
      </EmptyCard>
    );
  }
  return (
    <section aria-label="Moteurs" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Par moteur</h2>
        <Link href="/engines" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
          Comparer les moteurs
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {enabled.map((c) => (
          <EngineCard key={c.id} card={c} hasKey={keyById.get(c.id) ?? true} />
        ))}
      </div>
    </section>
  );
}
