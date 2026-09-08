# Indice de citabilité d'une page : spécification

Version 0.1, 8 septembre 2026. Objectif : donner à une page un indice lisible (0 à 100) qui dit où elle se situe face aux moteurs IA, et surtout expliquer pourquoi elle est citée ou non, avec des actions concrètes. Ce document fixe le raisonnement, la grille de points, les limites assumées et le plan de calibration sur nos propres données.

## 1. Ce qu'on sait vraiment de la citation par les moteurs IA

Avant de noter quoi que ce soit, il faut poser le mécanisme. Une réponse avec recherche web se fabrique en trois étapes, et une page peut échouer à chacune.

**Étape 1, la recherche.** Le modèle reformule la question en une à quatre requêtes de recherche, puis interroge un index classique (Google pour Gemini, Bing pour ChatGPT, un index propre pour Claude et Perplexity). Les candidats sont les premiers résultats de ces requêtes. Une page absente de ces résultats n'a aucune chance, quelle que soit sa qualité. C'est le point le plus important et le plus souvent oublié : la première porte de la citation par l'IA, c'est le référencement classique sur les requêtes que le modèle formule, qui ne sont pas exactement celles de l'utilisateur.

**Étape 2, la lecture.** Le moteur récupère le contenu des pages candidates avec son propre robot (OAI-SearchBot, Claude-SearchBot, Google) et en extrait le texte. Une page qui bloque ce robot, qui ne rend son contenu qu'en JavaScript, qui répond lentement ou qui interdit les extraits (`nosnippet`) est éliminée ici, silencieusement.

**Étape 3, la sélection.** Le modèle choisit, parmi les passages lus, ceux qui répondent directement, avec des faits attribuables, et il les cite. Les travaux publiés sur le sujet (l'étude GEO de Princeton en 2023, puis les analyses d'Ahrefs, Semrush et SE Ranking sur AI Overviews et ChatGPT en 2024 et 2025) convergent sur quelques constats : les passages qui contiennent des chiffres, des citations de sources et des affirmations précises gagnent 30 à 40 % de visibilité ; les pages fraîches sont favorisées ; pour les questions comparatives ("meilleure agence", "quel outil"), les comparatifs neutres, les annuaires et les plateformes d'avis dominent, pas les pages de vente ; les pages qui répondent dès le premier paragraphe sont plus reprises que celles qui font attendre.

**Ce que nos propres données confirment déjà.** Sur "meilleure agence SEO à Montréal", les pages citées sont des articles "top N" (My Little Big Web, Zenith, Rablab lui-même avec son article "best SEO agency Montreal"), des annuaires (HelloDarwin, Sortlist, Clutch) et des listes Semrush. Aucune page de service. Les deux pages Rablab citées par les trois moteurs sont des articles de blog, jamais la page d'accueil ni les pages de services. Sur les questions techniques génériques (Core Web Vitals, LLM et SEO), les moteurs citent la documentation officielle de Google et d'OpenAI, contre laquelle un blog d'agence ne peut pas gagner.

**Conséquence pour l'indice.** Il doit distinguer trois choses que les outils du marché mélangent : la page est-elle atteignable par les moteurs, est-elle faite pour répondre à ce type de question, et a-t-elle effectivement été reprise. Et il doit toujours diagnostiquer l'étape où ça bloque, parce que les actions n'ont rien à voir : du SEO classique si la page n'est pas dans les résultats, de la technique si elle n'est pas lisible, de la rédaction si elle est lue mais pas choisie.

## 2. Principes de conception

1. **Décomposable.** Trois sous-indices affichés côte à côte, jamais un chiffre seul. La somme n'a de sens qu'avec le détail.
2. **Séparer ce qu'on contrôle de ce qu'on observe.** Accès et Contenu sont des signaux de la page. Résultat est la mesure réelle dans le test d'inspection. Croiser les deux est le diagnostic : bon potentiel et pas de citation, c'est un problème de recherche ou de notoriété ; faible potentiel et citation quand même, c'est la marque qui porte la page.
3. **Expliquer par comparaison, pas par théorie.** Pour chaque question où la page n'est pas citée, on mesure les mêmes signaux sur les pages citées à sa place et on montre l'écart. C'est un écart observé, présenté comme tel, pas une causalité.
4. **Typologie des concurrents.** Une page citée n'est pas toujours une page contre laquelle rivaliser. Un annuaire se traite par une fiche, une documentation officielle par un changement de question, un comparatif tiers par une demande d'inclusion. L'indice doit classer les pages citées à la place pour orienter l'action.
5. **Calibré sur nos données, avec des pondérations d'abord déclarées comme hypothèses.** La grille initiale vient de la littérature et de nos premières observations. Elle sera réajustée quand on aura assez de pages analysées (section 8), moteur par moteur, en montrant les tailles d'échantillon.
6. **Honnête sur les limites.** Les moteurs changent, la réponse à une question varie d'un jour à l'autre, un test à cinq questions est un instantané. L'indice porte un niveau de confiance et n'est jamais présenté comme une prédiction.

## 3. Prérequis : capturer ce que les moteurs cherchent et lisent

Deux données que les API exposent déjà et qu'on ne stocke pas encore changent tout le diagnostic.

**Les requêtes formulées par le moteur.** OpenAI renvoie la requête de chaque appel `web_search` (`action.query`), Anthropic l'entrée de `server_tool_use` (`query`), Gemini `groundingMetadata.webSearchQueries`. On les stocke sur chaque réponse (`search_queries`). Pour un SEO manager, c'est la liste des requêtes à travailler en référencement classique pour franchir la première porte, et c'est la matière d'une future page "Requêtes IA" (les requêtes les plus fréquentes par thème et par moteur).

**Récupéré ou cité.** Gemini distingue les résultats lus (`groundingChunks`) de ceux réellement utilisés dans le texte (`groundingSupports`). Anthropic renvoie tous les résultats de recherche (`web_search_result`) et, séparément, les citations du texte. OpenAI ne donne que les citations. On enrichit chaque source d'un état : `cited` (utilisée dans la réponse) ou `retrieved` (lue mais non utilisée), quand le fournisseur le permet. La différence entre "pas remontée" et "remontée mais pas retenue" est le cœur du diagnostic de l'étape 3.

Ces deux ajouts touchent `runPrompt` et le type `SourceRef` (champs optionnels, rétrocompatibles), et profitent aussi aux runs quotidiens.

## 4. Les signaux mesurés sur une page

Chaque signal a une définition mesurable, une source (heuristique sur le HTML, ou lecture par un modèle), et une justification. Tout ce qui n'a pas de justification observée ou publiée est marqué informatif, sans points.

### A. Accès (20 points, avec effet de seuil)

| Signal | Mesure | Points | Justification |
|---|---|---|---|
| Robots de recherche IA autorisés | robots.txt évalué pour OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Google | 6 si tous autorisés ; 0 sinon, et le sous-indice Résultat du moteur bloqué est plafonné à 0 avec explication | Étape 2 : un robot bloqué ne lit pas la page |
| Réponse HTTP et canonical | 200 en direct, canonical qui pointe sur elle-même | 4 ; 2 si redirection ; 0 si canonical vers une autre page (on analyse alors la cible) | Une page canonisée ailleurs n'est pas la page indexée |
| Temps de réponse | temps total de récupération du HTML | 3 si < 1,5 s ; 2 si < 3 s ; 0 au-delà | Les robots de recherche IA ont des délais courts |
| Contenu lisible sans JavaScript | mots dans le HTML brut (zone principale) | 4 si ≥ 300 ; 2 si 100 à 299 ; 0 sinon, avec alerte | Les extracteurs ne rendent pas le JavaScript |
| Extraits autorisés | absence de `nosnippet`, `max-snippet:0`, `noindex`, `noai` | 3 ; 0 sinon | Interdit ou limite l'extrait qui sert à citer |
| llms.txt | présence | 0 point, information affichée | Aucune preuve publiée que les moteurs l'utilisent aujourd'hui |

### B. Contenu (40 points)

| Signal | Mesure | Points | Justification |
|---|---|---|---|
| B1 Adéquation au type de question | Type de question (comparatif, informationnel, prix, local, ressource) classé par le modèle ; type de page détecté (comparatif "top N", guide, page de service, annuaire, documentation, actualité) par heuristiques (liste d'entités en H2, "top", chiffres dans le titre, schéma ItemList) puis confirmé par le modèle ; note d'adéquation 0 à 3 | 0 / 4 / 7 / 10 | Sur les questions comparatives, les comparatifs et annuaires sont cités, pas les pages de vente ; sur les questions "comment", les guides |
| B2 Réponse directe | Existe-t-il un passage de 80 mots maximum qui répond à la question, dans le premier quart de la page ou sous un sous-titre qui la reformule ; le modèle cite le passage | 0 / 3 / 6 / 8 | Les moteurs citent des passages, pas des pages ; le passage doit exister et être trouvable |
| B3 Structure extractible | Au moins 3 sous-titres formulés comme des questions ou des entités nommées : 2 ; listes ou tableaux dans le corps : 2 ; bloc FAQ, résumé ou "en bref" : 2 | 0 à 6 | Les extracteurs découpent par titres ; les listes se reprennent telles quelles |
| B4 Spécificité et preuves | Au moins 5 données chiffrées (prix, pourcentages, dates, durées) : 3 ; au moins 2 sources externes nommées ou liées : 2 ; une citation d'expert ou un témoignage attribué : 1 ; note de spécificité du modèle ≥ 2 sur 3 : 2 | 0 à 8 | Résultat le plus robuste de la littérature GEO : chiffres, sources et citations augmentent la reprise |
| B5 Fraîcheur | `dateModified` ou `datePublished` (JSON-LD, meta, "mis à jour le" visible), année dans le titre | 4 si ≤ 6 mois ; 3 si ≤ 12 ; 1 si ≤ 24 ; 0 sinon ou sans date | Les moteurs favorisent le récent, surtout sur les questions "meilleur", "prix", "en 2026" |
| B6 Entité et autorité sur la page | Auteur nommé avec fonction, schéma Person ou Organization : 2 ; liens "à propos", contact, profils (`sameAs`) : 1 ; nom de marque cohérent titre, en-tête, pied de page : 1 | 0 à 4 | Signaux d'attribution que les moteurs et les guides qualité valorisent ; faibles mais gratuits |

Ancrage local et langue : traités comme un modificateur de B1. Si la question est locale (ville, province) et que la page ne nomme pas le lieu dans le titre, les sous-titres ou le premier quart, B1 est plafonné à 4. Si la langue de la page diffère de celle de la question, B1 est plafonné à 4 également (le cas s'est vu : l'article anglais de Rablab cité sur une question française par Claude, ce qui reste rare).

### C. Résultat observé (40 points)

Mesuré sur les réponses du test d'inspection, par moteur, puis moyenné.

| Constat sur une réponse | Valeur |
|---|---|
| URL citée dans la réponse | 1,0 |
| Autre page du même site citée | 0,6 |
| URL récupérée par la recherche mais non utilisée (quand le moteur le dit) | 0,4 |
| Marque nommée sans source | 0,3 |
| Rien | 0 |

Résultat = moyenne des valeurs × 40. Affiché par moteur, avec le nombre de réponses. En dessous de 5 réponses, l'indice global est affiché en "confiance faible".

### Indice global

Indice = A + B + C, sur 100, avec ces règles : si un robot de recherche est bloqué, le Résultat du moteur concerné est mis à 0 et l'explication le dit ; si le contenu n'est pas lisible sans JavaScript, B est plafonné à 15 ; si la page est canonisée ailleurs, on analyse la cible et on l'indique.

Lecture recommandée, affichée sous la jauge :

- **A faible** : la page n'est pas atteignable, corriger avant tout le reste.
- **A bon, B bon, C faible** : la page est bien faite mais n'entre pas dans la recherche, ou le moteur préfère des sources plus connues. Regarder les requêtes formulées par les moteurs et le référencement classique dessus ; regarder la typologie des pages citées à la place.
- **A bon, B faible, C faible** : travail de contenu, guidé par la comparaison.
- **C bon malgré B faible** : la marque porte la page ; consolider le contenu avant que ça ne se retourne.

## 5. Le "pourquoi" : comparaison avec les pages citées à la place

Pour chaque question du test où l'URL n'est pas citée, on prend les trois premières pages citées par le moteur, on les récupère (gratuit, mises en cache 7 jours par URL, mêmes limites de sécurité que l'inspection), et on calcule sur elles les signaux A et B.

**Typologie des pages citées**, décidée par heuristiques puis confirmée par le modèle, avec l'action associée :

| Type | Exemples vus | Action recommandée |
|---|---|---|
| Annuaire ou plateforme d'avis | Clutch, HelloDarwin, Sortlist, agences Semrush, annuaire B Corp | Créer ou compléter la fiche, obtenir des avis. La page ne rivalise pas, elle s'y inscrit |
| Comparatif d'un tiers neutre | article "meilleures agences" d'un média ou d'un blog indépendant | Demander l'inclusion ; publier son propre comparatif plus complet |
| Comparatif d'un concurrent | article "top agences" de My Little Big Web ou Zenith | Publier un comparatif à jour et plus utile, qui nomme les concurrents honnêtement |
| Documentation officielle | developers.google.com, help.openai.com, support.google.com | Ne pas viser cette question ; viser une variante locale, sectorielle ou pratique |
| Média ou presse | Le Devoir, La Presse, blogs spécialisés | Relations presse, tribune, étude originale |
| Page de service d'un concurrent | page "SEO Montréal" d'une agence | Améliorer la sienne : réponse directe, prix, preuves, fraîcheur |
| Page institutionnelle | gouvernement, ordre professionnel | Citer ces sources dans sa propre page plutôt que rivaliser |

**Le tableau de comparaison** montre, signal par signal, la valeur de notre page et la médiane des pages citées comparables (même type quand il y en a, sinon toutes en le disant), et met en avant les trois écarts les plus grands. Exemple de rendu : "Les comparatifs cités font 2 400 mots, nomment 8 agences avec prix indicatifs, et datent de 2026. Votre article : 1 200 mots, 5 agences sans prix, octobre 2025."

## 6. La lecture par un modèle

Un appel par couple page × question, sur le modèle le moins cher disponible, sortie structurée :

- type de question (comparatif, informationnel, prix, local, ressource) et lieu attendu ;
- type de page ;
- adéquation 0 à 3 avec une phrase ;
- réponse directe 0 à 3 avec le passage cité (80 mots maximum) ou "absent" ;
- spécificité 0 à 3 ;
- trois forces, trois manques ;
- trois actions concrètes et vérifiables (par exemple "ajouter une fourchette de prix par prestation dans la section 2", pas "améliorer le contenu").

Entrée limitée au titre, aux sous-titres et aux 6 000 premiers caractères du texte principal, pour tenir le coût et éviter les pages fleuves. Les notes du modèle alimentent B1, B2 et B4 comme indiqué dans la grille ; les forces, manques et actions sont affichés tels quels, sous la mention "lecture du modèle", jamais mélangés aux mesures.

Fiabilité : un juge automatique varie d'un appel à l'autre. On appelle une fois par empreinte de contenu (cache), et on affiche la note avec sa nature. Si l'écart entre l'heuristique et le modèle est fort (par exemple aucune liste détectée mais "structure excellente"), on le signale au lieu de trancher.

## 7. Coûts et garde-fous

- Récupération de pages : gratuite. Une analyse complète récupère la page, jusqu'à 15 pages citées (5 questions × 3), avec cache.
- Lecture par le modèle : environ 0,003 USD par couple. Analyse complète : page × 5 questions + jusqu'à 15 pages citées × 1 question chacune, soit 20 appels, environ 0,06 USD. Plafond : 0,20 USD par analyse, réglable.
- Cache par empreinte de contenu, 7 jours : réanalyser une page inchangée ne coûte rien.
- L'analyse ne se lance que sur clic, après le test d'inspection, ou depuis la page Sources sur une page déjà citée. Jamais automatiquement dans le run quotidien.
- Mêmes protections que l'inspection pour les récupérations (adresses privées refusées, délais, taille).

## 8. Calibration sur nos données

La grille de la section 4 est une hypothèse de départ. On la vérifie ainsi.

1. **Corpus.** Toutes les sources des runs quotidiens et des inspections, avec leur état (citée, récupérée non citée) et le moteur. Après quelques semaines, plusieurs centaines de pages par moteur.
2. **Extraction.** Les signaux A et B calculés sur chaque page du corpus (récupération en arrière-plan, limitée à 200 pages par jour, cache 30 jours).
3. **Mesure.** Pour chaque signal, la part de pages citées parmi celles qui l'ont, contre celles qui ne l'ont pas, par moteur, avec l'effectif. Un signal dont l'effet est nul ou inverse sur 300 pages perd ses points ; un signal fort en gagne. Pour les moteurs qui distinguent récupéré et cité, on isole la sélection (étape 3) de la recherche (étape 1), ce qui est bien plus informatif.
4. **Publication.** Une page "Calibration" dans l'outil montre ces chiffres et la version de la grille en vigueur. Toute modification de pondération est datée, avec l'effectif qui la justifie. L'indice d'une page indique la version de grille utilisée.

C'est la partie qui transforme un score d'opinion en instrument : les pondérations viennent des moteurs qu'on suit, pas d'un article de blog.

## 9. Ce que l'indice ne dit pas, et comment on le présente

- Il ne prédit pas une citation. Il situe la page et explique les écarts avec celles qui sont citées.
- Il ne mesure pas la notoriété hors page (mentions de la marque sur le web, avis, liens), qui pèse lourd à l'étape 3. On l'approche par le taux de mention de la marque dans les prompts en mode mémoire, affiché à côté, et par la présence du domaine dans les sources d'autres prompts.
- Il n'est pas comparable entre moteurs sans le détail par moteur.
- Il change avec les moteurs et avec la grille ; chaque analyse porte sa date et sa version.

Ces limites sont écrites dans l'interface, sous l'indice, pas dans une documentation à part.

## 10. Modèle de données

```
page_analyses
  id, project_id, normalized_url, url, content_hash, grid_version,
  page (json : les mêmes champs que l'inspection, plus dateModified, author, sameAs, outboundLinks, numbers, lists, tables, faq, h2Questions, pageType, lang, wordCount),
  access_score, content_score, signals (json : chaque signal avec valeur et points),
  judge (json : par question : types, notes, passage, forces, manques, actions),
  cost_estimate, created_at

inspection_answers.sources[] : + retrieved (bool), cited (bool)
results.sources[] : idem
results.search_queries, inspection_answers.search_queries : json string[]

inspections.analysis_id -> page_analyses
comparison_pages : normalized_url, content_hash, page (json), page_type, fetched_at  (cache partagé des pages citées)
```

## 11. Interface

- **Rapport d'inspection**, après "Résultat du test" : section "Citabilité" avec trois jauges (Accès, Contenu, Résultat) et l'indice global, le niveau de confiance et la version de grille ; sous les jauges, la lecture recommandée (section 4) ; puis "Requêtes formulées par les moteurs" ; puis "Pourquoi" : typologie des pages citées à la place, tableau de comparaison, lecture du modèle avec les trois actions. Bouton "Analyser" tant que l'analyse n'a pas été lancée, avec le coût estimé.
- **Page Sources** : sur "nos pages citées", un bouton "Analyser" par page, l'indice une fois calculé, et un tri par indice.
- **Page Calibration** (plus tard) : les chiffres de la section 8.

## 12. Découpage

1. **Requêtes et état des sources** (section 3) : `runPrompt` stocke les requêtes formulées et l'état récupéré ou cité par source. Tests sur les trois fournisseurs. Une demi-journée, et déjà utile seul.
2. **Extraction des signaux** : bibliothèque pure sur le HTML (dates, auteur, chiffres, listes, FAQ, sous-titres questions, type de page, liens sortants, ancrage local), tests sur des fixtures. Une journée.
3. **Analyse** : service (page, pages citées à la place avec cache, lecture par le modèle, calcul de la grille), tables, plafonds. Une journée.
4. **Interface** : section Citabilité du rapport, bouton sur Sources. Une demi-journée.
5. **Calibration** : extraction en arrière-plan du corpus, page de chiffres, procédure de mise à jour de la grille. Après quelques semaines de données.

Total : trois jours pour les lots 1 à 4.
