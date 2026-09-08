import { describe, expect, it } from "vitest";
import { buildJudgePrompt, MAX_TEXT_CHARS } from "./judge";

describe("buildJudgePrompt", () => {
  const page = { url: "https://rablab.ca/blog/x", title: "Titre", h1: "H1 différent", description: "Desc", headings: ["A", "B"], text: "x".repeat(10_000) };
  it("uses the question language and truncates the text", () => {
    const fr = buildJudgePrompt({ question: "Quelle agence ?", questionLang: "fr", page });
    expect(fr.system).toContain("Barème");
    expect(fr.prompt).toContain("H1 : H1 différent");
    expect(fr.prompt.length).toBeLessThan(MAX_TEXT_CHARS + 400);
    const en = buildJudgePrompt({ question: "Which agency?", questionLang: "en", page });
    expect(en.system).toContain("Scale");
  });
});
