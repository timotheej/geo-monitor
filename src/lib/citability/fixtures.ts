/** Fixtures HTML réalistes pour les tests de la bibliothèque de citabilité. Pas de tiret long dans les textes. */

const para = (s: string, n = 1) => Array.from({ length: n }, () => `<p>${s}</p>`).join("\n");

const FILLER_FR =
  "Le référencement naturel demande une méthode, des outils et de la patience. Une agence sérieuse commence par un audit technique, puis travaille le contenu et la notoriété, avec des rapports mensuels lisibles et des objectifs chiffrés partagés avec le client dès le premier trimestre.";

export const LISTICLE_URL = "https://www.rablab.ca/blog/meilleures-agences-seo-montreal";

export const LISTICLE_HTML = `<!doctype html><html lang="fr-CA"><head>
<title>Top 10 des meilleures agences SEO à Montréal en 2026 | Rablab</title>
<meta name="description" content="Comparatif 2026 des meilleures agences SEO à Montréal, avec prix indicatifs, spécialités et avis.">
<meta property="og:site_name" content="Rablab">
<meta property="article:published_time" content="2025-11-03T09:00:00Z">
<meta property="article:modified_time" content="2026-08-20T14:30:00Z">
<meta name="author" content="Timothée Jezek">
<link rel="canonical" href="https://rablab.ca/blog/meilleures-agences-seo-montreal">
<meta name="robots" content="index, follow, max-image-preview:large">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"BlogPosting","headline":"Top 10 des meilleures agences SEO à Montréal en 2026","datePublished":"2025-11-03","dateModified":"2026-08-20",
  "author":{"@type":"Person","name":"Timothée Jezek","jobTitle":"Directeur SEO"},
  "publisher":{"@type":"Organization","name":"Rablab","sameAs":["https://www.linkedin.com/company/rablab","https://www.facebook.com/rablab"]}},
 {"@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"name":"Rablab"},{"@type":"ListItem","position":2,"name":"My Little Big Web"}]},
 {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Combien coûte une agence SEO à Montréal ?","acceptedAnswer":{"@type":"Answer","text":"Entre 1 500 $ et 8 000 $ par mois."}}]}
]}</script>
<script>window.dataLayer = [];</script>
</head><body>
<header><a href="/">Rablab</a><nav><a href="/services">Services</a><a href="/a-propos">À propos</a><a href="/contact">Contact</a></nav></header>
<main><article>
<h1>Top 10 des meilleures agences SEO à Montréal en 2026</h1>
<p class="byline">Par Timothée Jezek, directeur SEO. Mis à jour le 20 août 2026.</p>
<div class="summary"><strong>En bref</strong> : les dix agences comparées facturent entre 1 500 $ et 8 000 $ par mois, la plupart offrent un audit initial et trois d'entre elles sont certifiées B Corp.</div>
<p>Choisir la meilleure agence SEO à Montréal en 2026 dépend de votre budget, de votre secteur et de vos objectifs. Nous avons comparé 10 agences montréalaises sur les prix, l'expérience, les avis clients et la transparence des rapports. Voici notre sélection, avec des fourchettes de prix indicatives.</p>
${para(FILLER_FR, 2)}
<h2>Comment nous avons comparé les agences ?</h2>
<p>Nous avons retenu 42 agences, éliminé celles sans avis vérifiés sur <a href="https://clutch.co/ca/seo-firms/montreal">Clutch</a> et retenu les 10 plus constantes. Les prix viennent des sites des agences ou de <a href="https://www.hellodarwin.com/fr/agences-seo-montreal">HelloDarwin</a>, consultés en juillet 2026.</p>
<table><tr><th>Agence</th><th>Prix mensuel</th><th>Note</th></tr><tr><td>Rablab</td><td>2 500 $</td><td>4,9 / 5</td></tr><tr><td>My Little Big Web</td><td>3 000 $</td><td>4,8 / 5</td></tr></table>
<h2>1. Rablab</h2>
<p>Fondée en 2012, Rablab compte 35 employés et affiche 98 % de clients renouvelés. Tarifs à partir de 2 500 $ par mois, audit livré en 3 semaines.</p>
${para(FILLER_FR)}
<h2>2. My Little Big Web</h2>
<p>Agence généraliste, 60 employés, forte en contenu. Comptez 3 000 $ par mois pour un accompagnement complet, engagement de 6 mois.</p>
<h2>3. Zenith</h2>
<p>Spécialisée en commerce électronique, 25 % de croissance de trafic en moyenne sur 12 mois selon ses études de cas.</p>
<h2>4. Bloom</h2>
<p>Une agence de 40 personnes, 4,7 étoiles sur Google, forte en SEO local.</p>
<h2>5. Adviso</h2>
<p>Grande agence de 120 employés, projets à partir de 8 000 $ par mois, données et analytique.</p>
<h2>6. Digitad</h2>
<p>Petite équipe de 15 personnes, accompagnement pour PME, forfaits dès 1 500 $ par mois.</p>
<ul><li>Audit technique inclus dans tous les forfaits, livré en 10 jours ouvrables.</li><li>Rapport mensuel avec positions, trafic et conversions.</li><li>Contrat sans engagement au-delà de 3 mois.</li></ul>
<blockquote>« Une bonne agence SEO montre ses chiffres avant de vendre », résume Marie Tremblay, consultante indépendante.</blockquote>
<h2>Questions fréquentes</h2>
<h3>Combien coûte une agence SEO à Montréal ?</h3>
<p>Entre 1 500 $ et 8 000 $ par mois selon la taille du site et l'ambition, la médiane observée est de 3 000 $.</p>
<h3>Combien de temps avant des résultats ?</h3>
<p>Comptez 4 à 6 mois pour des gains mesurables sur des requêtes concurrentielles.</p>
<h3>Faut-il un contrat long ?</h3>
<p>Non, la plupart des agences proposent 3 mois d'engagement initial.</p>
${para(FILLER_FR, 3)}
</article></main>
<footer>© 2026 Rablab inc. <a href="/a-propos">À propos</a> <a href="https://www.linkedin.com/company/rablab">LinkedIn</a></footer>
</body></html>`;

export const SERVICE_URL = "https://www.zenithagence.ca/services/seo-montreal";

export const SERVICE_HTML = `<!doctype html><html lang="fr"><head>
<title>Agence SEO à Montréal | Zenith</title>
<meta name="description" content="Nos services de référencement naturel à Montréal pour PME et commerces en ligne.">
<link rel="canonical" href="https://www.zenithagence.ca/services/seo-montreal">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Zenith","address":{"@type":"PostalAddress","addressLocality":"Montréal"},"sameAs":["https://www.linkedin.com/company/zenith"]}</script>
</head><body>
<header><a href="/">Zenith</a><nav><a href="/services">Nos services</a><a href="/equipe">Équipe</a><a href="/contact">Contact</a></nav></header>
<main>
<h1>Agence SEO à Montréal</h1>
<p>Zenith accompagne les entreprises montréalaises dans leur référencement naturel depuis 2015. Nos services couvrent l'audit technique, la stratégie de contenu et la création de liens, avec un accompagnement mensuel transparent.</p>
${para(FILLER_FR, 3)}
<h2>Nos services SEO</h2>
<ul><li>Audit technique complet de votre site, livré en 10 jours.</li><li>Stratégie de contenu adaptée à votre marché.</li><li>Suivi mensuel des positions et du trafic.</li></ul>
<h2>Tarifs</h2>
<p>Nos forfaits sont à partir de 1 500 $ par mois, sans engagement au-delà de 3 mois.</p>
<h2>Pourquoi choisir Zenith ?</h2>
<p>Une équipe de 25 spécialistes, 80 clients actifs et des résultats mesurés chaque mois.</p>
<section class="cta"><h2>Demander une soumission</h2><p>Parlez-nous de votre projet, nous répondons en 24 heures.</p></section>
${para(FILLER_FR, 2)}
</main>
<form action="/contact"><input type="text" name="name"><input type="email" name="email"><textarea name="message"></textarea><button>Demander une soumission</button></form>
<footer>Zenith inc., Montréal. <a href="/contact">Contact</a></footer>
</body></html>`;

export const DOC_URL = "https://developers.google.com/search/docs/appearance/core-web-vitals";

export const DOC_HTML = `<!doctype html><html lang="en"><head>
<title>Understanding Core Web Vitals and Google search results | Google Search Central</title>
<meta name="description" content="Learn how Core Web Vitals affect ranking.">
<link rel="canonical" href="https://developers.google.com/search/docs/appearance/core-web-vitals">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"TechArticle","headline":"Understanding Core Web Vitals","dateModified":"2026-05-14"}</script>
</head><body>
<header><nav><a href="/search/docs">Documentation</a></nav></header>
<main>
<h1>Understanding Core Web Vitals and Google search results</h1>
<p>Last updated on May 14, 2026.</p>
<p>Core Web Vitals are a set of metrics that measure real-world user experience for loading performance, interactivity, and visual stability of the page. The three metrics are LCP, INP and CLS, and Google recommends that sites achieve good scores on all three for at least 75 % of page loads.</p>
<h2>How Core Web Vitals affect ranking</h2>
<p>Page experience is one of many signals that Google Search uses to rank content. Sites with good Core Web Vitals scores tend to have better user engagement, but great content still matters most. A page that loads in 2.5 s or less for LCP is considered good.</p>
<h2>What are the thresholds?</h2>
<table><tr><th>Metric</th><th>Good</th><th>Poor</th></tr><tr><td>LCP</td><td>2.5 s</td><td>4 s</td></tr><tr><td>INP</td><td>200 ms</td><td>500 ms</td></tr><tr><td>CLS</td><td>0.1</td><td>0.25</td></tr></table>
<h2>Measuring Core Web Vitals</h2>
<ul><li>Use the Core Web Vitals report in Search Console.</li><li>Use PageSpeed Insights for lab and field data.</li><li>Use the web-vitals JavaScript library for real user monitoring.</li></ul>
<p>The Chrome User Experience Report collects anonymized field data from millions of sites. Read more at <a href="https://web.dev/articles/vitals">web.dev</a> and the <a href="https://developer.chrome.com/docs/crux">CrUX documentation</a>.</p>
<p>${"Google provides several tools to help you measure and improve the user experience of your pages, and each of them reports the same three metrics with the same thresholds. ".repeat(12)}</p>
</main>
<footer>Google</footer>
</body></html>`;

export const DIRECTORY_URL = "https://clutch.co/ca/seo-firms/montreal";

export const DIRECTORY_HTML = `<!doctype html><html lang="en"><head>
<title>Top SEO Companies in Montreal - 2026 Reviews | Clutch.co</title>
<link rel="canonical" href="https://clutch.co/ca/seo-firms/montreal">
</head><body>
<header><nav><a href="/about-us">About</a></nav></header>
<main>
<h1>Top SEO Companies in Montreal</h1>
<p>Find the best SEO agencies in Montreal. Clutch lists 143 verified providers with client reviews, hourly rates and minimum project sizes updated in 2026.</p>
<h2>Rablab</h2><p>4.9 stars, 24 reviews. Min. project size $5,000, hourly rate $150 - $199, 10 - 49 employees.</p>
<h2>My Little Big Web</h2><p>4.8 stars, 31 reviews. Min. project size $1,000, 50 - 249 employees.</p>
<h2>Zenith</h2><p>4.7 stars, 12 reviews. Min. project size $5,000, 10 - 49 employees.</p>
<h2>Bloom</h2><p>4.9 stars, 18 reviews. Min. project size $10,000, 10 - 49 employees.</p>
<h2>Digitad</h2><p>5.0 stars, 9 reviews. Min. project size $1,000, 2 - 9 employees.</p>
<h2>Adviso</h2><p>4.6 stars, 15 reviews. Min. project size $25,000, 50 - 249 employees.</p>
<p>${"Clutch verifies every review through a phone or online interview with the client, and publishes ratings on cost, schedule, quality and willingness to refer. ".repeat(10)}</p>
</main>
<footer>Clutch</footer>
</body></html>`;

export const JS_EMPTY_URL = "https://app.example.com/agences";

export const JS_EMPTY_HTML = `<!doctype html><html><head><title>Agences</title><meta name="robots" content="noindex, nosnippet"></head><body><div id="root"></div><script src="/static/js/main.4f2a.js"></script></body></html>`;

export const ARTICLE_URL = "https://blog.example.ca/loi-25-sites-web";

export const ARTICLE_HTML = `<!doctype html><html lang="fr-CA"><head>
<title>Loi 25 : ce que votre site doit faire | Example</title>
<meta name="description" content="Guide pratique de conformité à la Loi 25 pour les sites web au Québec.">
<link rel="canonical" href="https://blog.example.ca/loi-25-sites-web?utm_source=newsletter">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","datePublished":"2025-09-15","author":{"@type":"Person","name":"Marie Tremblay"}}</script>
</head><body>
<header><a href="/">Example</a></header>
<main><article>
<h1>Loi 25 : ce que votre site doit faire</h1>
<p>Publié le 15 septembre 2025, mis à jour le 12 mars 2026. Par Marie Tremblay, directrice SEO.</p>
<p>La Loi 25 impose aux entreprises québécoises de nouvelles obligations en matière de protection des renseignements personnels, et votre site web est concerné en premier lieu. Voici comment se conformer en trois étapes, avec les délais et les amendes prévues.</p>
<h2>Qu'est-ce que la Loi 25 ?</h2>
<p>Adoptée en 2021, la Loi 25 modernise le régime québécois de protection des renseignements personnels. Les amendes peuvent atteindre 25 000 000 $ ou 4 % du chiffre d'affaires mondial, selon la <a href="https://www.cai.gouv.qc.ca/">Commission d'accès à l'information</a>.</p>
<h2>Étape 1 : la bannière de consentement</h2>
<p>Le consentement aux témoins non essentiels doit être obtenu avant tout dépôt, ce qui implique une bannière conforme et un registre.</p>
<h2>Étape 2 : la politique de confidentialité</h2>
<p>Publiez une politique claire, en français, avec le nom du responsable de la protection des renseignements personnels.</p>
<h2>Étape 3 : Google Analytics 4</h2>
<ol><li>Activez le mode consentement.</li><li>Anonymisez les adresses IP.</li><li>Réduisez la durée de conservation à 14 mois.</li></ol>
<blockquote><p>« La conformité n'est pas un projet, c'est une habitude », rappelle Me Julie Bouchard, avocate.</p></blockquote>
<p>Selon <a href="https://www.lesaffaires.com/">Les Affaires</a>, 62 % des PME québécoises n'étaient pas conformes en janvier 2026.</p>
<p>${"Chaque site est différent, mais la démarche reste la même : inventorier les données collectées, documenter les finalités et obtenir un consentement valide avant toute collecte. ".repeat(10)}</p>
</article></main>
<footer>Example inc.</footer>
</body></html>`;
