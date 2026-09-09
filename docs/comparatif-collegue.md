# Comparatif : tableau de bord SEO + GEO du collègue (Rabacadémie) et GEO Monitor

9 septembre 2026. Base : huit captures du tableau de bord "Juste Des Stores" (dossier `docs/dashboard/`).

## 1. Ce que fait leur outil

Un tableau de bord client qui mélange trois sources : positions de mots-clés (82 suivis, top 3 / 10 / 20, score de visibilité, "quick wins" positions 4 à 15), trafic IA mesuré dans GA4 (sessions, revenus, transactions, panier moyen, entonnoir, produits achetés, pages d'entrée, avec MoM et YoY), et visibilité dans les réponses IA sur cinq moteurs (ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews). Un "récit du mois" généré par un modèle, avec une vue stratège et une vue client. Collecte mensuelle ("la courbe démarre au 2e snapshot").

## 2. Ce qu'ils ont et que nous n'avons pas

| Élément | Chez eux | Chez nous | Intérêt |
|---|---|---|---|
| Google AI Overviews comme moteur | Oui, via une collecte SERP maison ; c'est leur moteur le plus favorable (44 %) | Non : impossible par API, seul le proxy Gemini | Fort. La donnée manquante la plus importante pour un client québécois |
| Impact business (GA4) | Sessions, revenus, transactions, entonnoir, produits, pages d'entrée du trafic IA | Non (backlog du CDC) | Fort. C'est ce qui justifie le budget côté client |
| Intervalle de confiance | "Vrai taux estimé entre 9 % et 22 %", avertissement contre les petites variations | Non, un taux brut | Fort et presque gratuit. Honnêteté statistique |
| Deux taux en tête | "Citée en source" 13,1 % et "nommée dans le texte" 4,9 %, à côté du global | Nous avons les deux métriques mais la tête d'affiche est la citation | Facile |
| Rang moyen quand citée | Par moteur ("rang 5", "rang 13") avec une phrase d'interprétation | Rang stocké, pas affiché sur les cartes | Facile |
| Rang de la marque parmi les domaines cités | "8e sur 147 domaines cités" | Non | Facile |
| Duel par concurrent | "1 te prend, 2 tu gagnes, cité sur 4/8" | Recouvrement par concurrent, moins lisible | Facile, meilleure formulation |
| Points forts et faibles par prompt | Taux par prompt et "place prise par X, Y, Z" | Fiche prompt et opportunités rapides, sans les domaines qui prennent la place | Facile |
| À faire pour progresser | Trois puces générées | Nos actions viennent de l'inspection, plus précises mais pas sur le dashboard | Moyen |
| Sentiment et attributs associés | "33 % positif", "bas prix, fabriqué au Québec, garantie" | Non (backlog) | Moyen, peu coûteux (seulement les réponses qui nomment la marque) |
| Récit du mois | Narratif généré, MoM et YoY, contexte du stratège, vue client | Non (backlog "Rapport") | Moyen, utile pour les livrables clients |
| Mots-clés SEO classiques | 82 mots-clés, positions, KD, volumes | Non, par choix | Faible pour nous : ce n'est pas le périmètre |

## 3. Ce que nous avons et qu'ils n'ont pas

- **Inspection d'URL et indice de citabilité** : accès des robots IA, signaux de page, grille, comparaison avec les pages citées à la place typées (annuaire, comparatif, documentation), lecture par un modèle avec actions sur la page. Leur "À faire" reste au niveau "crée ou renforce un contenu".
- **Requêtes formulées par les moteurs** et distinction page lue / page citée : le pont vers le SEO classique, absent chez eux.
- **Fréquence** : nos runs sont quotidiens si on le veut, les leurs mensuels. Sur 26 réponses par moteur (leur échantillon), la tendance mensuelle sera longue à se dessiner.
- **Mode mémoire** (sans recherche web) : la notoriété dans le modèle, qu'ils ne mesurent pas.
- **Sources et opportunités** : domaines cités à notre place avec présence ou absence, ajout d'un concurrent en un clic, pages citées avec le détail de chaque réponse.
- **Comparaison des moteurs par thème** et sources par moteur.
- **Preuves** : chaque réponse brute avec surlignage, sources, rang, coût, requêtes. Leur détail par prompt donne des comptes de domaines, pas les réponses.
- **Coût et contrôle** : coût affiché par moteur et par run, plafonds, rejeu, complément d'un run par moteur.

## 4. Ce qui reste flou chez eux

- Comment est faite la collecte SERP pour AI Overviews (fournisseur ou scraping), à quel coût, et sa robustesse.
- La taille des échantillons : 26 réponses par moteur, 18 pour AI Overviews, 6 réponses pour le sentiment. Leur propre avertissement statistique le reconnaît.
- Le "score de visibilité IA" global mélange cinq moteurs aux comportements très différents ; nos données montrent des écarts de 7 % à 55 % selon le moteur.

## 5. Recommandations

**À reprendre tout de suite (une journée)**
1. Intervalle de confiance (Wilson) et effectif sur chaque taux affiché, avec la phrase d'avertissement.
2. Cartes moteur : ajouter "citée en source" et "nommée dans le texte" séparés, le rang moyen quand citée, une interprétation en une ligne.
3. Rang de la marque parmi tous les domaines cités.
4. Vue par prompt : "place prise par" avec les trois domaines et leurs comptes ; duel par concurrent sur la page Concurrents.

**À planifier (chacun quelques jours)**
5. Google AI Overviews via une API SERP (DataForSEO ou SerpAPI), ou en réutilisant la collecte du collègue si elle est partageable : c'est la même agence.
6. GA4 : sessions et conversions du trafic IA (référents chatgpt.com, perplexity.ai, gemini.google.com, copilot, claude.ai), pages d'entrée. OAuth Google et API Data.
7. Sentiment et attributs sur les réponses qui nomment la marque.
8. Récit mensuel généré avec vue stratège et vue client, export.

**Question d'organisation**
Deux outils internes se recouvrent sur la visibilité IA. Soit on fusionne (notre moteur de mesure et l'inspection dans leur portail, qui a déjà GA4 et les mots-clés), soit on se répartit : leur tableau de bord pour le reporting client, GEO Monitor pour le diagnostic et l'inspection. À trancher avec le collègue avant d'investir dans GA4 et AI Overviews des deux côtés.
