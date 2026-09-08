import { describe, expect, it } from "vitest";
import { extractSignals } from "./signals";
import { ageInMonths, compareSignals, median, topGaps } from "./compare";
import { ARTICLE_HTML, ARTICLE_URL, DIRECTORY_HTML, DIRECTORY_URL, DOC_HTML, DOC_URL, LISTICLE_HTML, LISTICLE_URL, SERVICE_HTML, SERVICE_URL } from "./fixtures";

const NOW = new Date("2026-09-08T12:00:00Z");
const listicle = extractSignals(LISTICLE_HTML, { url: LISTICLE_URL });
const service = extractSignals(SERVICE_HTML, { url: SERVICE_URL });
const doc = extractSignals(DOC_HTML, { url: DOC_URL });
const directory = extractSignals(DIRECTORY_HTML, { url: DIRECTORY_URL });
const article = extractSignals(ARTICLE_HTML, { url: ARTICLE_URL });

describe("compareSignals", () => {
  it("médiane des concurrents de même type quand il y en a", () => {
    const rows = compareSignals(service, [
      { signals: listicle, pageType: "listicle" },
      { signals: directory, pageType: "directory" },
      { signals: article, pageType: "guide" },
    ], { targetType: "guide", now: NOW });
    expect(rows.every((r) => r.sameTypeOnly && r.sample === 1)).toBe(true);
    const words = rows.find((r) => r.key === "wordCount");
    expect(words?.median).toBe(article.wordCount);
    expect(words?.target).toBe(service.wordCount);
  });

  it("sinon tous les concurrents, avec le drapeau à faux", () => {
    const rows = compareSignals(service, [
      { signals: listicle, pageType: "listicle" },
      { signals: directory, pageType: "directory" },
      { signals: doc, pageType: "documentation" },
    ], { targetType: "service", now: NOW });
    expect(rows.every((r) => !r.sameTypeOnly && r.sample === 3)).toBe(true);
    const faq = rows.find((r) => r.key === "hasFaq");
    expect(faq).toMatchObject({ target: 0, median: 0, gap: 0 });
    const numbers = rows.find((r) => r.key === "numbersCount");
    expect(numbers?.median).toBe(median([listicle.numbersCount, directory.numbersCount, doc.numbersCount]));
  });

  it("trié par écart décroissant, écart normalisé et signe selon le sens du signal", () => {
    const rows = compareSignals(service, [{ signals: listicle, pageType: "listicle" }], { now: NOW });
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].gap).toBeGreaterThanOrEqual(rows[i].gap);
    const words = rows.find((r) => r.key === "wordCount");
    expect(words?.gap).toBeGreaterThan(0);
    expect(words?.gap).toBeLessThanOrEqual(1);
    expect(words?.delta).toBe(service.wordCount - listicle.wordCount);
    const age = rows.find((r) => r.key === "ageMonths");
    expect(age?.higherIsBetter).toBe(false);
    expect(age?.target).toBe(60);
    expect(age?.gap).toBeGreaterThan(0);
  });

  it("topGaps ne garde que les retards, au plus n", () => {
    const rows = compareSignals(service, [{ signals: listicle, pageType: "listicle" }], { now: NOW });
    const top = topGaps(rows, 3);
    expect(top).toHaveLength(3);
    expect(top.every((r) => r.gap > 0)).toBe(true);
    expect(top.map((r) => r.gap)).toEqual([...top.map((r) => r.gap)].sort((a, b) => b - a));
    const better = compareSignals(listicle, [{ signals: service, pageType: "service" }], { now: NOW });
    expect(topGaps(better, 3).every((r) => r.gap > 0)).toBe(true);
    expect(topGaps(better, 3).length).toBeLessThanOrEqual(3);
  });

  it("sans concurrent : médiane 0, écart calculable", () => {
    const rows = compareSignals(listicle, [], { now: NOW });
    expect(rows.every((r) => r.median === 0 && r.sample === 0)).toBe(true);
  });

  it("median et ageInMonths", () => {
    expect(median([])).toBe(0);
    expect(median([3])).toBe(3);
    expect(median([1, 5, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(ageInMonths({ dateModified: "2026-03-08", datePublished: "2025-01-01" }, NOW)).toBeCloseTo(6, 0);
    expect(ageInMonths({ dateModified: null, datePublished: null }, NOW)).toBe(60);
    expect(ageInMonths({ dateModified: "2030-01-01", datePublished: null }, NOW)).toBe(0);
  });
});
