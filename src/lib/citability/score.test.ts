import { describe, expect, it } from "vitest";
import { extractSignals, type PageSignals } from "./signals";
import { COMPATIBLE_TYPES, effectiveDate, fallbackDirectAnswer, fallbackFit, GRID_VERSION, scoreAccess, scoreContent, scoreLabel } from "./score";
import { ARTICLE_HTML, ARTICLE_URL, DOC_HTML, DOC_URL, JS_EMPTY_HTML, JS_EMPTY_URL, LISTICLE_HTML, LISTICLE_URL, SERVICE_HTML, SERVICE_URL } from "./fixtures";

const NOW = new Date("2026-09-08T12:00:00Z");
const OK_ROBOTS = { allAllowed: true, blockedAgents: [] };
const OK_HTTP = { status: 200, responseMs: 800, redirects: 0 };

const listicle = extractSignals(LISTICLE_HTML, { url: LISTICLE_URL, questionLang: "fr", place: "Montréal" });
const service = extractSignals(SERVICE_HTML, { url: SERVICE_URL, questionLang: "fr", place: "Montréal" });
const doc = extractSignals(DOC_HTML, { url: DOC_URL, questionLang: "fr" });
const jsEmpty = extractSignals(JS_EMPTY_HTML, { url: JS_EMPTY_URL });
const article = extractSignals(ARTICLE_HTML, { url: ARTICLE_URL });

describe("scoreAccess", () => {
  it("additionne 20 au maximum et les obtient sur une page parfaite", () => {
    const r = scoreAccess(listicle, OK_ROBOTS, OK_HTTP, { llmsTxt: true });
    expect(r.max).toBe(20);
    expect(r.rows.reduce((s, x) => s + x.max, 0)).toBe(20);
    expect(r.total).toBe(20);
    expect(r.caps).toEqual([]);
    expect(r.gridVersion).toBe(GRID_VERSION);
    expect(r.rows.map((x) => x.key)).toEqual(["robots", "http", "responseTime", "readable", "snippets", "llmsTxt"]);
    expect(r.rows.find((x) => x.key === "llmsTxt")).toMatchObject({ points: 0, max: 0, value: true });
  });

  it("robots bloqués : 0 sur 6 et plafond signalé", () => {
    const r = scoreAccess(listicle, { allAllowed: false, blockedAgents: ["OAI-SearchBot", "Claude-SearchBot"] }, OK_HTTP);
    expect(r.rows[0]).toMatchObject({ points: 0, max: 6 });
    expect(r.rows[0].note).toContain("OAI-SearchBot");
    expect(r.caps[0]).toContain("robots bloqués");
    expect(r.total).toBe(14);
  });

  it("redirection : 2 ; statut non 200 : 0 ; canonical ailleurs : 0", () => {
    expect(scoreAccess(listicle, OK_ROBOTS, { ...OK_HTTP, redirects: 1 }).rows[1].points).toBe(2);
    expect(scoreAccess(listicle, OK_ROBOTS, { ...OK_HTTP, status: 404 }).rows[1].points).toBe(0);
    const elsewhere: PageSignals = { ...listicle, canonicalSelf: false, canonical: "https://rablab.ca/autre" };
    const r = scoreAccess(elsewhere, OK_ROBOTS, OK_HTTP);
    expect(r.rows[1].points).toBe(0);
    expect(r.caps).toContain("canonisée ailleurs : analyser la cible");
  });

  it("temps de réponse par paliers", () => {
    expect(scoreAccess(listicle, OK_ROBOTS, { ...OK_HTTP, responseMs: 1499 }).rows[2].points).toBe(3);
    expect(scoreAccess(listicle, OK_ROBOTS, { ...OK_HTTP, responseMs: 1500 }).rows[2].points).toBe(2);
    expect(scoreAccess(listicle, OK_ROBOTS, { ...OK_HTTP, responseMs: 2999 }).rows[2].points).toBe(2);
    expect(scoreAccess(listicle, OK_ROBOTS, { ...OK_HTTP, responseMs: 3000 }).rows[2].points).toBe(0);
  });

  it("lisibilité par paliers", () => {
    expect(scoreAccess({ ...listicle, wordCount: 300 }, OK_ROBOTS, OK_HTTP).rows[3].points).toBe(4);
    expect(scoreAccess({ ...listicle, wordCount: 299 }, OK_ROBOTS, OK_HTTP).rows[3].points).toBe(2);
    expect(scoreAccess({ ...listicle, wordCount: 100 }, OK_ROBOTS, OK_HTTP).rows[3].points).toBe(2);
    expect(scoreAccess({ ...listicle, wordCount: 99 }, OK_ROBOTS, OK_HTTP).rows[3].points).toBe(0);
  });

  it("page JavaScript vide avec nosnippet et noindex", () => {
    const r = scoreAccess(jsEmpty, OK_ROBOTS, OK_HTTP);
    expect(r.rows[3].points).toBe(0);
    expect(r.rows[3].note).toContain("JavaScript");
    expect(r.rows[4].points).toBe(0);
    expect(r.rows[4].value).toBe("nosnippet, noindex");
    expect(r.caps).toContain("illisible sans JavaScript : Contenu plafonné à 15");
    expect(r.total).toBe(13);
  });
});

describe("scoreContent", () => {
  it("additionne 40 au maximum", () => {
    const r = scoreContent(listicle, { fit: 3, directAnswer: 3, specificity: 3 }, { now: NOW });
    expect(r.max).toBe(40);
    expect(r.rows.reduce((s, x) => s + x.max, 0)).toBe(40);
    expect(r.rows.map((x) => x.max)).toEqual([10, 8, 2, 2, 2, 3, 2, 1, 2, 4, 2, 1, 1]);
  });

  it("listicle complet avec juge parfait : 40 sur 40", () => {
    const r = scoreContent(listicle, { fit: 3, directAnswer: 3, specificity: 3 }, { now: NOW, questionIntent: "comparative" });
    expect(r.rows.filter((x) => x.points < x.max).map((x) => x.key)).toEqual([]);
    expect(r.total).toBe(40);
    expect(r.caps).toEqual([]);
  });

  it("notes du juge converties par la grille", () => {
    const fits = [0, 1, 2, 3].map((f) => scoreContent(listicle, { fit: f as 0 | 1 | 2 | 3, directAnswer: f as 0 | 1 | 2 | 3, specificity: f as 0 | 1 | 2 | 3 }, { now: NOW }));
    expect(fits.map((r) => r.rows[0].points)).toEqual([0, 4, 7, 10]);
    expect(fits.map((r) => r.rows[1].points)).toEqual([0, 3, 6, 8]);
    expect(fits.map((r) => r.rows.find((x) => x.key === "specificity")?.points)).toEqual([0, 0, 2, 2]);
  });

  it("sans juge : repli B1 à 7 si compatible, 4 sinon, 4 sans type de question", () => {
    expect(scoreContent(listicle, null, { now: NOW, questionIntent: "comparative" }).rows[0].points).toBe(7);
    expect(scoreContent(listicle, null, { now: NOW, questionIntent: "informational" }).rows[0].points).toBe(4);
    expect(scoreContent(listicle, null, { now: NOW }).rows[0].points).toBe(4);
    expect(scoreContent(service, null, { now: NOW, questionIntent: "comparative" }).rows[0]).toMatchObject({ points: 4, value: "service" });
    expect(scoreContent(service, null, { now: NOW, questionIntent: "local" }).rows[0].points).toBe(7);
    expect(fallbackFit("directory", "comparative").points).toBe(7);
    expect(fallbackFit("documentation", "informational").points).toBe(7);
    for (const list of Object.values(COMPATIBLE_TYPES)) expect(list.length).toBeGreaterThan(0);
  });

  it("sans juge : repli B2 sur le premier quart avec les termes de la question", () => {
    const r = scoreContent(listicle, null, { now: NOW, question: "Quelle est la meilleure agence SEO à Montréal ?" });
    const b2 = r.rows[1];
    expect(b2.points).toBe(6);
    expect(b2.note).toContain("termes de la question");
    expect(String(b2.value)).toMatch(/agences? SEO/);
    expect(scoreContent(listicle, null, { now: NOW }).rows[1]).toMatchObject({ points: 0, value: null });
    expect(scoreContent(listicle, null, { now: NOW, question: "Comment installer PostgreSQL sur Ubuntu ?" }).rows[1].points).toBe(0);
  });

  it("repli B2 via un sous-titre qui reprend la question", () => {
    const s: PageSignals = {
      ...listicle,
      textInFirstQuarter: "Rien d'utile ici, texte d'introduction long qui parle d'autre chose sans reprendre les mots attendus.",
      sections: [{ heading: "Combien coûte une agence SEO à Montréal ?", lead: "Entre 1 500 $ et 8 000 $ par mois selon la taille du site et l'ambition, la médiane observée est de 3 000 $, avec un audit initial le plus souvent inclus dans le premier mois." }],
    };
    const d = fallbackDirectAnswer(s, ["agence", "seo", "montreal", "coute"]);
    expect(d.points).toBe(6);
    expect(d.note).toContain("Sous-titre");
    const one = fallbackDirectAnswer({ ...s, sections: [], textInFirstQuarter: "Une agence sérieuse commence par un audit." }, ["agence", "seo", "montreal"]);
    expect(one.points).toBe(3);
  });

  it("modificateurs : lieu absent ou langue différente plafonnent B1 à 4", () => {
    const noPlace = extractSignals(LISTICLE_HTML, { url: LISTICLE_URL, place: "Toronto" });
    const r1 = scoreContent(noPlace, { fit: 3, directAnswer: 3, specificity: 3 }, { now: NOW });
    expect(r1.rows[0].points).toBe(4);
    expect(r1.caps).toContain("lieu absent : B1 plafonné à 4");
    const r2 = scoreContent(doc, { fit: 3, directAnswer: 3, specificity: 3 }, { now: NOW });
    expect(r2.rows[0].points).toBe(4);
    expect(r2.caps).toContain("langue différente : B1 plafonné à 4");
    const r3 = scoreContent(noPlace, { fit: 1, directAnswer: 3, specificity: 3 }, { now: NOW });
    expect(r3.rows[0].points).toBe(4);
    expect(r3.caps).toEqual([]);
  });

  it("B3 structure : seuils", () => {
    const r = scoreContent(service, null, { now: NOW });
    const by = Object.fromEntries(r.rows.map((x) => [x.key, x.points]));
    expect(by.headings).toBe(2);
    expect(by.listsTables).toBe(2);
    expect(by.faqSummary).toBe(0);
    const bare: PageSignals = { ...service, h2Questions: 1, h2Entities: 1, listsCount: 0, tablesCount: 0 };
    const rb = Object.fromEntries(scoreContent(bare, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect(rb.headings).toBe(0);
    expect(rb.listsTables).toBe(0);
  });

  it("B4 preuves : chiffres, sources, citation, spécificité", () => {
    const by = Object.fromEntries(scoreContent(article, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect(by.numbers).toBe(3);
    expect(by.sources).toBe(2);
    expect(by.quotes).toBe(1);
    expect(by.specificity).toBe(0);
    const few: PageSignals = { ...article, numbersCount: 4, outboundDomains: ["a.com"], quoteCount: 0 };
    const b2 = Object.fromEntries(scoreContent(few, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect([b2.numbers, b2.sources, b2.quotes]).toEqual([0, 0, 0]);
  });

  it("B5 fraîcheur : paliers, date la plus récente, année du titre, sans date", () => {
    const fresh = (dateModified: string | null, datePublished: string | null, titleYear: number | null) =>
      scoreContent({ ...article, dateModified, datePublished, titleYear }, null, { now: NOW }).rows.find((x) => x.key === "freshness");
    expect(fresh("2026-08-20", null, null)?.points).toBe(4);
    expect(fresh("2026-03-12", null, null)?.points).toBe(4);
    expect(fresh("2025-11-01", null, null)?.points).toBe(3);
    expect(fresh("2025-01-15", null, null)?.points).toBe(1);
    expect(fresh("2024-06-01", null, null)?.points).toBe(0);
    expect(fresh(null, null, null)?.points).toBe(0);
    expect(fresh(null, "2025-11-03", 2026)?.points).toBe(3);
    expect(fresh(null, "2023-01-01", 2026)?.value).toBe("2026-01-01");
    expect(fresh("2027-01-01", null, null)?.value).toBe("2026-09-08");
    expect(effectiveDate({ dateModified: "pas une date", datePublished: null, titleYear: null }, NOW).date).toBeNull();
  });

  it("B6 entité : auteur avec fonction ou schéma, profils, marque", () => {
    const full = Object.fromEntries(scoreContent(listicle, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect([full.author, full.profiles, full.brand]).toEqual([2, 1, 1]);
    const onlyName: PageSignals = { ...listicle, authorRole: null, personSchema: false, organizationSchema: false, sameAs: [], aboutContactLinks: false, brandConsistent: false };
    const partial = Object.fromEntries(scoreContent(onlyName, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect([partial.author, partial.profiles, partial.brand]).toEqual([1, 0, 0]);
    const none = Object.fromEntries(scoreContent({ ...onlyName, author: null }, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect(none.author).toBe(0);
    const orgOnly = Object.fromEntries(scoreContent({ ...onlyName, author: null, organizationSchema: true }, null, { now: NOW }).rows.map((x) => [x.key, x.points]));
    expect(orgOnly.author).toBe(2);
  });

  it("page illisible : Contenu plafonné à 15", () => {
    const r = scoreContent({ ...jsEmpty, hasFaq: true, listsCount: 2, numbersCount: 9, outboundDomains: ["a.com", "b.com"], quoteCount: 1, dateModified: "2026-09-01" }, { fit: 3, directAnswer: 3, specificity: 3 }, { now: NOW });
    expect(r.total).toBe(15);
    expect(r.caps).toContain("illisible sans JavaScript : Contenu plafonné à 15");
    const low = scoreContent(jsEmpty, null, { now: NOW });
    expect(low.total).toBeLessThanOrEqual(15);
  });

  it("type de page fourni en option prime sur la détection", () => {
    const r = scoreContent(service, null, { now: NOW, pageType: "listicle", questionIntent: "comparative" });
    expect(r.rows[0]).toMatchObject({ value: "listicle", points: 7 });
  });

  it("chaque ligne porte clé, libellé, valeur, points, max, note", () => {
    for (const row of [...scoreAccess(listicle, OK_ROBOTS, OK_HTTP).rows, ...scoreContent(listicle, null, { now: NOW }).rows]) {
      expect(row.key).toBeTruthy();
      expect(row.label).toBeTruthy();
      expect(row.note).toBeTruthy();
      expect(row.points).toBeGreaterThanOrEqual(0);
      expect(row.points).toBeLessThanOrEqual(row.max);
      expect(`${row.label} ${row.note}`).not.toMatch(/[–—]/);
    }
  });

  it("scoreLabel", () => {
    expect(scoreLabel(5, 20)).toBe("faible");
    expect(scoreLabel(10, 20)).toBe("moyen");
    expect(scoreLabel(15, 20)).toBe("bon");
  });
});
