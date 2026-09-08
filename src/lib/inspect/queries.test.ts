import { beforeAll, describe, expect, it } from "vitest";

// Base PGlite en mémoire, migrée au démarrage : test d'intégration sans fichier ni serveur.
process.env.PGLITE_DIR = "memory://inspect-test";
delete process.env.DATABASE_URL;

const { getDb, schema } = await import("@/db");
const { getUrlHistory, getInspectionsCostSince } = await import("./queries");

let projectId = "";

beforeAll(async () => {
  const db = await getDb();
  const [p] = await db.insert(schema.projects).values({ name: "T", brandName: "Rablab", domains: ["rablab.ca"] }).returning();
  projectId = p.id;
  const [pr] = await db.insert(schema.prompts).values({ projectId, text: "Quelle agence SEO à Montréal ?" }).returning();
  const [e] = await db.insert(schema.engines).values({ provider: "mock", model: "mock-v1", label: "Mock" }).returning();
  const [run] = await db.insert(schema.runs).values({ projectId, trigger: "cli", status: "done" }).returning();
  await db.insert(schema.results).values({
    runId: run.id,
    promptId: pr.id,
    engineId: e.id,
    webSearch: true,
    rawText: "…",
    sources: [
      { url: "https://www.digitad.ca/seo/", domain: "digitad.ca" },
      { url: "https://www.rablab.ca/blog/llm-seo/?utm_source=openai", domain: "rablab.ca" },
    ],
  });
  await db.insert(schema.inspections).values({ projectId, url: "https://rablab.ca/blog/llm-seo", normalizedUrl: "rablab.ca/blog/llm-seo", status: "done", costEstimate: 0.12 });
});

describe("getUrlHistory", () => {
  it("finds the URL in stored sources despite tracking params, www and trailing slash", async () => {
    const rows = await getUrlHistory(projectId, "http://rablab.ca/blog/llm-seo");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rank: 2, engineLabel: "Mock" });
  });
  it("returns nothing for another page", async () => {
    expect(await getUrlHistory(projectId, "https://rablab.ca/blog/autre")).toHaveLength(0);
  });
});

describe("getInspectionsCostSince", () => {
  it("sums inspection costs for the project", async () => {
    expect(await getInspectionsCostSince(projectId, new Date(Date.now() - 60_000))).toBeCloseTo(0.12, 5);
  });
});
