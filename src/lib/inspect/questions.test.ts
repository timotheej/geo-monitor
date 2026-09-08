import { describe, expect, it } from "vitest";
import { forbiddenTerms, violatesNeutrality } from "./questions";
import type { Project } from "@/db/schema";

const project = { brandName: "Rablab", aliases: ["Rabacadémie"], domains: ["rablab.ca"] } as unknown as Project;

describe("neutrality check", () => {
  const forbidden = forbiddenTerms(project, ["Digitad", "Adviso"]);
  it("builds the forbidden list from brand, aliases, domains and competitors", () => {
    expect(forbidden).toEqual(expect.arrayContaining(["Rablab", "Rabacadémie", "rablab.ca", "rablab", "Digitad", "Adviso"]));
  });
  it("rejects questions naming the brand or a competitor, accent-insensitive", () => {
    expect(violatesNeutrality("Que propose la Rabacademie comme formation ?", forbidden)).toBe("Rabacadémie");
    expect(violatesNeutrality("Rablab ou Digitad pour du SEO ?", forbidden)).toBe("Rablab");
    expect(violatesNeutrality("Quelle agence SEO choisir à Montréal ?", forbidden)).toBeNull();
  });
});
