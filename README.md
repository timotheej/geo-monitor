# GEO Monitor

Outil interne qui mesure chaque jour si un site est cité ou mentionné par ChatGPT, Claude et Perplexity sur une liste de prompts cibles, et suit l'évolution face aux concurrents. Cahier des charges : `docs/CDC.md`.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind v4 + shadcn/ui, Postgres + Drizzle (PGlite embarqué en local), Vercel AI SDK, Vercel Workflow pour les runs durables, Vercel Cron pour le déclenchement quotidien, Vitest.

## Démarrage

```bash
pnpm install
cp .env.example .env.local   # renseigner au moins une clé API et APP_PASSWORD
pnpm seed                    # projet Rablab, concurrents, moteurs, 22 prompts
pnpm dev
```

Sans `DATABASE_URL`, la base est un Postgres embarqué dans `.data/pglite`, migré automatiquement au démarrage.

## Scripts

| Commande | Rôle |
|---|---|
| `pnpm run:once --prompt "..." [--engine anthropic] [--no-search]` | Teste un prompt sur les moteurs, sans base, affiche réponse, sources, coût et détection |
| `pnpm run:full` | Run complet séquentiel en ligne de commande (sans workflow) |
| `pnpm inspect --url <url> [--launch] [--engine openai] [--force]` | Inspection d'une URL : étape A gratuite (accès des robots IA, fiche de la page, questions), `--launch` pour l'étape B payante |
| `pnpm stats` | Résumé chiffré du projet |
| `pnpm seed` | Données initiales, idempotent |
| `pnpm test` | Tests unitaires (règles de détection) |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | Qualité |
| `pnpm db:generate` | Génère une migration après modification de `src/db/schema.ts` |
| `pnpm db:migrate` | Applique les migrations sur `DATABASE_URL` (production) |

L'inspection d'URL (page "Inspecter") suit l'analyse de `docs/inspection-url.md` : étape A gratuite, étape B sur clic explicite avec plafonds de coût.

Un run manuel depuis l'UI ou via `POST /api/runs` avec `{ "projectId": "..." }` passe par le workflow durable. Le cron quotidien appelle `GET /api/cron/daily` avec `Authorization: Bearer $CRON_SECRET`.

## Tester sans clés API

```bash
GEO_MOCK_ENGINE=1 pnpm seed   # ajoute un moteur "Mock (test)"
GEO_MOCK_ENGINE=1 pnpm dev    # les runs utilisent des réponses simulées
```

Le moteur mock est ignoré en production quoi qu'il arrive.

## Déploiement Vercel

1. Créer une base Postgres (Neon via le Marketplace) et renseigner `DATABASE_URL`.
2. Renseigner `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `CRON_SECRET`, `APP_PASSWORD`.
3. `pnpm db:migrate` puis `pnpm seed` contre la base de production (une fois).
4. Déployer : `vercel.json` déclare le cron quotidien à 06:00 UTC. Vercel ajoute automatiquement l'en-tête `Authorization` avec `CRON_SECRET`.

## Structure

```
src/db/            schéma Drizzle et client (PGlite local, postgres-js en prod)
src/lib/detection  règles de citation et de mention, testées
src/lib/engines    appel uniforme des fournisseurs via l'AI SDK
src/lib/runs       planification, exécution idempotente d'une tâche, détections
src/lib/queries    requêtes du dashboard
src/lib/actions    server actions (prompts, projet, concurrents, moteurs, auth)
src/lib/inspect    inspection d'URL : normalisation, garde SSRF, robots.txt, extraction, questions, service, workflow
src/workflows      orchestration durable (lots de 3, plafond de coût)
src/app/api        POST /api/runs, GET /api/cron/daily
scripts/           seed, run:once, run:full
```
