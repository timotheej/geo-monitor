/**
 * Application de la grille de la section 4 (docs/indice-citabilite.md) : Accès sur 20, Contenu sur 40.
 * Pur : aucune récupération, aucun modèle. Le juge (JudgeNotes) est optionnel ; sans lui, B1 et B2 reposent
 * sur les heuristiques seules (voir `fallbackFit` et `fallbackDirectAnswer`), et la note de spécificité de B4 vaut 0.
 */

import type { PageSignals } from "./signals";
import { detectPageType, type PageType } from "./page-type";
import { keyTerms, type QuestionIntent } from "./classify-question";
import { normalizeText } from "@/lib/detection";

export const GRID_VERSION = "2026-09-08.1";

export type SignalScore = {
  key: string;
  label: string;
  value: string | number | boolean | null;
  points: number;
  max: number;
  note: string;
};

export type ScoreResult = {
  total: number;
  max: number;
  rows: SignalScore[];
  /** Plafonds ou effets de seuil appliqués, en clair */
  caps: string[];
  gridVersion: typeof GRID_VERSION;
};

export type RobotsInput = { allAllowed: boolean; blockedAgents: string[] };
export type HttpInput = { status: number; responseMs: number; redirects: number };
export type AccessExtras = { llmsTxt?: boolean | null };

export type JudgeNotes = { fit: 0 | 1 | 2 | 3; directAnswer: 0 | 1 | 2 | 3; specificity: 0 | 1 | 2 | 3 };

export type ContentScoringOptions = {
  /** Type de page déjà décidé (heuristique confirmée par le modèle) ; sinon `detectPageType` */
  pageType?: PageType;
  /** Type de la question, pour le repli B1 sans juge */
  questionIntent?: QuestionIntent;
  /** Texte de la question, pour le repli B2 (termes clés) */
  question?: string;
  /** Termes clés déjà calculés ; priment sur `question` */
  questionTerms?: string[];
  /** Date de référence pour la fraîcheur (tests) */
  now?: Date;
};

const row = (key: string, label: string, value: SignalScore["value"], points: number, max: number, note: string): SignalScore => ({ key, label, value, points, max, note });

/* ----------------------------------------------------------------------------
 * A. Accès (20 points)
 * -------------------------------------------------------------------------- */

export function scoreAccess(signals: PageSignals, robots: RobotsInput, http: HttpInput, extras: AccessExtras = {}): ScoreResult {
  const rows: SignalScore[] = [];
  const caps: string[] = [];

  // Robots de recherche IA : 6 si tous autorisés, 0 sinon (et Résultat du moteur bloqué plafonné à 0, décidé en aval).
  rows.push(
    robots.allAllowed
      ? row("robots", "Robots de recherche IA autorisés", true, 6, 6, "Tous les agents IA sont autorisés par robots.txt.")
      : row("robots", "Robots de recherche IA autorisés", false, 0, 6, `Agents bloqués : ${robots.blockedAgents.join(", ") || "inconnus"}. Le Résultat des moteurs concernés est plafonné à 0.`),
  );
  if (!robots.allAllowed) caps.push("robots bloqués : Résultat plafonné à 0 pour les moteurs concernés");

  // Réponse HTTP et canonical : 4 ; 2 si redirection ; 0 si canonical ailleurs ou statut non 200.
  let httpPoints = 0;
  let httpNote: string;
  if (!signals.canonicalSelf) {
    httpNote = `Canonical vers une autre page (${signals.canonical}) : c'est la cible qui est indexée, à analyser à sa place.`;
    caps.push("canonisée ailleurs : analyser la cible");
  } else if (http.status !== 200) {
    httpNote = `Statut HTTP ${http.status}.`;
  } else if (http.redirects > 0) {
    httpPoints = 2;
    httpNote = `${http.redirects} redirection(s) avant la page finale.`;
  } else {
    httpPoints = 4;
    httpNote = "200 en direct, canonical sur elle-même.";
  }
  rows.push(row("http", "Réponse HTTP et canonical", `${http.status}${http.redirects ? ` (${http.redirects} redir.)` : ""}`, httpPoints, 4, httpNote));

  // Temps de réponse : 3 si < 1,5 s ; 2 si < 3 s ; 0 au-delà.
  const ms = http.responseMs;
  const timePoints = ms < 1500 ? 3 : ms < 3000 ? 2 : 0;
  rows.push(row("responseTime", "Temps de réponse", ms, timePoints, 3, timePoints === 3 ? "Moins de 1,5 s." : timePoints === 2 ? "Entre 1,5 et 3 s." : "3 s ou plus : les robots de recherche IA abandonnent vite."));

  // Contenu lisible sans JavaScript : 4 si ≥ 300 mots ; 2 si 100 à 299 ; 0 sinon avec alerte.
  const wc = signals.wordCount;
  const readPoints = wc >= 300 ? 4 : wc >= 100 ? 2 : 0;
  rows.push(
    row(
      "readable",
      "Contenu lisible sans JavaScript",
      wc,
      readPoints,
      4,
      readPoints === 4 ? `${wc} mots dans le HTML brut.` : readPoints === 2 ? `${wc} mots seulement dans le HTML brut.` : `${wc} mots dans le HTML brut${signals.jsSuspect ? ", la page dépend sans doute de JavaScript" : ""} : les extracteurs ne verront rien. Contenu plafonné à 15.`,
    ),
  );
  if (readPoints === 0) caps.push("illisible sans JavaScript : Contenu plafonné à 15");

  // Extraits autorisés : 3 sans directive restrictive, 0 sinon.
  const directives = signals.snippetDirectives;
  rows.push(
    directives.length
      ? row("snippets", "Extraits autorisés", directives.join(", "), 0, 3, `Directive(s) ${directives.join(", ")} : l'extrait qui sert à citer est interdit ou limité.`)
      : row("snippets", "Extraits autorisés", true, 3, 3, "Aucune directive nosnippet, max-snippet:0, noindex ou noai."),
  );

  // llms.txt : information, 0 point.
  rows.push(row("llmsTxt", "llms.txt", extras.llmsTxt ?? null, 0, 0, extras.llmsTxt ? "Présent. Aucune preuve publiée que les moteurs l'utilisent." : extras.llmsTxt === false ? "Absent. Aucune preuve publiée que les moteurs l'utilisent." : "Non vérifié."));

  return finish(rows, caps, 20);
}

/* ----------------------------------------------------------------------------
 * B. Contenu (40 points)
 * -------------------------------------------------------------------------- */

/** Types de page cités pour chaque type de question (section 1 et 5). */
export const COMPATIBLE_TYPES: Record<QuestionIntent, PageType[]> = {
  comparative: ["listicle", "directory"],
  informational: ["guide", "documentation", "news", "institutional"],
  price: ["service", "listicle", "guide", "directory"],
  local: ["service", "listicle", "directory"],
  resource: ["listicle", "guide", "documentation", "directory"],
};

const FIT_POINTS = [0, 4, 7, 10] as const;
const DIRECT_POINTS = [0, 3, 6, 8] as const;

/**
 * Repli B1 sans juge : type de page compatible avec le type de question → 7 sur 10 (adéquation 2) ;
 * incompatible → 4 (adéquation 1, l'heuristique ne tranche pas un 0) ; type de question inconnu → 4.
 * L'heuristique n'attribue jamais 10 : seule une lecture confirme une adéquation excellente.
 */
export function fallbackFit(pageType: PageType, intent?: QuestionIntent): { points: number; note: string } {
  if (!intent) return { points: 4, note: "Type de question inconnu : valeur neutre, en attendant la lecture par le modèle." };
  const ok = COMPATIBLE_TYPES[intent].includes(pageType);
  return ok
    ? { points: 7, note: `Type de page « ${pageType} » compatible avec une question ${intent} (heuristique, sans juge).` }
    : { points: 4, note: `Type de page « ${pageType} » rarement cité sur une question ${intent} (heuristique, sans juge).` };
}

/**
 * Repli B2 sans juge : un passage de 80 mots maximum contenant au moins 2 termes clés de la question,
 * dans le premier quart du texte, ou l'amorce d'une section dont le sous-titre reprend au moins 2 termes → 6 sur 8.
 * Un seul terme trouvé dans le premier quart → 3. Rien → 0. Sans termes de question → 0 avec note.
 */
export function fallbackDirectAnswer(signals: PageSignals, terms: string[]): { points: number; note: string; passage: string | null } {
  if (!terms.length) return { points: 0, note: "Aucune question fournie : réponse directe non évaluable sans juge.", passage: null };
  const countTerms = (text: string) => {
    const norm = normalizeText(text);
    return terms.filter((t) => hasTerm(norm, t)).length;
  };

  // Fenêtres de phrases consécutives, 80 mots max, dans le premier quart.
  const sentences = signals.textInFirstQuarter.split(/(?<=[.!?])\s+/).filter(Boolean);
  let bestCount = 0;
  let bestPassage: string | null = null;
  for (let i = 0; i < sentences.length; i++) {
    let words = 0;
    const parts: string[] = [];
    for (let j = i; j < sentences.length; j++) {
      const w = sentences[j].split(/\s+/).length;
      if (words + w > 80) break;
      words += w;
      parts.push(sentences[j]);
      const c = countTerms(parts.join(" "));
      if (c > bestCount) {
        bestCount = c;
        bestPassage = parts.join(" ");
      }
    }
  }
  if (bestCount >= 2) return { points: 6, note: `Passage de ${bestPassage?.split(/\s+/).length} mots dans le premier quart avec ${bestCount} termes de la question (heuristique, sans juge).`, passage: bestPassage };

  for (const s of signals.sections) {
    if (countTerms(s.heading) >= 2 && s.lead.split(/\s+/).length >= 20) {
      return { points: 6, note: `Sous-titre « ${s.heading} » reprend la question, avec une amorce de ${s.lead.split(/\s+/).length} mots (heuristique, sans juge).`, passage: s.lead };
    }
  }
  if (bestCount === 1) return { points: 3, note: "Un seul terme de la question dans le premier quart : réponse partielle probable (heuristique, sans juge).", passage: bestPassage };
  return { points: 0, note: "Aucun passage du premier quart ne reprend la question (heuristique, sans juge).", passage: null };
}

/** Terme présent, au singulier ou au pluriel simple (agence, agences ; outil, outils ; prix). */
function hasTerm(normalized: string, term: string): boolean {
  const t = normalizeText(term).trim();
  if (!t) return false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|x|es)?(?![\\p{L}\\p{N}])`, "u");
  return re.test(normalized);
}

const MONTH_MS = 30.4375 * 24 * 3600 * 1000;

/** Date la plus récente parmi dateModified, datePublished et l'année du titre (1er janvier), bornée à aujourd'hui. */
export function effectiveDate(signals: Pick<PageSignals, "dateModified" | "datePublished" | "titleYear">, now: Date): { date: Date | null; source: string } {
  const candidates: Array<{ t: number; source: string }> = [];
  const push = (v: string | null, source: string) => {
    if (!v) return;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) candidates.push({ t, source });
  };
  push(signals.dateModified, "dateModified");
  push(signals.datePublished, "datePublished");
  if (signals.titleYear) push(`${signals.titleYear}-01-01`, "année du titre");
  if (!candidates.length) return { date: null, source: "aucune" };
  const best = candidates.sort((a, b) => b.t - a.t)[0];
  return { date: new Date(Math.min(best.t, now.getTime())), source: best.source };
}

export function scoreContent(signals: PageSignals, judge?: JudgeNotes | null, opts: ContentScoringOptions = {}): ScoreResult {
  const rows: SignalScore[] = [];
  const caps: string[] = [];
  const now = opts.now ?? new Date();
  const pageType = opts.pageType ?? detectPageType(signals).type;

  // B1 Adéquation au type de question : 0 / 4 / 7 / 10, plafonnée à 4 si lieu absent ou langue différente.
  let fitPoints: number;
  let fitNote: string;
  if (judge) {
    fitPoints = FIT_POINTS[judge.fit];
    fitNote = `Adéquation ${judge.fit} sur 3 (lecture du modèle), page « ${pageType} »${opts.questionIntent ? `, question ${opts.questionIntent}` : ""}.`;
  } else {
    const f = fallbackFit(pageType, opts.questionIntent);
    fitPoints = f.points;
    fitNote = f.note;
  }
  if (signals.placeMentioned === false && fitPoints > 4) {
    fitPoints = 4;
    fitNote += " Plafonné à 4 : la page ne nomme pas le lieu de la question dans le titre, les sous-titres ou le premier quart.";
    caps.push("lieu absent : B1 plafonné à 4");
  }
  if (signals.langMatches === false && fitPoints > 4) {
    fitPoints = 4;
    fitNote += ` Plafonné à 4 : langue de la page (${signals.lang || "?"}) différente de celle de la question.`;
    caps.push("langue différente : B1 plafonné à 4");
  }
  rows.push(row("fit", "Adéquation au type de question", pageType, fitPoints, 10, fitNote));

  // B2 Réponse directe : 0 / 3 / 6 / 8.
  if (judge) {
    rows.push(row("directAnswer", "Réponse directe", judge.directAnswer, DIRECT_POINTS[judge.directAnswer], 8, `Réponse directe ${judge.directAnswer} sur 3 (lecture du modèle).`));
  } else {
    const terms = opts.questionTerms ?? (opts.question ? keyTerms(opts.question) : []);
    const d = fallbackDirectAnswer(signals, terms);
    rows.push(row("directAnswer", "Réponse directe", d.passage ? d.passage.slice(0, 200) : null, d.points, 8, d.note));
  }

  // B3 Structure extractible : 2 + 2 + 2.
  const extractable = signals.h2Questions + signals.h2Entities;
  rows.push(row("headings", "Sous-titres en questions ou entités", extractable, extractable >= 3 ? 2 : 0, 2, `${signals.h2Questions} question(s) et ${signals.h2Entities} entité(s) parmi les H2 et H3 ; il en faut 3.`));
  const listsTables = signals.listsCount + signals.tablesCount;
  rows.push(row("listsTables", "Listes ou tableaux", listsTables, listsTables >= 1 ? 2 : 0, 2, `${signals.listsCount} liste(s), ${signals.tablesCount} tableau(x) dans le corps.`));
  const blocks = [signals.hasFaq ? "FAQ" : null, signals.hasSummaryBlock ? "résumé" : null].filter(Boolean);
  rows.push(row("faqSummary", "Bloc FAQ ou résumé", blocks.join(" + ") || false, blocks.length ? 2 : 0, 2, blocks.length ? `Bloc ${blocks.join(" et ")} détecté.` : "Ni FAQ, ni « en bref », ni résumé."));

  // B4 Spécificité et preuves : 3 + 2 + 1 + 2.
  rows.push(row("numbers", "Données chiffrées", signals.numbersCount, signals.numbersCount >= 5 ? 3 : 0, 3, `${signals.numbersCount} donnée(s) chiffrée(s) (prix, pourcentages, dates, durées, unités) ; il en faut 5.`));
  const srcCount = signals.outboundDomains.length;
  rows.push(row("sources", "Sources externes", srcCount, srcCount >= 2 ? 2 : 0, 2, srcCount ? `${signals.outboundLinks} lien(s) vers ${srcCount} domaine(s) externe(s), hors réseaux sociaux.` : "Aucun lien vers un domaine externe, hors réseaux sociaux."));
  rows.push(row("quotes", "Citation ou témoignage attribué", signals.quoteCount, signals.quoteCount >= 1 ? 1 : 0, 1, `${signals.quoteCount} citation(s) en bloc ou avec attribution.`));
  rows.push(
    judge
      ? row("specificity", "Spécificité (modèle)", judge.specificity, judge.specificity >= 2 ? 2 : 0, 2, `Spécificité ${judge.specificity} sur 3 (lecture du modèle).`)
      : row("specificity", "Spécificité (modèle)", null, 0, 2, "Sans lecture par le modèle, aucun point."),
  );

  // B5 Fraîcheur : 4 si ≤ 6 mois ; 3 si ≤ 12 ; 1 si ≤ 24 ; 0 sinon ou sans date.
  const eff = effectiveDate(signals, now);
  let freshPoints = 0;
  let freshNote = "Aucune date de modification, de publication ni d'année dans le titre.";
  if (eff.date) {
    const months = (now.getTime() - eff.date.getTime()) / MONTH_MS;
    freshPoints = months <= 6 ? 4 : months <= 12 ? 3 : months <= 24 ? 1 : 0;
    freshNote = `${eff.date.toISOString().slice(0, 10)} (${eff.source}), il y a ${Math.round(months)} mois.`;
  }
  rows.push(row("freshness", "Fraîcheur", eff.date ? eff.date.toISOString().slice(0, 10) : null, freshPoints, 4, freshNote));

  // B6 Entité et autorité : 2 + 1 + 1.
  let authorPoints = 0;
  let authorNote: string;
  if (signals.organizationSchema || (signals.author && (signals.authorRole || signals.personSchema))) {
    authorPoints = 2;
    authorNote = [signals.author ? `auteur ${signals.author}${signals.authorRole ? ` (${signals.authorRole})` : ""}` : null, signals.personSchema ? "schéma Person" : null, signals.organizationSchema ? "schéma Organization" : null]
      .filter(Boolean)
      .join(", ");
    authorNote = authorNote.charAt(0).toUpperCase() + authorNote.slice(1) + ".";
  } else if (signals.author) {
    authorPoints = 1;
    authorNote = `Auteur ${signals.author} nommé sans fonction ni schéma : crédit partiel.`;
  } else {
    authorNote = "Ni auteur nommé, ni schéma Person ou Organization.";
  }
  rows.push(row("author", "Auteur ou organisation identifiés", signals.author ?? (signals.organizationSchema ? "Organization" : null), authorPoints, 2, authorNote));
  const profiles = signals.sameAs.length > 0 || signals.aboutContactLinks;
  rows.push(row("profiles", "Liens à propos, contact, profils", profiles, profiles ? 1 : 0, 1, profiles ? `${signals.sameAs.length} profil(s) sameAs${signals.aboutContactLinks ? ", liens à propos ou contact" : ""}.` : "Aucun lien à propos, contact ni profil sameAs."));
  rows.push(row("brand", "Nom de marque cohérent", signals.brandName ?? null, signals.brandConsistent ? 1 : 0, 1, signals.brandConsistent ? `« ${signals.brandName} » dans le titre, l'en-tête et le pied de page.` : signals.brandName ? `« ${signals.brandName} » absent de l'en-tête, du pied de page ou du titre.` : "Aucun nom de marque identifié."));

  const result = finish(rows, caps, 40);
  if (signals.wordCount < 100 && result.total > 15) {
    caps.push("illisible sans JavaScript : Contenu plafonné à 15");
    return { ...result, total: 15, caps };
  }
  return result;
}

function finish(rows: SignalScore[], caps: string[], max: number): ScoreResult {
  const sumMax = rows.reduce((s, r) => s + r.max, 0);
  if (sumMax !== max) throw new Error(`Grille incohérente : ${sumMax} points au lieu de ${max}`);
  return { total: rows.reduce((s, r) => s + r.points, 0), max, rows, caps, gridVersion: GRID_VERSION };
}

export function scoreLabel(total: number, max: number): "faible" | "moyen" | "bon" {
  const ratio = total / max;
  return ratio < 0.4 ? "faible" : ratio < 0.7 ? "moyen" : "bon";
}
