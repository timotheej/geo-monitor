/**
 * Typologie de page par heuristiques (docs/indice-citabilite.md, section 5). Le modèle confirmera plus tard.
 * Chaque type accumule des indices pondérés ; le plus fort gagne, `confidence` reflète la marge.
 */

import type { PageSignals } from "./signals";
import { normalizeText } from "@/lib/detection";

export type PageType = "listicle" | "guide" | "service" | "directory" | "documentation" | "news" | "institutional" | "other";

export type PageTypeResult = { type: PageType; confidence: number; reasons: string[] };

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  listicle: "Comparatif ou liste « top N »",
  guide: "Guide ou article explicatif",
  service: "Page de service",
  directory: "Annuaire ou plateforme d'avis",
  documentation: "Documentation officielle",
  news: "Média ou presse",
  institutional: "Page institutionnelle",
  other: "Autre",
};

/** Annuaires et plateformes d'avis vus dans nos données ou courants au Québec et au Canada. */
export const DIRECTORY_HOSTS = [
  "clutch.co", "sortlist.com", "sortlist.ca", "sortlist.fr", "hellodarwin.com", "agencies.semrush.com", "g2.com", "capterra.com",
  "capterra.ca", "trustpilot.com", "yelp.com", "yelp.ca", "pagesjaunes.ca", "yellowpages.ca", "bcorporation.net", "goodfirms.co",
  "designrush.com", "upcity.com", "themanifest.com", "expertise.com", "agencyspotter.com", "topseos.com", "semrush.com/agencies",
  "trustradius.com", "getapp.com", "softwareadvice.com", "producthunt.com", "crunchbase.com", "glassdoor.com", "glassdoor.ca",
  "google.com/maps", "maps.google.com", "bbb.org", "ratemds.com", "houzz.com",
];

/** Documentation officielle et centres d'aide des plateformes. */
export const DOCUMENTATION_HOSTS = [
  "developers.google.com", "support.google.com", "developer.chrome.com", "web.dev", "search.google.com", "help.openai.com",
  "platform.openai.com", "openai.com/index", "docs.anthropic.com", "support.anthropic.com", "learn.microsoft.com", "docs.microsoft.com",
  "support.microsoft.com", "developer.mozilla.org", "developer.apple.com", "support.apple.com", "help.shopify.com", "shopify.dev",
  "wordpress.org/documentation", "developer.wordpress.org", "help.ahrefs.com", "kb.semrush.com", "support.cloudflare.com",
  "developers.cloudflare.com", "docs.aws.amazon.com", "cloud.google.com/docs", "docs.github.com", "help.perplexity.ai",
  "developers.facebook.com", "business.help.linkedin.com", "help.instagram.com", "schema.org", "w3.org",
];

/** Presse et blogs spécialisés de référence. */
export const NEWS_HOSTS = [
  "ledevoir.com", "lapresse.ca", "journaldemontreal.com", "journaldequebec.com", "radio-canada.ca", "ici.radio-canada.ca", "cbc.ca",
  "lesaffaires.com", "theglobeandmail.com", "globeandmail.com", "nationalpost.com", "montrealgazette.com", "thestar.com", "ctvnews.ca",
  "globalnews.ca", "lemonde.fr", "lefigaro.fr", "nytimes.com", "washingtonpost.com", "theguardian.com", "reuters.com", "bloomberg.com",
  "techcrunch.com", "theverge.com", "wired.com", "searchengineland.com", "searchenginejournal.com", "seroundtable.com", "infopresse.com",
  "grenier.qc.ca", "isarta.com", "journalmetro.com", "24heures.ca", "lactualite.com", "bfmtv.com", "france24.com", "20minutes.fr",
];

const hostMatches = (host: string, path: string, list: string[]) =>
  list.some((entry) => {
    const [h, ...p] = entry.split("/");
    const hostOk = host === h || host.endsWith(`.${h}`);
    return p.length ? hostOk && path.startsWith(`/${p.join("/")}`) : hostOk;
  });

const INSTITUTIONAL_HOST = /(?:^|\.)(?:gouv\.qc\.ca|gc\.ca|gouv\.fr|gov|gov\.uk|quebec\.ca|canada\.ca|europa\.eu|un\.org|who\.int|oqlf\.gouv\.qc\.ca)$|\.gouv\.|\.gov\.|\.edu$|\.ac\.[a-z]{2}$|(?:^|\.)(?:ordre|barreau|opq|cpa|oiq|omvq|cmq)[a-z-]*\.(?:qc\.ca|ca|org)$/;
const INSTITUTIONAL_TEXT = /\b(?:ordre (?:des|professionnel)|gouvernement|ministere|ministry|government of|office quebecois|regie|commission|loi sur|reglement|legislation|statuts?)\b/;

type Tally = Record<PageType, { points: number; reasons: string[] }>;

function url(signals: PageSignals): { host: string; path: string } {
  try {
    const u = new URL(signals.url);
    return { host: u.hostname.toLowerCase().replace(/^www\./, ""), path: u.pathname.toLowerCase() };
  } catch {
    return { host: signals.host, path: "" };
  }
}

export function detectPageType(signals: PageSignals): PageTypeResult {
  const tally: Tally = {
    listicle: { points: 0, reasons: [] },
    guide: { points: 0, reasons: [] },
    service: { points: 0, reasons: [] },
    directory: { points: 0, reasons: [] },
    documentation: { points: 0, reasons: [] },
    news: { points: 0, reasons: [] },
    institutional: { points: 0, reasons: [] },
    other: { points: 0, reasons: [] },
  };
  const add = (t: PageType, points: number, reason: string) => {
    tally[t].points += points;
    tally[t].reasons.push(reason);
  };

  const { host, path } = url(signals);
  const title = normalizeText(`${signals.title} ${signals.h1}`);
  const types = signals.jsonLdTypes;

  // Domaines connus : décisifs, ils l'emportent sur le contenu.
  if (hostMatches(host, path, DIRECTORY_HOSTS)) add("directory", 8, `domaine d'annuaire connu (${host})`);
  else if (/(?:^|\/)(?:annuaire|directory|agencies|agences|listings?|profile|profil|reviews?|avis)(?:\/|$)/.test(path) && signals.h2Entities >= 3)
    add("directory", 3, "chemin d'annuaire et sous-titres en noms d'entités");
  if (hostMatches(host, path, DOCUMENTATION_HOSTS)) add("documentation", 8, `documentation officielle (${host})`);
  else if (/^(?:docs|developer|developers|support|help|kb|learn|api)\./.test(host)) add("documentation", 6, `sous-domaine de documentation (${host})`);
  else if (/(?:^|\/)(?:docs?|documentation|api-reference|reference|help-center|centre-d-aide)(?:\/|$)/.test(path)) add("documentation", 3, "chemin de documentation");
  if (types.includes("TechArticle") || types.includes("APIReference")) add("documentation", 2, "schéma TechArticle");

  if (hostMatches(host, path, NEWS_HOSTS)) add("news", 7, `média connu (${host})`);
  if (types.some((t) => /NewsArticle$/.test(t) || t === "ReportageNewsArticle")) add("news", 6, "schéma NewsArticle");
  if (types.includes("NewsMediaOrganization")) add("news", 3, "éditeur NewsMediaOrganization");

  if (INSTITUTIONAL_HOST.test(host)) add("institutional", 8, `domaine institutionnel (${host})`);
  if (types.includes("GovernmentOrganization") || types.includes("GovernmentService")) add("institutional", 5, "schéma GovernmentOrganization");
  if (INSTITUTIONAL_TEXT.test(title)) add("institutional", 2, "vocabulaire institutionnel dans le titre");

  // Listicle : « top N », « meilleur(e)s », chiffre dans le titre, ItemList, entités multiples en H2.
  if (/\btop\s?\d{1,3}\b/.test(title)) add("listicle", 5, "« top N » dans le titre");
  if (/\b(?:meilleur(?:e)?s?|best|top)\b/.test(title)) add("listicle", 3, "« meilleur(e)s » ou « best » dans le titre");
  if (/(?<!\d)(?:[3-9]|[1-9]\d)(?!\d)\s+(?:\p{L}+\s+){0,2}?(?:agences?|outils?|entreprises?|firmes?|compagnies?|plateformes?|logiciels?|solutions?|exemples?|conseils?|astuces?|erreurs?|strategies?|tendances?|idees?|facons?|raisons?|agencies|tools|companies|firms|platforms|software|solutions|examples|tips|mistakes|strategies|trends|ideas|ways|reasons)\b/u.test(title))
    add("listicle", 3, "nombre suivi d'un pluriel dans le titre");
  if (types.includes("ItemList")) add("listicle", 3, "schéma ItemList");
  if (signals.h2Entities >= 5) add("listicle", 3, `${signals.h2Entities} sous-titres en noms d'entités`);
  else if (signals.h2Entities >= 3) add("listicle", 1, `${signals.h2Entities} sous-titres en noms d'entités`);
  if (/\b(?:comparatif|comparaison|vs\.?|versus|alternatives?|classement|palmares|ranking|compared)\b/.test(title)) add("listicle", 2, "vocabulaire de comparatif dans le titre");

  // Guide : « comment », « guide », « étapes », HowTo, sous-titres en questions.
  if (/\b(?:comment|how to|how do|how does|how can)\b/.test(title)) add("guide", 4, "« comment » ou « how to » dans le titre");
  if (/\b(?:guide|tutoriel|tutorial|mode d'emploi|walkthrough|explication|explained|definition|qu'est-ce|what is|pourquoi|why)\b/.test(title)) add("guide", 3, "« guide », « tutoriel » ou question dans le titre");
  if (/\b(?:etapes?|steps?)\b/.test(title) || signals.headings.filter((h) => /^(?:etape|step)\s?\d/.test(normalizeText(h.text))).length >= 2) add("guide", 3, "étapes numérotées");
  if (types.includes("HowTo")) add("guide", 4, "schéma HowTo");
  if (signals.h2Questions >= 3) add("guide", 2, `${signals.h2Questions} sous-titres en questions`);
  if (types.some((t) => /^(?:Article|BlogPosting|TechArticle)$/.test(t)) && signals.wordCount >= 800) add("guide", 1, "article long");

  // Service : « nos services », formulaire de contact, « à partir de », CTA de soumission, schéma Service.
  const cues = signals.serviceCues;
  if (cues.ourServices) add("service", 2, "« nos services »");
  if (cues.contactForm) add("service", 2, "formulaire de contact");
  if (cues.priceFrom) add("service", 2, "prix « à partir de »");
  if (cues.quoteCta) add("service", 3, "appel à une soumission ou un devis");
  if (types.some((t) => /^(?:Service|ProfessionalService|LocalBusiness|MarketingAgency|Offer|Product)$/.test(t))) add("service", 3, "schéma Service, LocalBusiness ou Product");
  if (/(?:^|\/)(?:services?|prestations?|expertises?|solutions?|offres?|pricing|tarifs?)(?:\/|$)/.test(path)) add("service", 2, "chemin de page de service");
  if (/\b(?:agence|agency|firme|cabinet|entreprise|company|expert|specialiste|consultant)\b/.test(title) && !/\b(?:meilleur|best|top|comment|guide)\b/.test(title))
    add("service", 2, "titre de page de prestataire");

  // Départage : un listicle de site d'agence parle souvent de « nos services » dans un encart. La liste prime sur la vente.
  const ranked = (Object.keys(tally) as PageType[])
    .filter((t) => t !== "other")
    .map((t) => ({ type: t, ...tally[t] }))
    .sort((a, b) => b.points - a.points);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.points < 3) {
    return { type: "other", confidence: 0.3, reasons: ["aucun indice suffisant"] };
  }
  const margin = top.points - (second?.points ?? 0);
  const confidence = Math.max(0.35, Math.min(0.95, 0.4 + 0.06 * top.points + 0.05 * margin));
  return { type: top.type, confidence: Math.round(confidence * 100) / 100, reasons: top.reasons };
}
