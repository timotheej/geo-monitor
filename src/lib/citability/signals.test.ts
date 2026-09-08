import { describe, expect, it } from "vitest";
import { countNumbers, extractSignals, guessLang, isEntityHeading, isQuestionHeading, parseWrittenDate, rootDomain } from "./signals";
import {
  ARTICLE_HTML, ARTICLE_URL, DIRECTORY_HTML, DIRECTORY_URL, DOC_HTML, DOC_URL, JS_EMPTY_HTML, JS_EMPTY_URL, LISTICLE_HTML, LISTICLE_URL, SERVICE_HTML, SERVICE_URL,
} from "./fixtures";

describe("extractSignals : listicle", () => {
  const s = extractSignals(LISTICLE_HTML, { url: LISTICLE_URL, questionLang: "fr", place: "Montréal" });

  it("garde les champs de extractPage", () => {
    expect(s.title).toContain("Top 10");
    expect(s.h1).toBe("Top 10 des meilleures agences SEO à Montréal en 2026");
    expect(s.lang).toBe("fr");
    expect(s.jsonLdTypes).toEqual(expect.arrayContaining(["BlogPosting", "ItemList", "FAQPage"]));
    expect(s.wordCount).toBeGreaterThan(300);
    expect(s.jsSuspect).toBe(false);
  });

  it("lit les dates", () => {
    expect(s.dateModified).toBe("2026-08-20T14:30:00Z");
    expect(s.datePublished).toBe("2025-11-03T09:00:00Z");
    expect(s.titleYear).toBe(2026);
  });

  it("lit auteur, organisation et profils", () => {
    expect(s.author).toBe("Timothée Jezek");
    expect(s.authorRole).toBe("Directeur SEO");
    expect(s.personSchema).toBe(true);
    expect(s.organizationSchema).toBe(true);
    expect(s.sameAs).toEqual(["https://www.linkedin.com/company/rablab", "https://www.facebook.com/rablab"]);
    expect(s.aboutContactLinks).toBe(true);
    expect(s.brandName).toBe("Rablab");
    expect(s.brandConsistent).toBe(true);
  });

  it("compte les liens sortants hors réseaux sociaux et hors domaine", () => {
    expect(s.outboundLinks).toBe(2);
    expect(s.outboundDomains).toEqual(["clutch.co", "hellodarwin.com"]);
  });

  it("mesure la structure", () => {
    expect(s.listsCount).toBe(1);
    expect(s.tablesCount).toBe(1);
    expect(s.hasFaq).toBe(true);
    expect(s.hasSummaryBlock).toBe(true);
    expect(s.h2Questions).toBeGreaterThanOrEqual(4);
    expect(s.h2Entities).toBeGreaterThanOrEqual(6);
    expect(s.quoteCount).toBeGreaterThanOrEqual(1);
    expect(s.numbersCount).toBeGreaterThanOrEqual(20);
    expect(s.headings.some((h) => h.level === 3)).toBe(true);
    expect(s.sections.find((x) => x.heading === "1. Rablab")?.lead).toContain("Fondée en 2012");
  });

  it("ancrage local, langue, canonical, extraits", () => {
    expect(s.placeMentioned).toBe(true);
    expect(s.langMatches).toBe(true);
    expect(s.canonicalSelf).toBe(true);
    expect(s.snippetDirectives).toEqual([]);
    expect(s.host).toBe("rablab.ca");
    expect(s.textInFirstQuarter.split(" ").length).toBeGreaterThanOrEqual(120);
    expect(s.textInFirstQuarter).toContain("Choisir la meilleure agence SEO");
  });

  it("modificateurs absents sans options", () => {
    const t = extractSignals(LISTICLE_HTML, { url: LISTICLE_URL });
    expect(t.placeMentioned).toBeNull();
    expect(t.langMatches).toBeNull();
  });

  it("lieu absent et langue différente", () => {
    const t = extractSignals(LISTICLE_HTML, { url: LISTICLE_URL, questionLang: "en", place: "Toronto" });
    expect(t.placeMentioned).toBe(false);
    expect(t.langMatches).toBe(false);
  });
});

describe("extractSignals : page de service", () => {
  const s = extractSignals(SERVICE_HTML, { url: SERVICE_URL });
  it("détecte les indices de service", () => {
    expect(s.serviceCues).toEqual({ contactForm: true, priceFrom: true, quoteCta: true, ourServices: true });
    expect(s.organizationSchema).toBe(true);
    expect(s.personSchema).toBe(false);
    expect(s.author).toBeNull();
    expect(s.dateModified).toBeNull();
    expect(s.outboundLinks).toBe(0);
    expect(s.hasFaq).toBe(false);
  });
});

describe("extractSignals : documentation Google", () => {
  const s = extractSignals(DOC_HTML, { url: DOC_URL, questionLang: "fr" });
  it("lit la date visible en anglais et la langue", () => {
    expect(s.dateModified).toBe("2026-05-14");
    expect(s.lang).toBe("en");
    expect(s.langMatches).toBe(false);
    expect(s.tablesCount).toBe(1);
    expect(s.listsCount).toBe(1);
    expect(s.outboundDomains).toEqual(["chrome.com", "web.dev"]);
    expect(s.h2Questions).toBeGreaterThanOrEqual(2);
  });
});

describe("extractSignals : annuaire", () => {
  const s = extractSignals(DIRECTORY_HTML, { url: DIRECTORY_URL, place: "Montreal" });
  it("voit une liste d'entités et des chiffres", () => {
    expect(s.h2Entities).toBe(6);
    expect(s.numbersCount).toBeGreaterThanOrEqual(15);
    expect(s.placeMentioned).toBe(true);
    expect(s.titleYear).toBe(2026);
    expect(s.brandName).toBe("Clutch.co");
  });
});

describe("extractSignals : page JavaScript vide", () => {
  const s = extractSignals(JS_EMPTY_HTML, { url: JS_EMPTY_URL, questionLang: "fr" });
  it("ne voit rien et lit les directives robots", () => {
    expect(s.wordCount).toBe(0);
    expect(s.jsSuspect).toBe(true);
    expect(s.snippetDirectives).toEqual(["nosnippet", "noindex"]);
    expect(s.langMatches).toBeNull();
    expect(s.textInFirstQuarter).toBe("");
    expect(s.h2Entities).toBe(0);
    expect(s.canonicalSelf).toBe(true);
  });
});

describe("extractSignals : article « mis à jour le »", () => {
  const s = extractSignals(ARTICLE_HTML, { url: ARTICLE_URL });
  it("lit la date visible, la signature et la fonction", () => {
    expect(s.dateModified).toBe("2026-03-12");
    expect(s.datePublished).toBe("2025-09-15");
    expect(s.author).toBe("Marie Tremblay");
    expect(s.authorRole).toBe("directrice SEO");
    expect(s.personSchema).toBe(true);
  });
  it("canonical avec paramètre de suivi reste la même page", () => {
    expect(s.canonicalSelf).toBe(true);
  });
  it("structure de guide", () => {
    expect(s.h2Questions).toBe(1);
    expect(s.listsCount).toBe(1);
    expect(s.quoteCount).toBeGreaterThanOrEqual(1);
    expect(s.outboundDomains).toEqual(["gouv.qc.ca", "lesaffaires.com"]);
  });
});

describe("extractSignals : canonical vers une autre page", () => {
  it("canonicalSelf faux", () => {
    const html = `<html><head><title>x</title><link rel="canonical" href="/autre-page"></head><body><main><p>Texte.</p></main></body></html>`;
    const s = extractSignals(html, { url: "https://example.com/page" });
    expect(s.canonicalSelf).toBe(false);
  });
  it("canonical relative vers soi-même", () => {
    const html = `<html><head><title>x</title><link rel="canonical" href="/page/"></head><body></body></html>`;
    expect(extractSignals(html, { url: "https://www.example.com/page" }).canonicalSelf).toBe(true);
  });
});

describe("utilitaires", () => {
  it("parseWrittenDate", () => {
    expect(parseWrittenDate("12 mars 2026")).toBe("2026-03-12");
    expect(parseWrittenDate("1er février 2026")).toBe("2026-02-01");
    expect(parseWrittenDate("March 12, 2026")).toBe("2026-03-12");
    expect(parseWrittenDate("2026-03-12T10:00:00Z")).toBe("2026-03-12");
    expect(parseWrittenDate("03/04/2026", "fr")).toBe("2026-04-03");
    expect(parseWrittenDate("03/04/2026", "en")).toBe("2026-03-04");
    expect(parseWrittenDate("25/04/2026", "en")).toBe("2026-04-25");
    expect(parseWrittenDate("hier")).toBeNull();
  });
  it("isQuestionHeading", () => {
    expect(isQuestionHeading("Combien coûte une agence SEO ?")).toBe(true);
    expect(isQuestionHeading("Comment choisir son agence")).toBe(true);
    expect(isQuestionHeading("What is LCP")).toBe(true);
    expect(isQuestionHeading("Rablab")).toBe(false);
    expect(isQuestionHeading("Où trouver un consultant")).toBe(true);
  });
  it("isEntityHeading", () => {
    expect(isEntityHeading("Rablab")).toBe(true);
    expect(isEntityHeading("1. My Little Big Web")).toBe(true);
    expect(isEntityHeading("#3 Zenith")).toBe(true);
    expect(isEntityHeading("Google Analytics 4")).toBe(true);
    expect(isEntityHeading("Comment choisir son agence")).toBe(false);
    expect(isEntityHeading("Conclusion")).toBe(false);
    expect(isEntityHeading("Une agence qui est bonne pour vous et vos clients")).toBe(false);
    expect(isEntityHeading("rablab")).toBe(false);
    expect(isEntityHeading("Pourquoi Rablab ?")).toBe(false);
  });
  it("countNumbers", () => {
    expect(countNumbers("Prix à partir de 2 500 $ par mois, soit 25 % de moins qu'en 2025, livré en 3 semaines.")).toBe(4);
    expect(countNumbers("Aucun chiffre ici.")).toBe(0);
    expect(countNumbers("$5,000 minimum, 4.9 stars, 200 ms, March 12, 2026")).toBe(4);
  });
  it("rootDomain", () => {
    expect(rootDomain("www.cai.gouv.qc.ca")).toBe("gouv.qc.ca");
    expect(rootDomain("blog.rablab.ca")).toBe("rablab.ca");
    expect(rootDomain("developer.chrome.com")).toBe("chrome.com");
    expect(rootDomain("www.bbc.co.uk")).toBe("bbc.co.uk");
  });
  it("guessLang", () => {
    expect(guessLang("Le référencement est une discipline qui demande de la patience pour les entreprises et les agences.")).toBe("fr");
    expect(guessLang("The best way to improve your rankings is to write content that answers the question of the user.")).toBe("en");
    expect(guessLang("Rablab")).toBe("");
  });
});
