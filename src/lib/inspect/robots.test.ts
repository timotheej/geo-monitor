import { describe, expect, it } from "vitest";
import { evaluateRobots } from "./robots";

const page = "https://rablab.ca/blog/loi-25";
const robotsUrl = "https://rablab.ca/robots.txt";

describe("evaluateRobots", () => {
  it("allows everything when robots.txt is missing", () => {
    const r = evaluateRobots(robotsUrl, null, page);
    expect(r.found).toBe(false);
    expect(r.allAllowed).toBe(true);
  });
  it("applies agent-specific disallow with explicit flag", () => {
    const r = evaluateRobots(robotsUrl, "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n", page);
    const gpt = r.agents.find((a) => a.agent === "GPTBot")!;
    const claude = r.agents.find((a) => a.agent === "ClaudeBot")!;
    expect(gpt).toMatchObject({ allowed: false, explicit: true });
    expect(claude).toMatchObject({ allowed: true, explicit: false });
    expect(r.allAllowed).toBe(false);
  });
  it("respects path rules for the wildcard agent", () => {
    const r = evaluateRobots(robotsUrl, "User-agent: *\nDisallow: /blog/\n", page);
    expect(r.agents.every((a) => !a.allowed)).toBe(true);
    const r2 = evaluateRobots(robotsUrl, "User-agent: *\nDisallow: /admin/\n", page);
    expect(r2.allAllowed).toBe(true);
  });
});
