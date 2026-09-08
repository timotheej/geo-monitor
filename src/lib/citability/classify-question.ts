/**
 * Classification heuristique d'une question (type et lieu), sans modèle. Le modèle affinera plus tard,
 * l'heuristique doit tenir seule pour les modificateurs de B1 et pour le repli sans juge.
 */

import { findTerm, normalizeText } from "@/lib/detection";

export type QuestionIntent = "comparative" | "informational" | "price" | "local" | "resource";

export type QuestionClass = { intent: QuestionIntent; place?: string };

export const INTENT_LABEL: Record<QuestionIntent, string> = {
  comparative: "comparative",
  informational: "informationnelle",
  price: "prix",
  local: "locale",
  resource: "ressource",
};

/** Villes et provinces du Québec et du Canada courantes dans nos questions. Forme canonique renvoyée telle quelle. */
export const KNOWN_PLACES = [
  "Montréal", "Québec", "Laval", "Gatineau", "Longueuil", "Sherbrooke", "Saguenay", "Lévis", "Trois-Rivières", "Terrebonne",
  "Brossard", "Repentigny", "Drummondville", "Saint-Jérôme", "Granby", "Blainville", "Saint-Hyacinthe", "Shawinigan", "Rimouski",
  "Boucherville", "Mirabel", "Chicoutimi", "Rouyn-Noranda", "Victoriaville", "Joliette", "Mascouche", "Châteauguay", "Vaudreuil-Dorion",
  "Rive-Sud", "Rive-Nord", "Laurentides", "Montérégie", "Mauricie", "Estrie", "Outaouais", "Gaspésie", "Abitibi", "Lanaudière", "Beauce",
  "Ottawa", "Toronto", "Vancouver", "Calgary", "Edmonton", "Winnipeg", "Halifax", "Mississauga", "Brampton", "Hamilton", "Kitchener",
  "Waterloo", "London", "Victoria", "Regina", "Saskatoon", "Moncton", "Fredericton", "Saint John", "St. John's", "Charlottetown",
  "Markham", "Vaughan", "Oakville", "Burlington", "Burnaby", "Surrey", "Richmond", "Kelowna", "Windsor", "Oshawa", "Barrie", "Guelph",
  "Ontario", "Alberta", "Colombie-Britannique", "British Columbia", "Manitoba", "Saskatchewan", "Nouvelle-Écosse", "Nova Scotia",
  "Nouveau-Brunswick", "New Brunswick", "Île-du-Prince-Édouard", "Prince Edward Island", "Terre-Neuve", "Newfoundland", "Yukon",
  "Nunavut", "Territoires du Nord-Ouest", "Northwest Territories", "Canada", "Quebec City",
];

const PRICE_RE = /\b(?:combien|cout|couts|coute|coutent|prix|tarif|tarifs|tarification|budget|honoraires|facture|cher|abordable|gratuit|cost|costs|price|prices|pricing|rates?|fees?|budget|expensive|affordable|cheap|how much)\b/;
const RESOURCE_RE = /\b(?:formations?|podcasts?|cours|livres?|ressources?|webinaires?|webinars?|conferences?|evenements?|newsletters?|blogs?|chaines?|videos?|templates?|gabarits?|modeles?|checklists?|outils?|logiciels?|plugins?|extensions?|certifications?|courses?|books?|resources?|tools?|software|channels?|events?|communautes?|communities|ou trouver|ou apprendre|ou suivre|where to find|where to learn|where can i find)\b/;
const COMPARATIVE_RE = /\b(?:meilleur|meilleure|meilleurs|meilleures|best|top|quelle agence|quelles agences|quel prestataire|quelle entreprise|quelle firme|quel cabinet|quelle plateforme|quel logiciel|quelle solution|which agency|which company|which firm|which platform|which solution|comparatif|comparaison|comparer|compare|comparison|vs\.?|versus|alternatives?|classement|ranking|recommand[ée]e?s?|recommend(?:ed|ations?)?|leaders?|reference|references|top rated|highest rated|mieux note[es]?|fiables?|reputees?|reputable|trusted|serieuses?)\b/;
const INFORMATIONAL_RE = /\b(?:comment|pourquoi|qu'est-ce|qu'est ce|c'est quoi|quoi|definition|definir|explique|expliquer|signifie|fonctionne|difference|differences|how|why|what is|what are|what does|explain|meaning|definition|works?)\b/;

/** Lieu connu présent dans le texte (accents ignorés), renvoyé sous sa forme canonique. Les lieux les plus longs sont testés en premier (« Quebec City » avant « Québec »). */
export function findPlace(text: string): string | undefined {
  const norm = normalizeText(text);
  const ordered = [...KNOWN_PLACES].sort((a, b) => b.length - a.length);
  let best: { place: string; index: number } | undefined;
  for (const place of ordered) {
    const idx = findTerm(norm, place);
    if (idx >= 0 && (!best || idx < best.index)) best = { place, index: idx };
  }
  return best?.place;
}

/**
 * Ordre de décision : prix, ressource, comparatif, informationnel, puis local si un lieu est nommé sans autre intention.
 * Une question « meilleure agence SEO à Montréal » est comparative avec lieu ; le lieu module B1, il ne change pas le type.
 */
export function classifyQuestionHeuristic(text: string, lang = "fr"): QuestionClass {
  void lang; // Les listes couvrent le français et l'anglais ; la langue servira au modèle.
  const norm = normalizeText(text);
  const place = findPlace(text);
  let intent: QuestionIntent;
  if (PRICE_RE.test(norm)) intent = "price";
  else if (RESOURCE_RE.test(norm)) intent = "resource";
  else if (COMPARATIVE_RE.test(norm)) intent = "comparative";
  else if (INFORMATIONAL_RE.test(norm)) intent = "informational";
  else if (place) intent = "local";
  else intent = "informational";
  return place ? { intent, place } : { intent };
}

const STOPWORDS = new Set(
  (
    "le la les un une des du de d l au aux et ou en a à pour par sur dans avec sans sous vers chez est sont ce cette ces cet " +
    "qui que quoi dont quel quelle quels quelles comment pourquoi combien quand ou où est-ce il elle ils elles on nous vous je tu " +
    "mon ma mes ton ta tes son sa ses notre votre leur leurs plus moins tres bien mal tout tous toute toutes faire fait faut peut " +
    "peux pouvez doit dois devez avoir ai as avons avez ont etre suis es sommes etes meilleur meilleure meilleurs meilleures " +
    "the a an of to in on at for by with from and or is are was were be been being do does did have has had what which who whom " +
    "how why when where this that these those it its they them their our your my me you we i can could should would will may " +
    "might must best top most good better there here about into than then also just very not no yes"
  ).split(/\s+/),
);

/** Termes clés d'une question : mots de 3 lettres ou plus, sans mots-outils ni marqueurs d'intention, dédoublonnés. */
export function keyTerms(text: string): string[] {
  const words = normalizeText(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}
