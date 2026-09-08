import { describe, expect, it } from "vitest";
import { classifyQuestionHeuristic, findPlace, keyTerms } from "./classify-question";

describe("classifyQuestionHeuristic", () => {
  it("comparative avec lieu", () => {
    expect(classifyQuestionHeuristic("Quelle est la meilleure agence SEO à Montréal ?", "fr")).toEqual({ intent: "comparative", place: "Montréal" });
    expect(classifyQuestionHeuristic("Best SEO agency in Montreal", "en")).toEqual({ intent: "comparative", place: "Montréal" });
    expect(classifyQuestionHeuristic("Top agences de marketing web au Québec")).toEqual({ intent: "comparative", place: "Québec" });
    expect(classifyQuestionHeuristic("Quelle agence choisir pour refaire mon site ?")).toEqual({ intent: "comparative" });
  });

  it("price", () => {
    expect(classifyQuestionHeuristic("Combien coûte une agence SEO à Laval ?")).toEqual({ intent: "price", place: "Laval" });
    expect(classifyQuestionHeuristic("Quels sont les tarifs d'un consultant SEO ?").intent).toBe("price");
    expect(classifyQuestionHeuristic("How much does SEO cost in Toronto?", "en")).toEqual({ intent: "price", place: "Toronto" });
  });

  it("informational", () => {
    expect(classifyQuestionHeuristic("Qu'est-ce que le SEO ?").intent).toBe("informational");
    expect(classifyQuestionHeuristic("Comment fonctionne Core Web Vitals ?").intent).toBe("informational");
    expect(classifyQuestionHeuristic("Pourquoi mon site n'apparaît pas sur Google").intent).toBe("informational");
    expect(classifyQuestionHeuristic("What is the difference between SEO and SEM?", "en").intent).toBe("informational");
    expect(classifyQuestionHeuristic("LLM et SEO").intent).toBe("informational");
  });

  it("resource", () => {
    expect(classifyQuestionHeuristic("Quelle formation SEO suivre au Québec ?")).toEqual({ intent: "resource", place: "Québec" });
    expect(classifyQuestionHeuristic("Où trouver un bon podcast sur le marketing web").intent).toBe("resource");
    expect(classifyQuestionHeuristic("Quels outils pour suivre ses positions Google").intent).toBe("resource");
  });

  it("local sans autre intention", () => {
    expect(classifyQuestionHeuristic("Agence SEO Montréal")).toEqual({ intent: "local", place: "Montréal" });
    expect(classifyQuestionHeuristic("Agence de marketing web à Trois-Rivières")).toEqual({ intent: "local", place: "Trois-Rivières" });
  });

  it("findPlace : sans accent, ville composée, province", () => {
    expect(findPlace("agence a montreal")).toBe("Montréal");
    expect(findPlace("agence à Quebec City")).toBe("Quebec City");
    expect(findPlace("agence en Colombie-Britannique")).toBe("Colombie-Britannique");
    expect(findPlace("agence à Paris")).toBeUndefined();
    expect(findPlace("Montréalais")).toBeUndefined();
  });

  it("keyTerms retire les mots-outils et les marqueurs", () => {
    expect(keyTerms("Quelle est la meilleure agence SEO à Montréal ?")).toEqual(["agence", "seo", "montreal"]);
    expect(keyTerms("How much does an SEO audit cost?")).toEqual(["much", "seo", "audit", "cost"]);
  });
});
