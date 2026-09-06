import { describe, it, expect } from "vitest";
import { detect, domainMatches, findMentionSpans, findTerm, normalizeDomain, normalizeText } from "./detection";

describe("normalizeDomain", () => {
  it("strips scheme, www, path and port", () => {
    expect(normalizeDomain("https://www.Gatto.city/annonces?x=1")).toBe("gatto.city");
    expect(normalizeDomain("WWW.gatto.city")).toBe("gatto.city");
    expect(normalizeDomain("gatto.city:8080")).toBe("gatto.city");
    expect(normalizeDomain("  blog.gatto.city  ")).toBe("blog.gatto.city");
    expect(normalizeDomain("")).toBe("");
  });
});

describe("domainMatches", () => {
  it("matches exact and subdomains only", () => {
    expect(domainMatches("gatto.city", "gatto.city")).toBe(true);
    expect(domainMatches("blog.gatto.city", "gatto.city")).toBe(true);
    expect(domainMatches("https://www.gatto.city/x", "gatto.city")).toBe(true);
    expect(domainMatches("notgatto.city", "gatto.city")).toBe(false);
    expect(domainMatches("gatto.city.evil.com", "gatto.city")).toBe(false);
  });
});

describe("findTerm", () => {
  it("is case and accent insensitive with word boundaries", () => {
    const text = normalizeText("Je recommande Gatto.city et aussi Sélogér pour les annonces.");
    expect(findTerm(text, "gatto.city")).toBeGreaterThanOrEqual(0);
    expect(findTerm(text, "SeLoger")).toBeGreaterThanOrEqual(0);
    expect(findTerm(text, "gatto")).toBeGreaterThanOrEqual(0); // "." n'est pas une lettre : "gatto" matche dans "gatto.city"
    expect(findTerm(text, "gatt")).toBe(-1);
  });
  it("does not match inside other words", () => {
    const text = normalizeText("Le site Bienici est bien.");
    expect(findTerm(text, "bien")).toBeGreaterThanOrEqual(0);
    expect(findTerm(text, "ici")).toBe(-1);
    expect(findTerm(text, "Bienici")).toBeGreaterThanOrEqual(0);
  });
});

describe("detect", () => {
  const brand = { type: "brand" as const, id: "p1", terms: ["Gatto", "Gatto.city"], domains: ["gatto.city"] };
  const comp = { type: "competitor" as const, id: "c1", terms: ["SeLoger"], domains: ["seloger.com"] };

  it("detects citation rank from sources order", () => {
    const sources = [{ url: "https://www.seloger.com/a" }, { url: "https://blog.gatto.city/b" }];
    const r = detect("Rien à voir.", sources, [brand, comp]);
    expect(r.find((d) => d.entityId === "p1")).toMatchObject({ cited: true, citationRank: 2, mentioned: false, mentionRank: null });
    expect(r.find((d) => d.entityId === "c1")).toMatchObject({ cited: true, citationRank: 1 });
  });

  it("detects mention order in text", () => {
    const r = detect("SeLoger est connu, mais Gatto propose plus d'annonces à Lyon.", [], [brand, comp]);
    expect(r.find((d) => d.entityId === "c1")).toMatchObject({ mentioned: true, mentionRank: 1, cited: false });
    expect(r.find((d) => d.entityId === "p1")).toMatchObject({ mentioned: true, mentionRank: 2, matchedTerms: ["Gatto"] });
  });

  it("counts a domain URL in the text as a mention", () => {
    const strict = { ...brand, terms: ["Gatto Immobilier"] };
    const r = detect("Voir https://gatto.city/lyon pour la liste.", [], [strict]);
    expect(r[0]).toMatchObject({ mentioned: true, matchedTerms: ["gatto.city"] });
  });

  it("returns nothing for unrelated text", () => {
    const r = detect("Les chats aiment le soleil.", [{ url: "https://wikipedia.org" }], [brand, comp]);
    expect(r.every((d) => !d.cited && !d.mentioned)).toBe(true);
  });
});

describe("findMentionSpans", () => {
  it("returns spans on the original text", () => {
    const text = "Chez Gatto, puis GATTO.city.";
    const spans = findMentionSpans(text, ["Gatto"]);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["Gatto", "GATTO"]);
  });
  it("handles accents in the original text", () => {
    const text = "Sélogér est cité.";
    const spans = findMentionSpans(text, ["seloger"]);
    expect(spans.map((s) => text.slice(s.start, s.end))).toEqual(["Sélogér"]);
  });
});
