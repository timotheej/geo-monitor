/**
 * Extraction pure des signaux de citabilité (lot 2 de l'indice, docs/indice-citabilite.md, section 4).
 * HTML brut en entrée, aucun réseau, aucune base, aucun modèle. Étend `extractPage` sans le dupliquer.
 */

import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { extractPage, type PageInfo } from "@/lib/inspect/extract";
import { normalizeUrl } from "@/lib/inspect/url";
import { findTerm, normalizeText } from "@/lib/detection";

export type SnippetDirective = "nosnippet" | "max-snippet:0" | "noindex" | "noai" | "noimageai";

export type Heading = { level: 2 | 3; text: string };

/** Sous-titre et amorce de la section (80 mots max), pour la recherche d'un passage de réponse directe. */
export type Section = { heading: string; lead: string };

export type ServiceCues = {
  /** Formulaire avec courriel, téléphone ou zone de texte, ou action « contact » */
  contactForm: boolean;
  /** « à partir de 500 $ », « starting at $500 », « from $500 » */
  priceFrom: boolean;
  /** « demander une soumission », « obtenir un devis », « request a quote » */
  quoteCta: boolean;
  /** « nos services », « our services » */
  ourServices: boolean;
};

export type PageSignals = PageInfo & {
  url: string;
  host: string;
  h3: string[];
  headings: Heading[];
  sections: Section[];
  dateModified: string | null;
  datePublished: string | null;
  author: string | null;
  /** Fonction de l'auteur (jobTitle JSON-LD ou « par X, directeur SEO ») */
  authorRole: string | null;
  personSchema: boolean;
  organizationSchema: boolean;
  sameAs: string[];
  aboutContactLinks: boolean;
  outboundLinks: number;
  outboundDomains: string[];
  numbersCount: number;
  listsCount: number;
  tablesCount: number;
  hasFaq: boolean;
  hasSummaryBlock: boolean;
  h2Questions: number;
  h2Entities: number;
  quoteCount: number;
  textInFirstQuarter: string;
  titleYear: number | null;
  /** null si `opts.place` absent */
  placeMentioned: boolean | null;
  /** null si `opts.questionLang` absent ou langue de la page indéterminable */
  langMatches: boolean | null;
  snippetDirectives: SnippetDirective[];
  canonicalSelf: boolean;
  brandName: string | null;
  /** Nom de marque présent dans le titre, l'en-tête et le pied de page */
  brandConsistent: boolean;
  serviceCues: ServiceCues;
};

export type ExtractSignalsOptions = { url: string; questionLang?: string; place?: string };

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/* ----------------------------------------------------------------------------
 * Dates : ISO, « 12 mars 2026 », « March 12, 2026 », « 12/03/2026 ». Retourne YYYY-MM-DD.
 * -------------------------------------------------------------------------- */

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, january: 1,
  fevrier: 2, fev: 2, feb: 2, february: 2,
  mars: 3, mar: 3, march: 3,
  avril: 4, avr: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6, june: 6,
  juillet: 7, juil: 7, jul: 7, july: 7,
  aout: 8, aug: 8, august: 8,
  septembre: 9, sept: 9, sep: 9, september: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  decembre: 12, dec: 12, december: 12,
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");
/** Sur texte normalisé (minuscules, sans accents). Groupe 1 : la date. */
const DATE_RE = new RegExp(
  `((?:19|20)\\d{2}-\\d{2}-\\d{2}(?:t[\\d:.+z-]*)?` +
    `|\\b\\d{1,2}(?:er)?\\s+(?:${MONTH_ALT})\\.?\\s+(?:19|20)\\d{2}` +
    `|\\b(?:${MONTH_ALT})\\.?\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}` +
    `|\\b\\d{1,2}[/.]\\d{1,2}[/.](?:19|20)\\d{2})`,
  "i",
);

const pad = (n: number) => String(n).padStart(2, "0");

/** Convertit une date écrite en YYYY-MM-DD, ou null. `lang` départage 03/04/2026 (jour/mois en français). */
export function parseWrittenDate(raw: string, lang = "fr"): string | null {
  const s = normalizeText(raw).trim();
  let m = /^((?:19|20)\d{2})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = new RegExp(`^(\\d{1,2})(?:er)?\\s+(${MONTH_ALT})\\.?\\s+((?:19|20)\\d{2})`).exec(s);
  if (m) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(Number(m[1]))}`;
  m = new RegExp(`^(${MONTH_ALT})\\.?\\s+(\\d{1,2}),?\\s+((?:19|20)\\d{2})`).exec(s);
  if (m) return `${m[3]}-${pad(MONTHS[m[1]])}-${pad(Number(m[2]))}`;
  m = /^(\d{1,2})[/.](\d{1,2})[/.]((?:19|20)\d{2})/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const dayFirst = lang !== "en" || a > 12;
    const [day, month] = dayFirst ? [a, b] : [b, a];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${m[3]}-${pad(month)}-${pad(day)}`;
  }
  return null;
}

/** Date qui suit un marqueur (« mis à jour le », « updated on », « publié le ») dans un texte normalisé. */
function dateAfterMarker(normalized: string, markers: RegExp, lang: string): string | null {
  const re = new RegExp(`(?:${markers.source})\\s*(?:le|on|:|-)?\\s*${DATE_RE.source}`, "i");
  const m = re.exec(normalized);
  return m ? parseWrittenDate(m[1], lang) : null;
}

const UPDATED_MARKERS = /mise? a jour|derniere mise a jour|derniere modification|modifie le|updated|last updated|last modified|revised/;
const PUBLISHED_MARKERS = /publie le|publie|date de publication|published on|published|posted on/;

/* ----------------------------------------------------------------------------
 * JSON-LD : parcours récursif de tous les nœuds.
 * -------------------------------------------------------------------------- */

type LdNode = Record<string, unknown>;

function ldNodes(html: string): LdNode[] {
  const out: LdNode[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === "object") {
      const n = v as LdNode;
      if (n["@type"]) out.push(n);
      for (const k of Object.keys(n)) if (k !== "@context") visit(n[k]);
    }
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      /* JSON invalide, ignoré */
    }
  }
  return out;
}

const typesOf = (n: LdNode): string[] => {
  const t = n["@type"];
  return (Array.isArray(t) ? t : [t]).map(String);
};

const ORG_TYPES = /^(Organization|LocalBusiness|Corporation|ProfessionalService|MarketingAgency|NewsMediaOrganization|EducationalOrganization|GovernmentOrganization|NGO|OnlineBusiness|Store|MedicalOrganization|.*Business|.*Agency|.*Organization)$/;

const strOf = (v: unknown): string | null => {
  if (typeof v === "string") return clean(v) || null;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const n = v as LdNode;
    return typeof n.name === "string" ? clean(n.name) || null : null;
  }
  if (Array.isArray(v)) return strOf(v[0]);
  return null;
};

/* ----------------------------------------------------------------------------
 * Texte principal : même délimitation que extractPage (main/article, sans nav, header, footer, aside, form).
 * -------------------------------------------------------------------------- */

/** Texte d'un ensemble d'éléments avec un espace entre chaque nœud texte (cheerio colle « RablabServices » sinon). */
function spacedText($: CheerioAPI, selector: string): string {
  return clean(
    $(selector)
      .find("*")
      .addBack()
      .contents()
      .filter((_, n) => n.type === "text")
      .map((_, n) => ("data" in n ? String(n.data) : ""))
      .get()
      .join(" "),
  );
}

function mainScope($: CheerioAPI) {
  const main = $("main, article, [role=main]").first();
  const scope = (main.length ? main : $("body")).clone();
  scope.find("nav, header, footer, aside, form").remove();
  return scope;
}

/* ----------------------------------------------------------------------------
 * Sous-titres : question ou entité.
 * -------------------------------------------------------------------------- */

const QUESTION_START =
  /^(comment|pourquoi|quel(le)?s?|combien|qu'est|qu’est|qu'|est-ce|ou|quand|qui|que|faut-il|peut-on|doit-on|how|why|what|which|when|where|who|is|are|can|should|does|do|will)(?![\p{L}])/u;

export function isQuestionHeading(text: string): boolean {
  const t = normalizeText(text).trim();
  if (!t) return false;
  return t.endsWith("?") || QUESTION_START.test(t);
}

/** Verbes fréquents qui trahissent une phrase plutôt qu'un nom d'entité. */
const VERB_WORDS = new Set([
  "est", "sont", "etre", "avoir", "a", "ont", "faire", "fait", "choisir", "utiliser", "creer", "ameliorer", "optimiser",
  "trouver", "obtenir", "definir", "comprendre", "mesurer", "eviter", "commencer", "analyser", "installer", "configurer",
  "is", "are", "be", "have", "has", "do", "does", "make", "choose", "use", "using", "create", "improve", "optimize",
  "find", "get", "define", "understand", "measure", "avoid", "start", "analyze", "install", "configure", "how", "why", "what",
]);
/** Titres génériques qui ne sont pas des entités. */
const GENERIC_HEADINGS = new Set([
  "introduction", "conclusion", "faq", "resume", "sommaire", "sources", "references", "en bref", "a propos", "contact",
  "methodologie", "table des matieres", "points cles", "a retenir", "summary", "key takeaways", "tl;dr", "overview",
  "related articles", "articles similaires", "commentaires", "comments", "notes", "annexe", "appendix",
]);

export function isEntityHeading(text: string): boolean {
  const original = clean(text).replace(/^(?:#|n[°o]\s?)?\d{1,3}\s*(?:[.):-]|\s)\s*/u, "");
  if (!original || original.endsWith("?")) return false;
  if (!/^[\p{Lu}]/u.test(original)) return false;
  const words = original.split(/\s+/);
  if (words.length < 1 || words.length > 5) return false;
  const norm = normalizeText(original);
  if (GENERIC_HEADINGS.has(norm)) return false;
  return !norm.split(/[\s'’]+/).some((w) => VERB_WORDS.has(w));
}

/* ----------------------------------------------------------------------------
 * Données chiffrées : prix, pourcentages, dates, durées, chiffres avec unité. Une alternance, chaque valeur comptée une fois.
 * -------------------------------------------------------------------------- */

const NUM = "\\d+(?:[ \\u00a0,.]\\d{3})*(?:[.,]\\d+)?";
const NUMBERS_RE = new RegExp(
  [
    `[$€£]\\s?${NUM}`,
    `${NUM}\\s?(?:[$€£]|cad|usd|eur|dollars?|euros?)(?![\\p{L}])`,
    `${NUM}\\s?(?:%|pour cent|percent)`,
    `(?:19|20)\\d{2}-\\d{2}-\\d{2}`,
    `\\d{1,2}(?:er)?\\s+(?:${MONTH_ALT})\\.?\\s+(?:19|20)\\d{2}`,
    `(?:${MONTH_ALT})\\.?\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}`,
    `\\d{1,2}[/.]\\d{1,2}[/.](?:19|20)\\d{2}`,
    `(?<![\\d-])(?:19|20)\\d{2}(?![\\d-])`,
    `${NUM}\\s?(?:ans?|annees?|mois|semaines?|jours?|heures?|minutes?|secondes?|h|min|ms|years?|months?|weeks?|days?|hours?|seconds?)(?![\\p{L}])`,
    `${NUM}\\s?(?:km|m|cm|mm|kg|g|go|mo|ko|gb|mb|kb|px|mots|words|pages|employes|clients|projets|avis|reviews|etoiles|stars|utilisateurs|users|visites|visits|sessions|k|m)(?![\\p{L}])`,
  ].join("|"),
  "giu",
);

export function countNumbers(text: string): number {
  return Array.from(normalizeText(text).matchAll(NUMBERS_RE)).length;
}

/* ----------------------------------------------------------------------------
 * Citations attribuées : « … » suivies ou précédées d'un verbe de parole ou d'une source.
 * -------------------------------------------------------------------------- */

const QUOTE_ATTRIB_AFTER = /[«"“][^»"”]{20,400}[»"”]\s*[,.]?\s*(?:[-–—]|a\s+(?:declare|affirme|explique|precise|souligne|indique|dit|confie)|(?:declare|affirme|explique|precise|souligne|indique|dit|confie|selon|says|said|explains|notes|according to)\b)/giu;
const QUOTE_ATTRIB_BEFORE = /(?:selon|d'apres|pour|comme le (?:dit|rappelle|souligne)|according to|as)\s+[^.«"“]{2,60}[,:]?\s*[«"“][^»"”]{20,400}[»"”]/giu;

function countQuotes(scope: ReturnType<typeof mainScope>, text: string): number {
  const blocks = scope.find("blockquote").length;
  const testimonials = scope.find("[class*=testimonial], [class*=temoignage], [itemprop=review]").not("blockquote *").length;
  const norm = normalizeText(text);
  const attributed = (norm.match(QUOTE_ATTRIB_AFTER)?.length ?? 0) + (norm.match(QUOTE_ATTRIB_BEFORE)?.length ?? 0);
  return blocks + testimonials + attributed;
}

/** « par Prénom Nom, fonction ». Pas de drapeau i : la majuscule initiale du nom fait partie du critère. */
const BYLINE_RE =
  /(?:^|[\s>|,.(])(?:[Rr]édigé |[Éé]crit |[Pp]ublié |[Ww]ritten |[Pp]osted )?(?:[Pp]ar|[Bb]y)\s+([\p{Lu}][\p{L}'’.-]+(?:\s+(?:de |du |d'|le |la )?[\p{Lu}][\p{L}'’.-]+){0,3})(?:\s*,\s*([^,.|\n\d]{3,60}?))?(?=\s*(?:[,.|;)]|le\s|on\s|$|\d))/u;
const BYLINE_EXCLUDE = /^(google|microsoft|openai|anthropic|exemple|example|defaut|default|rapport|contre|jour|semaine|mois|an|email|courriel|telephone|la|le|les|the|a|an|our|notre|nos|des|ailleurs|consequent|rapport)$/;

/* ----------------------------------------------------------------------------
 * Liens sortants : autres domaines racines, hors réseaux sociaux.
 * -------------------------------------------------------------------------- */

const SOCIAL_HOSTS = [
  "facebook.com", "fb.com", "fb.me", "twitter.com", "x.com", "t.co", "linkedin.com", "lnkd.in", "instagram.com", "youtube.com",
  "youtu.be", "tiktok.com", "pinterest.com", "pinterest.ca", "threads.net", "whatsapp.com", "wa.me", "t.me", "telegram.org",
  "snapchat.com", "reddit.com", "messenger.com", "vimeo.com", "flickr.com", "tumblr.com", "mastodon.social", "bsky.app",
];
const CC_SLD = /\.(?:qc|gc|on|bc|ab|mb|sk|ns|nb|pe|nl|nt|nu|yt)\.ca$|\.(?:co|org|gov|ac|edu|net)\.(?:uk|au|nz|za|jp|in|br|mx)$|\.gouv\.(?:fr|qc\.ca)$/;

/** Domaine enregistrable approximatif : deux étiquettes, trois pour les ccSLD connus (gouv.qc.ca, co.uk). */
export function rootDomain(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, "");
  const parts = h.split(".");
  const keep = CC_SLD.test(h) ? 3 : 2;
  return parts.slice(-keep).join(".");
}

const hostOf = (href: string): string | null => {
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

/* ----------------------------------------------------------------------------
 * Langue : lang HTML, sinon comptage de mots-outils.
 * -------------------------------------------------------------------------- */

const FR_STOP = /\b(le|la|les|des|une|pour|dans|avec|sur|est|sont|vous|nous|que|qui|pas|plus|votre|ce|cette|aux|du)\b/g;
const EN_STOP = /\b(the|and|of|to|with|for|that|this|your|you|are|is|on|from|by|our|it|as|be|or|an)\b/g;

export function guessLang(text: string): "fr" | "en" | "" {
  const sample = normalizeText(text).split(" ").slice(0, 600).join(" ");
  const fr = sample.match(FR_STOP)?.length ?? 0;
  const en = sample.match(EN_STOP)?.length ?? 0;
  if (fr + en < 8) return "";
  if (fr > en * 1.5) return "fr";
  if (en > fr * 1.5) return "en";
  return "";
}

/* ----------------------------------------------------------------------------
 * Extraction principale.
 * -------------------------------------------------------------------------- */

const ABOUT_CONTACT = /(?:^|\/)(?:about(?:-us)?|a-propos|apropos|qui-sommes-nous|contact(?:ez-nous|-us)?|equipe|team|notre-equipe|our-team|nous-joindre)(?:\/|$|[?#.])/i;
const ABOUT_CONTACT_TEXT = /^(?:a propos|about|about us|qui sommes-nous|contact|contactez-nous|contact us|nous joindre|equipe|notre equipe|l'equipe|team|our team)$/;

const SUMMARY_RE = /^(?:en bref|en resume|resume|tl;?dr|points cles|les points cles|a retenir|l'essentiel|ce qu'il faut retenir|key takeaways|takeaways|summary|in short|in brief|quick summary|at a glance)\b/;
const FAQ_RE = /\b(?:faq|questions? frequentes|questions? frequemment posees|foire aux questions|frequently asked questions?|questions? & reponses|q&a)\b/;

export function extractSignals(html: string, opts: ExtractSignalsOptions): PageSignals {
  const base = extractPage(html);
  const $ = cheerio.load(html);
  const nodes = ldNodes(html);

  const pageHost = hostOf(opts.url) ?? "";
  const pageRoot = pageHost ? rootDomain(pageHost) : "";

  // Texte complet du corps (pour dates et signature) avant nettoyage, sans scripts.
  const bodyClone = $("body").clone();
  bodyClone.find("script, style, noscript, svg, iframe").remove();
  const bodyText = clean(bodyClone.text());
  const bodyNorm = normalizeText(bodyText);

  $("script, style, noscript, svg, iframe").remove();
  const scope = mainScope($);
  const mainText = clean(scope.text());
  const wordCount = countWords(mainText);

  const lang = base.lang || guessLang(mainText || bodyText);
  const meta = (name: string) => clean($(`meta[name="${name}"], meta[property="${name}"]`).first().attr("content") ?? "");

  // Dates
  const ldModified = nodes.map((n) => n.dateModified).find((v): v is string => typeof v === "string") ?? null;
  const dateModified =
    meta("article:modified_time") ||
    meta("og:updated_time") ||
    ldModified ||
    ($("time[itemprop=dateModified]").attr("datetime") ?? "") ||
    dateAfterMarker(bodyNorm, UPDATED_MARKERS, lang) ||
    null;
  const datePublished = base.publishedAt || dateAfterMarker(bodyNorm, PUBLISHED_MARKERS, lang) || null;

  // Auteur
  const ldAuthorNode = nodes.map((n) => n.author).find((a) => a && typeof a === "object") as LdNode | LdNode[] | undefined;
  const ldAuthor = ldAuthorNode ? strOf(ldAuthorNode) : (nodes.map((n) => n.author).find((a): a is string => typeof a === "string") ?? null);
  const ldAuthorSingle = Array.isArray(ldAuthorNode) ? ldAuthorNode[0] : ldAuthorNode;
  let authorRole: string | null = ldAuthorSingle && typeof ldAuthorSingle.jobTitle === "string" ? clean(ldAuthorSingle.jobTitle) : null;
  const relAuthor = clean($("a[rel~=author], [rel=author]").first().text());
  const itemAuthor = clean($("[itemprop=author] [itemprop=name], [itemprop=author], .author-name, .byline .author, [class*=author-name]").first().text());
  // Signature « par Prénom Nom, fonction » ou « by First Last », dans les 2 000 premiers caractères du corps.
  let byline: string | null = null;
  const bm = BYLINE_RE.exec(bodyText.slice(0, 2000));
  if (bm && !BYLINE_EXCLUDE.test(normalizeText(bm[1]).split(" ")[0])) {
    byline = clean(bm[1]);
    if (!authorRole && bm[2] && countWords(bm[2]) <= 6) authorRole = clean(bm[2]);
  }
  const author = clean(meta("author")) || ldAuthor || relAuthor || itemAuthor || byline || null;

  const personSchema = nodes.some((n) => typesOf(n).includes("Person"));
  const organizationSchema = nodes.some((n) => typesOf(n).some((t) => ORG_TYPES.test(t)));
  const sameAs = Array.from(
    new Set(
      nodes.flatMap((n) => {
        const v = n.sameAs;
        return (Array.isArray(v) ? v : v ? [v] : []).filter((s): s is string => typeof s === "string");
      }),
    ),
  );

  // Liens : à propos et contact sur toute la page (souvent dans nav ou pied), sortants dans le corps.
  let aboutContactLinks = false;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const txt = normalizeText(clean($(el).text()));
    if (ABOUT_CONTACT.test(href.split("?")[0]) || ABOUT_CONTACT_TEXT.test(txt)) aboutContactLinks = true;
  });
  const outbound = new Set<string>();
  const outboundDomains = new Set<string>();
  scope.find("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    const host = hostOf(href);
    if (!host) return;
    const root = rootDomain(host);
    if (pageRoot && root === pageRoot) return;
    if (SOCIAL_HOSTS.some((s) => host === s || host.endsWith(`.${s}`))) return;
    outbound.add(href.replace(/#.*$/, ""));
    outboundDomains.add(root);
  });

  // Structure
  const headings: Heading[] = [];
  scope.find("h2, h3").each((_, el) => {
    const text = clean($(el).text());
    if (text) headings.push({ level: el.tagName.toLowerCase() === "h2" ? 2 : 3, text });
  });
  const h3 = headings.filter((h) => h.level === 3).map((h) => h.text).slice(0, 40);
  const sections: Section[] = [];
  scope.find("h2, h3").each((_, el) => {
    const heading = clean($(el).text());
    if (!heading || sections.length >= 40) return;
    const lead = clean($(el).nextUntil("h1, h2, h3, h4").text()).split(/\s+/).slice(0, 80).join(" ");
    sections.push({ heading, lead });
  });
  const listsCount = scope.find("ul, ol").filter((_, el) => $(el).children("li").length >= 2).length;
  const tablesCount = scope.find("table").length;
  const questionHeadings = headings.filter((h) => isQuestionHeading(h.text)).length;
  const headingTexts = headings.map((h) => normalizeText(h.text));
  const hasFaq =
    base.jsonLdTypes.includes("FAQPage") ||
    headingTexts.some((t) => FAQ_RE.test(t)) ||
    scope.find("[class*=faq], [id*=faq]").length > 0 ||
    headings.filter((h) => h.text.trim().endsWith("?")).length >= 3;
  const summaryCandidates = scope
    .find("h2, h3, h4, strong, b, summary, [class*=summary], [class*=resume], [class*=tldr], [class*=takeaway], [class*=key-points], [id*=summary], [id*=resume], [id*=tldr]")
    .map((_, el) => normalizeText(clean($(el).text())).slice(0, 60))
    .get();
  const hasSummaryBlock =
    summaryCandidates.some((t) => SUMMARY_RE.test(t)) ||
    scope.find("[class*=summary], [class*=tldr], [class*=takeaway], [class*=key-points], [id*=tldr]").length > 0;

  // Premier quart : au moins 120 mots quand la page en a, pour laisser place à un passage de réponse.
  const words = mainText ? mainText.split(" ") : [];
  const quarter = Math.max(Math.ceil(words.length / 4), Math.min(words.length, 120));
  const textInFirstQuarter = words.slice(0, quarter).join(" ");

  const titleYear = (() => {
    const m = /(?<!\d)(202\d|2030)(?!\d)/.exec(`${base.title} ${base.h1}`);
    return m ? Number(m[1]) : null;
  })();

  let placeMentioned: boolean | null = null;
  if (opts.place?.trim()) {
    const zones = [base.title, base.h1, ...headings.map((h) => h.text), textInFirstQuarter].map((z) => normalizeText(z));
    placeMentioned = zones.some((z) => findTerm(z, opts.place as string) >= 0);
  }

  let langMatches: boolean | null = null;
  if (opts.questionLang?.trim()) {
    const q = opts.questionLang.trim().toLowerCase().slice(0, 2);
    langMatches = lang ? lang === q : null;
  }

  const robotsValues = $("meta[name]")
    .filter((_, el) => /^(robots|googlebot|bingbot|.*bot)$/i.test($(el).attr("name") ?? ""))
    .map((_, el) => ($(el).attr("content") ?? "").toLowerCase())
    .get()
    .join(",");
  const snippetDirectives: SnippetDirective[] = [];
  for (const d of ["nosnippet", "max-snippet:0", "noindex", "noai", "noimageai"] as const) {
    const re = new RegExp(`(?:^|[\\s,])${d.replace(/[.:]/g, "\\$&")}(?:$|[\\s,])`);
    if (re.test(robotsValues)) snippetDirectives.push(d);
  }

  let canonicalSelf = true;
  if (base.canonical) {
    let abs: string | null = null;
    try {
      abs = new URL(base.canonical, opts.url).toString();
    } catch {
      abs = null;
    }
    const a = abs ? normalizeUrl(abs) : null;
    const b = normalizeUrl(opts.url);
    canonicalSelf = a === null || b === null ? true : a === b;
  }

  // Marque : og:site_name, Organization JSON-LD, sinon suffixe du titre après « | » ou « - ».
  const orgName = nodes.filter((n) => typesOf(n).some((t) => ORG_TYPES.test(t))).map((n) => strOf(n.name)).find(Boolean) ?? null;
  const titleSuffix = base.title.split(/\s+[|·•]\s+|\s+-\s+/).pop();
  const brandName = meta("og:site_name") || orgName || (titleSuffix && titleSuffix !== base.title ? clean(titleSuffix) : null) || null;
  let brandConsistent = false;
  if (brandName) {
    const b = normalizeText(brandName);
    const headerText = normalizeText(spacedText($, "header, [role=banner]"));
    const footerText = normalizeText(spacedText($, "footer, [role=contentinfo]"));
    const titleText = normalizeText(base.title);
    brandConsistent = findTerm(titleText, b) >= 0 && findTerm(headerText, b) >= 0 && findTerm(footerText, b) >= 0;
  }

  const formEls = $("form");
  const contactForm =
    formEls.filter((_, el) => {
      const f = $(el);
      const action = (f.attr("action") ?? "").toLowerCase();
      return /contact|soumission|devis|quote|lead/.test(action) || f.find("input[type=email], input[type=tel], textarea").length > 0;
    }).length > 0;
  const serviceCues: ServiceCues = {
    contactForm,
    priceFrom: /(?:a partir de|des|starting (?:at|from)|from)\s*[$€£]?\s?\d[\d\s,.]*\s?(?:[$€£]|cad|usd|eur|\/)/.test(bodyNorm),
    quoteCta: /(?:demander|obtenir|demandez|obtenez|recevoir|recevez)\s+(?:une |un |votre )?(?:soumission|devis|estimation|consultation)|(?:request|get)\s+(?:a |your )?(?:free )?(?:quote|proposal|consultation)|free quote|soumission gratuite|devis gratuit/.test(bodyNorm),
    ourServices: /\bnos services\b|\bour services\b|\bnos prestations\b|\bnos expertises\b/.test(bodyNorm),
  };


  return {
    ...base,
    lang,
    wordCount,
    url: opts.url,
    host: pageHost,
    h3,
    headings,
    sections,
    dateModified,
    datePublished,
    author,
    authorRole,
    personSchema,
    organizationSchema,
    sameAs,
    aboutContactLinks,
    outboundLinks: outbound.size,
    outboundDomains: Array.from(outboundDomains).sort(),
    numbersCount: countNumbers(mainText),
    listsCount,
    tablesCount,
    hasFaq,
    hasSummaryBlock,
    h2Questions: questionHeadings,
    h2Entities: headings.filter((h) => isEntityHeading(h.text)).length,
    quoteCount: countQuotes(scope, mainText),
    textInFirstQuarter,
    titleYear,
    placeMentioned,
    langMatches,
    snippetDirectives,
    canonicalSelf,
    brandName,
    brandConsistent,
    serviceCues,
  };
}
