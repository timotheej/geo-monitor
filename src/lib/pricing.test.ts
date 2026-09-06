import { describe, expect, it } from "vitest";
import { estimateCostUsd, pricingFor } from "./pricing";

describe("pricing", () => {
  it("uses the model price when known, provider default otherwise, config override first", () => {
    expect(pricingFor("openai", "gpt-5.4-mini", {}).inputPerMTok).toBe(0.75);
    expect(pricingFor("openai", "gpt-9-unknown", {}).inputPerMTok).toBe(2.5);
    expect(pricingFor("openai", "gpt-5.4-mini", { pricing: { inputPerMTok: 1, outputPerMTok: 2, perSearch: 0 } }).inputPerMTok).toBe(1);
  });
  it("estimates a gpt-5.4-mini answer with one search", () => {
    const usd = estimateCostUsd("openai", {}, { inputTokens: 8708, outputTokens: 394, searches: 1 }, "gpt-5.4-mini");
    expect(usd).toBeCloseTo(0.0183, 3);
  });
  it("costs nothing for the mock engine", () => {
    expect(estimateCostUsd("mock", {}, { inputTokens: 400, outputTokens: 120, searches: 1 }, "mock-v1")).toBe(0);
  });
});
