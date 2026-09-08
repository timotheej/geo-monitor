# Dashboard v2 : spécification UX

Objectif : répondre, dans l'ordre, aux questions d'un SEO manager qui suit une marque dans les réponses IA. Chaque écran répond à une question. Toutes les vues sont filtrées par la période choisie dans l'en-tête (7, 30, 90 jours) et par le projet courant.

Moteurs et identité visuelle : chaque moteur a un logo et une couleur stable partout (cartes, courbes, pastilles, badges). Fournisseurs : `openai` (ChatGPT), `anthropic` (Claude), `perplexity` (Perplexity), `google` (Gemini, en cours d'ajout), `mock` (tests, ne pas afficher de logo). Logos en SVG monochrome embarqués dans le dépôt (`src/components/engines/engine-logo.tsx`), pas de dépendance ni d'image distante.

## 1. Vue d'ensemble (`/`) : "on est visible, et ça bouge dans quel sens ?"

- **Cartes moteur**, une par moteur activé, côte à côte : logo, nom, modèle en petit, taux de citation, taux de mention, variation en points vs période précédente (flèche verte ou rouge), nombre de réponses, coût sur la période. Moteur sans clé : carte atténuée avec "clé API absente".
- **Synthèse marque** au-dessus : score global de citation, mention, share of voice, coût du mois (déjà existant, à garder compact).
- **Tendance** : courbe par moteur du taux de citation, par jour, avec sélecteur citation ou mention. Si moins de 3 jours de données, afficher un état vide honnête : "La tendance apparaît après quelques runs".
- **Share of voice** : barres horizontales marque + concurrents, citation et mention, tri décroissant.
- **Sources qui dominent** : top domaines cités (existant), avec badge marque ou concurrent.
- **Opportunités rapides** : 5 prompts où un concurrent est cité et pas nous, avec lien vers la fiche prompt.

## 2. Moteurs (`/engines`) : "les IA se comportent-elles pareil ?"

- **Matrice moteur × thème** : lignes = tags des prompts, colonnes = moteurs, cellule = taux de citation avec couleur graduée (0 % gris clair, 100 % couleur du moteur), nombre de réponses en survol.
- **Sources par moteur** : pour chaque moteur, ses 8 domaines les plus cités, pour voir les différences ("ChatGPT s'appuie sur Clutch, Claude sur les blogs d'agences").
- **Chiffres clés par moteur** : latence médiane, coût moyen par réponse, nombre moyen de sources, part de réponses avec au moins une source.

## 3. Thèmes et prompts (`/prompts`) : "où on gagne, où on perd ?"

- La page Prompts actuelle (gestion) reste, mais s'ouvre sur une **vue par thème** : un bloc par tag avec taux de citation et mention, nombre de prompts, mini-barres par moteur. Onglet "Gestion" pour la liste actuelle (ajout, import, activation).
- **Fiche prompt** (`/prompts/[id]`) : texte, tags, mode, puis historique par moteur (pastilles cité / mentionné / rien par run, chronologique), et la liste des réponses avec ouverture du drawer existant (`?result=`). Les concurrents cités sur ce prompt.

## 4. Concurrents (`/competitors`) : "qui prend notre place ?"

- Classement : marque et concurrents, taux de citation, mention, variation, nombre de prompts où ils apparaissent.
- Courbe share of voice dans le temps (citation).
- Pour chaque concurrent : les prompts où il est cité et pas nous (recouvrement), et ses pages les plus citées (URL complètes depuis les sources).

## 5. Sources et opportunités (`/sources`) : "qu'est-ce que je fais lundi ?"

- **Domaines cités à notre place** : domaine, nombre de réponses, présent ou absent pour nous (une de nos pages y est-elle jamais citée ?), moteurs concernés. Ce sont les sites où obtenir une mention ou une fiche.
- **Nos pages citées** : URL de la marque apparues dans les sources, nombre de citations, prompts, moteurs. Lien vers "Inspecter cette URL".
- **Prompts sans nous** : prompts jamais cités sur la période, tri par nombre de concurrents cités.

## Navigation

Barre latérale : Vue d'ensemble, Moteurs, Thèmes et prompts, Concurrents, Sources, Runs, Inspecter, Paramètres. Sélecteur de projet dans l'en-tête (un seul projet aujourd'hui, le composant doit exister). Le bouton "Lancer un run" reste dans l'en-tête.

## Données

Les requêtes existantes (`src/lib/queries.ts`) couvrent l'aperçu, la série temporelle, la matrice prompts × moteurs, le top domaines. Les nouvelles requêtes vont dans `src/lib/dashboard-queries.ts`, en SQL Drizzle, scoping par projet et période, taux en 0..1, et chacune testée dans `src/lib/dashboard-queries.test.ts` avec PGlite en mémoire (modèle : `src/lib/inspect/queries.test.ts`). Attention : comparer les dates avec `gte` et `lt` de Drizzle, jamais dans un fragment `sql` brut (postgres-js refuse les Date en paramètre brut).

## Règles

Mode clair uniquement. Aucun tiret long ni demi-cadratin dans les textes. Composants shadcn existants. Chiffres en Geist Mono. États vides guidés partout. Pages authentifiées dynamiques (le layout `(app)` l'impose déjà).
