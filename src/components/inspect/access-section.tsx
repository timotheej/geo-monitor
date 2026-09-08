import { AlertTriangle, Check, X } from "lucide-react";
import type { AccessSnapshot, PageSnapshot } from "@/db/schema";
import { formatLatency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Section, Fact } from "./section";

export function AccessSection({ page, access }: { page: PageSnapshot | null; access: AccessSnapshot | null }) {
  const blocked = access?.agents.filter((a) => !a.allowed).length ?? 0;
  const vendors = access ? Array.from(new Set(access.agents.map((a) => a.vendor))) : [];

  return (
    <Section
      title="Accessibilité aux IA"
      description={
        access
          ? blocked === 0
            ? "Tous les robots IA connus sont autorisés par robots.txt. Un pare-feu ou un CDN peut toutefois les bloquer sans que ce fichier le montre."
            : `${blocked} robot${blocked > 1 ? "s" : ""} IA bloqué${blocked > 1 ? "s" : ""} par robots.txt : la page ne peut pas être lue ni citée par ${blocked > 1 ? "ces moteurs" : "ce moteur"}.`
          : "Contrôle non effectué."
      }
    >
      {page?.fetchError ? (
        <Alert tone="destructive" title="Page non récupérable depuis notre serveur">
          {page.fetchError}. Le site refuse peut-être les robots inconnus. Les questions doivent être saisies à la main pour lancer le test.
        </Alert>
      ) : null}
      {page?.jsSuspect ? (
        <Alert tone="warning" title="Contenu non visible sans JavaScript">
          Le HTML brut ne contient presque aucun texte. Les robots IA lisent rarement le rendu JavaScript : le contenu leur est probablement invisible.
        </Alert>
      ) : null}

      {access ? (
        <div className="space-y-3">
          {vendors.map((vendor) => (
            <div key={vendor}>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{vendor}</div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {access.agents
                  .filter((a) => a.vendor === vendor)
                  .map((a) => (
                    <li key={a.agent} className={cn("flex items-center gap-2.5 rounded-lg border px-3 py-2", !a.allowed && "border-destructive/30 bg-destructive/5")}>
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", a.allowed ? "bg-signal/20 text-signal" : "bg-destructive/15 text-destructive")}>
                        {a.allowed ? <Check className="size-3" /> : <X className="size-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs">{a.agent}</span>
                        <span className="block truncate text-xs text-muted-foreground">{a.role}</span>
                      </span>
                      <span className={cn("shrink-0 text-[11px]", a.explicit ? "text-foreground" : "text-muted-foreground")}>{a.explicit ? "règle explicite" : "règle générale"}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <Fact label="robots.txt">{access ? (access.robotsFound ? "présent" : "absent") : "-"}</Fact>
        <Fact label="llms.txt">{access ? (access.llmsTxt ? "oui" : "non") : "-"}</Fact>
        <Fact label="Code HTTP">
          {page ? <span className={cn(page.httpStatus >= 200 && page.httpStatus < 300 ? "text-signal" : page.httpStatus ? "text-destructive" : "text-muted-foreground")}>{page.httpStatus || "-"}</span> : "-"}
        </Fact>
        <Fact label="Temps de réponse">{page?.responseMs ? formatLatency(page.responseMs) : "-"}</Fact>
        <Fact label="Redirections">{page ? page.redirects : "-"}</Fact>
        <Fact label="Meta robots">{page?.robotsMeta ? page.robotsMeta : "aucune"}</Fact>
      </dl>
    </Section>
  );
}

export function Alert({ tone, title, children }: { tone: "destructive" | "warning"; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", tone === "destructive" ? "border-destructive/30 bg-destructive/10" : "border-rival/40 bg-rival/10")}>
      <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", tone === "destructive" ? "text-destructive" : "text-rival")} />
      <div>
        <p className={cn("font-medium", tone === "destructive" ? "text-destructive" : "text-foreground")}>{title}</p>
        <p className={cn("mt-0.5", tone === "destructive" ? "text-destructive/90" : "text-muted-foreground")}>{children}</p>
      </div>
    </div>
  );
}
