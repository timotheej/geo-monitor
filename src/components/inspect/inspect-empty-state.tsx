import { FileSearch, MessagesSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function Step({ n, icon: Icon, title, cost, children }: { n: number; icon: typeof FileSearch; title: string; cost: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-signal/15 font-mono text-xs text-signal tabular-nums">{n}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{cost}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

export function InspectEmptyState() {
  return (
    <Card>
      <CardContent className="py-2">
        <h2 className="text-lg font-medium tracking-tight">Aucune inspection pour l&apos;instant</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Collez l&apos;URL d&apos;une page au-dessus. Le rapport se construit en deux temps, séparés par votre validation, pour ne jamais payer des appels sur des questions que personne n&apos;a relues.
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Step n={1} icon={FileSearch} title="Analyse de la page" cost="gratuit">
            Lecture de la page depuis notre serveur, contrôle de robots.txt pour chaque robot IA (OpenAI, Anthropic, Perplexity, Google), fiche technique et proposition de 3 à 5 questions naturelles auxquelles la page répond.
          </Step>
          <Step n={2} icon={MessagesSquare} title="Test sur les moteurs" cost="quelques centimes">
            Après relecture des questions et choix des moteurs, chaque question est posée avec recherche web. Le rapport indique si l&apos;URL est citée, si une autre page du site l&apos;est, ou quels domaines sont cités à la place.
          </Step>
        </div>
      </CardContent>
    </Card>
  );
}
