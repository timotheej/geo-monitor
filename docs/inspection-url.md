# Inspection d'URL : analyse d'ingénierie

Version 0.1, 6 septembre 2026. Objectif : coller une URL et obtenir un rapport sur son accessibilité aux moteurs IA et sur sa citation effective, à la manière de l'inspection d'URL de la Search Console. Cette note fixe le périmètre, les garde-fous de coût et les effets de bord avant toute ligne de code.

## 1. Flux en deux temps

Le rapport se construit en deux étapes séparées par une validation humaine. C'est la première mesure d'économie : on ne lance jamais d'appels payants sur des questions que personne n'a relues.

**Étape A, gratuite (moins de 0,01 USD)**

1. Validation de l'URL et récupération de la page côté serveur.
2. Contrôles d'accès : robots.txt de l'origine (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended), meta robots, canonical, code HTTP, temps de réponse, présence de llms.txt.
3. Extraction : titre, H1, meta description, H2, langue, date de publication, types JSON-LD, nombre de mots, soupçon de rendu JavaScript (HTML sans contenu textuel).
4. Génération de 3 à 5 questions naturelles auxquelles la page répond, par un appel LLM sans recherche web, sortie structurée.
5. Affichage immédiat : accessibilité, fiche de la page, questions éditables, choix des moteurs, coût estimé.

**Étape B, payante, sur clic explicite**

6. Exécution des questions sur les moteurs choisis avec recherche web, dans un workflow durable.
7. Détection : URL exacte citée, autre page du domaine citée, concurrent cité, rien. Rang dans les sources.
8. Verdict par question et par moteur, liste des domaines cités à la place, historique des apparitions de l'URL dans les runs quotidiens.

## 2. Coûts

### Ordres de grandeur par inspection (5 questions)

| Moteurs | Coût étape B |
|---|---|
| ChatGPT gpt-5.4-mini seul (défaut) | 0,10 USD |
| + Perplexity sonar | 0,20 USD |
| + Claude Opus 5 | 0,60 USD |
| + Claude Sonnet 5 à la place d'Opus | 0,30 USD |

Étape A : environ 1 500 tokens en entrée et 300 en sortie sur le moteur le moins cher disponible, soit 0,002 USD.

### Garde-fous

1. **Défauts frugaux** : 5 questions maximum, ChatGPT mini seul coché par défaut, les autres moteurs à activer volontairement.
2. **Estimation avant lancement** : coût calculé à partir de la moyenne réelle par réponse de chaque moteur dans la table `results` (on a déjà ces données), pas d'un tarif théorique.
3. **Plafond par inspection** : 0,50 USD par défaut, réglable dans Paramètres, vérifié entre chaque lot du workflow comme pour les runs.
4. **Plafond quotidien** : 20 inspections par projet et par jour. Au-delà, refus explicite. Évite le clic compulsif et les boucles.
5. **Une inspection à la fois** par projet : tant qu'une inspection est en cours, le bouton est désactivé. Limite aussi la pression sur les rate limits.
6. **Cache de l'étape A** : page et questions conservées 7 jours par empreinte de contenu. Réinspecter la même URL réutilise les mêmes questions, ce qui rend les mesures comparables dans le temps et ne régénère rien.
7. **Anti-doublon** : une URL inspectée il y a moins d'une heure affiche le rapport existant, la relance demande une confirmation.
8. **Entrée réduite** pour la génération de questions : titre, description, H1, H2 et les 1 500 premiers caractères du texte, jamais la page entière. Sortie limitée à 300 tokens.
9. **Réponses jamais mises en cache** : c'est la mesure elle-même, elle doit être fraîche.

## 3. Effets de bord et risques

### Sécurité : SSRF

Le serveur récupère une URL fournie par l'utilisateur. Même derrière l'authentification, il faut :

- n'accepter que http et https ;
- résoudre le nom et refuser les adresses privées, de bouclage, lien-local et les métadonnées cloud (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7), y compris après chaque redirection (5 maximum) ;
- délai de 10 secondes, corps limité à 2 Mo, uniquement `text/html`, aucun envoi de cookie ni d'en-tête d'authentification ;
- user agent explicite `GEO-Monitor/1.0`.

### Pollution des métriques

Les réponses d'inspection ne doivent pas entrer dans la table `results` : elles fausseraient les taux de citation quotidiens et la matrice prompts × moteurs. Elles vont dans des tables dédiées (`inspections`, `inspection_answers`). En revanche, leur coût doit rebondir dans la tuile "Coût du mois", sinon le compteur ment. La tuile affichera runs + inspections, avec le détail au survol.

### Biais des questions générées

Une question calquée sur l'article (sa formulation unique, le nom de l'agence) donne une citation artificielle. Deux parades : la consigne de génération impose des questions qu'un internaute poserait sans connaître l'article, sans nommer la marque ni le site ; et une validation automatique rejette toute question contenant un terme de la marque ou un domaine suivi, en réutilisant le module de détection. La relecture humaine de l'étape A fait le reste.

### Bruit statistique

Une réponse par question est un instantané, pas une tendance. Le rapport le dit en toutes lettres et propose deux suites : relancer l'inspection plus tard (comparaison grâce aux questions figées), ou ajouter les questions aux prompts suivis pour les mesurer chaque jour.

### Interférence avec le run quotidien

Mêmes clés, mêmes rate limits. Le cron tourne à 06:00 UTC, les inspections en journée, le recouvrement est rare. Le garde-fou "une inspection à la fois" et les nouvelles tentatives existantes suffisent. Si un jour ça coince, on sérialise inspections et runs dans le workflow.

### Interprétation de robots.txt

Les règles avec jokers et la priorité au chemin le plus long sont faciles à rater à la main : on utilise une bibliothèque (`robots-parser`). Résultat mis en cache 24 heures par hôte. Limite à afficher : un pare-feu ou un CDN peut bloquer les robots IA sans que robots.txt le montre, on ne peut pas le voir de l'extérieur.

### Pages rendues en JavaScript et blocage de notre propre requête

Si le HTML brut n'a pas de contenu textuel, le rapport signale "contenu non visible sans JavaScript" au lieu d'échouer, c'est en soi un diagnostic utile. Si le site renvoie 403 à notre user agent, le rapport indique "page non récupérable depuis notre serveur" et permet de saisir les questions à la main pour lancer l'étape B quand même.

### Exécution longue

L'étape B dure 15 à 60 secondes. Elle passe par un workflow durable, pas par une server action bloquante : pas de timeout de fonction, reprises automatiques, et l'interface se rafraîchit toutes les 3 secondes comme la page des runs.

### Données

Réponses brutes conservées, quelques kilo-octets par réponse, sans enjeu de volume. Suppression en cascade avec le projet.

## 4. Modèle de données

```
inspections
  id, project_id, url, normalized_url, content_hash,
  status (draft | running | done | failed),
  page (json : finalUrl, httpStatus, responseMs, title, h1, description, h2[],
        lang, wordCount, publishedAt, canonical, robotsMeta, jsonLdTypes, jsSuspect),
  access (json : robots par agent, llmsTxt, checkedAt),
  questions (json : [{ text, lang, source: generated | manual }]),
  engine_ids (json), cost_estimate, error, created_at, finished_at

inspection_answers
  id, inspection_id, question_index, engine_id,
  raw_text, sources (json), usage (json), cost_estimate, latency_ms, error,
  url_cited, url_rank, domain_cited, domain_rank, created_at
```

Normalisation d'URL, partagée avec l'historique : minuscules sur l'hôte, suppression de `www.`, du fragment, du slash final, des paramètres de suivi (`utm_*`, `ref`, `fbclid`, `gclid`), http et https confondus. Les sources déjà stockées portent `?utm_source=openai`, la normalisation est indispensable.

## 5. Découpage

1. Normalisation d'URL, garde SSRF, évaluation robots.txt : fonctions pures, tests unitaires.
2. Récupération et extraction de page avec limites, tests sur des fixtures HTML.
3. Génération de questions avec sortie structurée et validation anti-marque.
4. Schéma, migration, workflow d'inspection, plafonds.
5. Interface : page "Inspecter", rapport, liste des inspections, tuile de coût mise à jour.
6. Historique de l'URL dans les runs quotidiens.

Dépendances ajoutées : `cheerio` (extraction HTML) et `robots-parser`. Rien d'autre.

## 6. Ce que le rapport ne dira pas

Pourquoi le moteur a préféré une autre source. On voit le résultat, les concurrents cités et l'état d'accessibilité de la page, pas le raisonnement du modèle. Comme la Search Console, qui montre l'indexation et la position, pas l'algorithme.
