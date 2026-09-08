import { describe, expect, it } from "vitest";
import { isAnalysisStale, recommendedReading } from "./reading";

const A = (total: number) => ({ total, max: 20 });
const B = (total: number) => ({ total, max: 40 });
const C = (total: number) => ({ total, max: 40 });

describe("recommendedReading", () => {
  it("accès faible avant tout le reste", () => {
    expect(recommendedReading(A(5), B(38), C(38)).key).toBe("access-low");
  });
  it("accès bon, contenu bon, résultat faible : recherche et notoriété", () => {
    expect(recommendedReading(A(20), B(32), C(7)).key).toBe("search");
  });
  it("accès bon, contenu faible ou moyen, résultat faible : contenu", () => {
    expect(recommendedReading(A(18), B(10), C(5)).key).toBe("content");
    expect(recommendedReading(A(18), B(20), C(5)).key).toBe("content");
  });
  it("résultat bon malgré contenu faible : la marque porte la page", () => {
    expect(recommendedReading(A(18), B(10), C(35)).key).toBe("brand");
  });
  it("sinon, phrase neutre", () => {
    expect(recommendedReading(A(18), B(30), C(20)).key).toBe("neutral");
    expect(recommendedReading(A(20), B(38), C(38)).key).toBe("neutral");
  });
});

describe("isAnalysisStale", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  it("grille différente", () => {
    expect(isAnalysisStale({ createdAt: now, gridVersion: "old" }, "new", now)).toBe(true);
  });
  it("plus de 7 jours", () => {
    expect(isAnalysisStale({ createdAt: new Date("2026-08-30T12:00:00Z"), gridVersion: "g" }, "g", now)).toBe(true);
    expect(isAnalysisStale({ createdAt: new Date("2026-09-02T12:00:00Z"), gridVersion: "g" }, "g", now)).toBe(false);
  });
});
