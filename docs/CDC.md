# CDC, GEO Monitor, Minimum Lovable Product

Version 0.1, 6 septembre 2026.

## 1. Vision

Un outil interne qui mesure, chaque jour, si un site (Rablab en premier) est cité ou mentionné par les assistants IA (ChatGPT, Claude, Perplexity) sur une liste de requêtes cibles, et qui montre l'évolution dans le temps face aux concurrents.

Équivalent maison du module "Monitor" de Qwairy. On construit tout nous-mêmes, sans SaaS GEO tiers. Les seules API consommées sont celles des fournisseurs de modèles, indispensables pour obtenir les réponses.

Ce qui rend le produit "lovable" plutôt que "viable" : un dashboard lisible en 10 secondes, le détail de chaque réponse brute à un clic, un compteur de coût honnête, et zéro maintenance une fois le cron en place.

## 2. Périmètre

### Dans le MLP

- Un projet = une marque, ses domaines, ses alias, ses concurrents.
- Gestion des prompts cibles (CRUD, tags, langue, import CSV).
- Trois moteurs : ChatGPT (OpenAI, avec recherche web), Claude (Anthropic, avec recherche web), Perplexity (sources natives).
- Deux modes par prompt : avec recherche web (mesure la citation) et sans (mesure la notoriété "dans le modèle").
- Exécution manuelle ("Lancer maintenant") et planifiée (quotidienne).
- Détection automatique : citation (domaine présent dans les sources), mention (marque ou alias dans le texte), rang d'apparition, idem pour chaque concurrent.
- Dashboard : score de visibilité, évolution 30 jours, ventilation par moteur, top des domaines cités, tableau prompts × moteurs.
- Historique des runs avec statut, durée, coût estimé, erreurs.
- Vue détail d'une réponse : texte brut, sources, surlignage des mentions.
- Stockage intégral des réponses brutes (audit, recalcul des métriques si on change les règles de détection).
- Authentification mono-utilisateur simple (mot de passe via variable d'environnement).

### Hors MLP (backlog)

- Suivi des interfaces grand public (scraping de ChatGPT web, AI Overview, Copilot).
- Détection des crawlers IA dans les logs serveur.
- Analyse de sentiment, résumé de "comment l'IA décrit la marque".
- Génération de briefs de contenu.
- Gemini, Grok, Mistral, DeepSeek (ajout trivial une fois l'abstraction moteur en place).
- Alertes email, digest hebdo.
- Multi-utilisateurs, multi-projets avec droits, marque blanche.
- Intégration Google Search Console et GA4.

## 3. Concepts et modèle de données

| Table | Champs principaux | Notes |
|---|---|---|
| `projects` | id, name, brand_name, aliases[], domains[], locale, created_at | Un seul projet au départ, la table existe pour éviter une migration douloureuse |
| `competitors` | id, project_id, name, aliases[], domains[] | Même logique de détection que la marque |
| `prompts` | id, project_id, text, lang, tags[], web_search (bool), active, created_at | Un prompt est immuable, on désactive au lieu de modifier pour garder l'historique cohérent |
| `engines` | id, provider, model, label, enabled, config (json) | Ex. `openai / gpt-5 / ChatGPT`, `anthropic / claude-opus-5 / Claude` |
| `runs` | id, project_id, trigger (manual, cron), status, started_at, finished_at, cost_estimate, error | Une exécution complète de tous les prompts actifs sur tous les moteurs actifs |
| `results` | id, run_id, prompt_id, engine_id, repeat_index, raw_text, sources (json), usage (json), cost_estimate, latency_ms, error, created_at | Une réponse brute, jamais modifiée |
| `detections` | id, result_id, entity_type (brand, competitor), entity_id, cited (bool), mentioned (bool), citation_rank, mention_rank, matched_terms[] | Recalculable à partir de `results` |

Métriques dérivées (calculées en SQL, pas stockées) :

- Taux de citation = résultats où `cited` / résultats sans erreur, par période, par moteur, par tag.
- Taux de mention, même formule.
- Share of voice = citations de la marque / (citations marque + concurrents).
- Rang moyen quand cité.

## 4. Règles de détection

- Domaines normalisés : minuscules, sans `www.`, sous-domaines inclus (`blog.gatto.city` compte pour `gatto.city`).
- Mention : recherche insensible à la casse et aux accents sur le nom de marque et ses alias, avec frontières de mot. `Gatto` seul ne matche pas si l'alias n'est pas déclaré.
- Rang de citation = position du domaine dans la liste des sources retournées par le moteur.
- Rang de mention = ordre de première apparition dans le texte, comparé aux concurrents.
- Une réponse en erreur (rate limit, timeout) est stockée avec `error` et exclue des taux.

## 5. Moteurs

Abstraction unique : `runPrompt(engine, prompt) -> { text, sources[], usage, cost }`.

| Moteur | Implémentation | Sources |
|---|---|---|
| ChatGPT | OpenAI Responses API, outil de recherche web activé quand `web_search = true` | Annotations URL de la réponse |
| Claude | Messages API, outil serveur `web_search_20260209`, modèle `claude-opus-5` par défaut, `user_location` = France | Blocs `web_search_result` et citations des blocs texte |
| Perplexity | Modèle sonar via API | Champ `citations` natif |

Paramètres communs : localisation France, langue du prompt, prompt système minimal et identique partout ("Tu es un assistant. Réponds à la question."), pas d'instruction qui pousserait à citer.

On passe par le Vercel AI SDK pour uniformiser les appels et la récupération des sources. Si un fournisseur pose problème via l'AI SDK, on bascule sur son SDK officiel pour ce moteur uniquement.

## 6. Tâches récurrentes (décision)

**Choix : Vercel Cron + Vercel Workflow.**

- `vercel.json` déclare un cron quotidien (07:00 Europe/Paris) qui appelle `/api/cron/daily`, protégé par `CRON_SECRET`.
- Cette route crée un `run` en base et démarre un workflow durable.
- Le workflow itère sur prompts × moteurs × répétitions, chaque appel étant une étape avec retry automatique (3 tentatives, backoff exponentiel) et une concurrence limitée par fournisseur (3 en parallèle max) pour respecter les rate limits.
- Le run passe en `done` ou `failed` à la fin, avec le coût agrégé.
- Le bouton "Lancer maintenant" appelle la même logique avec `trigger = manual`.

Pourquoi : un run complet dure plusieurs minutes, ce qu'une fonction serverless classique ne tient pas. Workflow apporte la durabilité et les reprises sans qu'on écrive une file d'attente. Pas d'infra supplémentaire à surveiller.

Plan de repli si on héberge ailleurs qu'en Vercel : même code métier, exécuté par un worker Node dans le Dockerfile avec `node-cron`. L'abstraction `executeRun(runId)` ne doit dépendre ni de Vercel ni du cron.

## 7. Écrans

1. **Dashboard** (page d'accueil). Quatre tuiles : taux de citation, taux de mention, share of voice, coût du mois. Courbe 30 jours (citation par moteur). Tableau prompts × moteurs avec pastille cité / mentionné / rien pour le dernier run. Top 10 des domaines cités sur la période.
2. **Prompts**. Liste filtrable par tag, langue, statut. Ajout, import CSV, activation. Colonne "taux de citation 30 j" par prompt.
3. **Runs**. Historique avec statut, durée, nombre de résultats, erreurs, coût. Bouton "Lancer maintenant".
4. **Détail d'un résultat** (drawer ouvert depuis le dashboard ou un run). Texte brut, sources cliquables, mentions surlignées en couleur par entité, métadonnées (modèle, latence, tokens, coût).
5. **Paramètres**. Marque, alias, domaines, concurrents, moteurs actifs et modèles, nombre de répétitions, heure du cron.

Composants shadcn attendus : Card, Table, Badge, Sheet (drawer), Tabs, Dialog, Form, Select, Chart (Recharts via shadcn charts), Toast.

## 8. Stack technique

- Next.js 16 (App Router), TypeScript, pnpm.
- Tailwind CSS v4 + shadcn/ui.
- Postgres (Neon via Vercel Marketplace, ou l'instance existante) + Drizzle ORM.
- Vercel AI SDK + `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/perplexity`.
- Vercel Workflow pour l'exécution des runs, Vercel Cron pour le déclenchement.
- Vitest pour les règles de détection (tests unitaires obligatoires sur ce module, c'est le cœur de la fiabilité).
- Variables d'environnement : `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY`, `DATABASE_URL`, `CRON_SECRET`, `APP_PASSWORD`.

## 9. Exigences non fonctionnelles

- Un run ne dépasse jamais un plafond de coût configurable (défaut 5 € par run) : au-delà, il s'arrête proprement en `failed` avec le motif.
- Idempotence : relancer un run partiellement échoué ne recrée pas les résultats déjà obtenus.
- Toutes les réponses brutes sont conservées sans limite de durée.
- Les clés API ne transitent jamais côté client.
- Page dashboard sous 1 s avec 90 jours d'historique (index sur `results(run_id, prompt_id, engine_id)` et `runs(started_at)`).

## 10. Volume et coût (mesuré le 6 septembre 2026)

Coûts réels observés par réponse, recherche web incluse :

| Moteur | Coût par réponse avec recherche | Sans recherche |
|---|---|---|
| ChatGPT gpt-5.5 | 0,10 à 0,14 USD | 0,006 USD |
| ChatGPT gpt-5.4-mini | 0,02 USD | 0,003 USD |

Le poste principal est le contenu des pages ramené par l'outil de recherche (5 000 à 15 000 tokens d'entrée par réponse), facturé au tarif du modèle. D'où le choix de gpt-5.4-mini par défaut pour ChatGPT.

Configuration de départ :

| Paramètre | Valeur |
|---|---|
| Prompts actifs | 22 (19 avec recherche web, 3 en mode mémoire) |
| Moteurs | ChatGPT seul pour l'instant (Claude et Perplexity dès que les clés sont là) |
| Répétitions par jour | 1 |
| Coût mesuré par run complet, ChatGPT mini | 0,43 USD |
| Coût mensuel estimé, ChatGPT mini, un run par jour | 12 € |

Ajouter Claude Opus 5 (5 USD / 25 USD par million de tokens, 0,01 USD par recherche) coûterait environ 0,08 USD par réponse, soit 45 € par mois de plus. Claude Sonnet 5 ou Perplexity sonar sont à 0,02 à 0,03 USD par réponse. Le plafond de coût par run est fixé à 3 € par défaut.

## 11. Jalons

1. **Socle** : schéma Drizzle, migrations, abstraction moteur, les 3 moteurs fonctionnels via un script CLI `pnpm run:once`, tests de détection.
2. **Runs et prompts** : pages Prompts et Runs, exécution manuelle via Workflow, drawer de détail.
3. **Dashboard** : métriques SQL, tuiles, courbe, tableau prompts × moteurs, top domaines.
4. **Automatisation** : Vercel Cron, plafond de coût, idempotence, reprise sur erreur.
5. **Finition lovable** : états vides guidés, import CSV, page Paramètres complète, compteur de coût, déploiement production.

Chaque jalon est livrable et testable seul. On ne passe au suivant qu'après une démo du précédent.

## 12. Hypothèses à confirmer

- "Pas d'API externe" signifie pas de SaaS GEO tiers. Les API OpenAI, Anthropic et Perplexity sont bien utilisées.
- Hébergement Vercel (sinon activer le plan de repli du point 6).
- Projet initial : Rablab (agence de marketing web, Montréal), concurrents Digitad, Adviso et My Little Big Web, prompts en français et en anglais, localisation Canada.
- Nom de code du dépôt : `geo-monitor`.

## 13. Décisions d'implémentation (jalon 1, 6 septembre 2026)

- **Base locale** : PGlite (Postgres embarqué, dossier `.data/pglite`) quand `DATABASE_URL` est vide, migrations appliquées au démarrage. Même schéma Drizzle en production sur Postgres.
- **Moteur mock** : fournisseur `mock` activé uniquement avec `GEO_MOCK_ENGINE=1` hors production, pour tester le pipeline complet (workflow, détection, dashboard) sans clés API.
- **Modèles par défaut** : `gpt-5.5` (ChatGPT), `claude-opus-5` (Claude), `sonar` (Perplexity). Modifiables par moteur dans Paramètres.
- **Perplexity** cherche toujours sur le web : les prompts en mode "mémoire seule" ne lui sont pas envoyés.
- **Nouvelles tentatives** : 3 essais avec backoff dans l'appel moteur sur 429, 5xx et erreurs réseau, puis le résultat est stocké avec `error`. L'étape de workflow reste idempotente grâce à l'index unique (run, prompt, moteur, répétition).
- **Authentification** : mot de passe unique `APP_PASSWORD`, cookie dérivé par hachage, vérifié dans `src/proxy.ts`. Le cron et les routes internes Workflow sont exclus.
- **Coût** : estimé côté serveur à partir des tokens et du nombre de recherches, avec des tarifs indicatifs modifiables par moteur. Affiché en euros (taux fixe 0,92).

## 14. Première mesure Rablab (6 septembre 2026, ChatGPT gpt-5.4-mini)

| Indicateur | Valeur |
|---|---|
| Réponses analysées | 22 |
| Taux de citation | 14 % (3 réponses) |
| Taux de mention | 23 % (5 réponses) |
| Share of voice | 27 % |

Rablab est cité sur les prompts "audit technique SEO et migration", "formation SEO au Québec" (via la Rabacadémie) et "Google Partners in Montreal", mentionné en plus sur "agences de marketing web à Montréal" et "top SEO agencies in Quebec for e-commerce". Absent des prompts généralistes "meilleure agence SEO à Montréal" et de tous les prompts en mode mémoire. Digitad est le concurrent le plus visible (domaine cité 6 fois). Les sources dominantes sont clutch.co et bcorporation.net.
