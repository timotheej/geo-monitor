import { beforeAll, describe, expect, it } from "vitest";

// Base PGlite en mémoire, migrée au démarrage : test d'intégration sans fichier ni serveur.
process.env.PGLITE_DIR = "memory://dashboard-test";
delete process.env.DATABASE_URL;

const { getDb, schema } = await import("@/db");
const q = await import("./dashboard-queries");

const DAY = 86_400_000;
const today = new Date(Date.now() - 2 * 3_600_000);
/** Même jour que `today`, une minute plus tard : ordre chronologique sans égalité. */
const todayLater = new Date(today.getTime() + 60_000);
const yesterday = new Date(Date.now() - DAY - 3_600_000);
const lastPeriod = new Date(Date.now() - 45 * DAY);

let projectId = "";
let otherProjectId = "";
let competitorId = "";
let citedPromptId = "";
let rivalPromptId = "";
let emptyPromptId = "";
let engineA = "";
let engineB = "";

type Det = { cited: boolean; mentioned: boolean };

beforeAll(async () => {
  const db = await getDb();
  const [p] = await db.insert(schema.projects).values({ name: "Rablab", brandName: "Rablab", aliases: ["rablab"], domains: ["rablab.ca"] }).returning();
  projectId = p.id;
  const [other] = await db.insert(schema.projects).values({ name: "Autre", brandName: "Autre", domains: ["autre.fr"] }).returning();
  otherProjectId = other.id;
  const [c] = await db.insert(schema.competitors).values({ projectId, name: "Digitad", domains: ["digitad.ca"] }).returning();
  competitorId = c.id;

  const [pr1] = await db.insert(schema.prompts).values({ projectId, text: "Quelle agence SEO à Montréal ?", tags: ["seo"] }).returning();
  const [pr2] = await db.insert(schema.prompts).values({ projectId, text: "Quelle agence pour le SEO des LLM ?", tags: ["seo", "llm"] }).returning();
  const [pr3] = await db.insert(schema.prompts).values({ projectId, text: "Comment louer un appartement ?" }).returning();
  citedPromptId = pr1.id;
  rivalPromptId = pr2.id;
  emptyPromptId = pr3.id;
  // Prompt d'un autre projet, jamais dans nos résultats
  const [prOther] = await db.insert(schema.prompts).values({ projectId: otherProjectId, text: "Autre question", tags: ["seo"] }).returning();

  const [a] = await db.insert(schema.engines).values({ provider: "openai", model: "gpt-test", label: "ChatGPT" }).returning();
  const [b] = await db.insert(schema.engines).values({ provider: "anthropic", model: "claude-test", label: "Claude" }).returning();
  engineA = a.id;
  engineB = b.id;

  const [run] = await db.insert(schema.runs).values({ projectId, trigger: "cli", status: "done" }).returning();
  const [otherRun] = await db.insert(schema.runs).values({ projectId: otherProjectId, trigger: "cli", status: "done" }).returning();

  // Contrainte d'unicité (run, prompt, moteur, répétition) : chaque insertion prend un index distinct.
  let repeat = 0;
  async function result(
    opts: {
      runId?: string;
      promptId: string;
      engineId: string;
      createdAt: Date;
      sources?: Array<{ url: string; domain: string }>;
      brand?: Det;
      competitor?: Det;
      error?: string;
      latencyMs?: number;
      cost?: number;
    },
  ) {
    const [r] = await db
      .insert(schema.results)
      .values({
        runId: opts.runId ?? run.id,
        promptId: opts.promptId,
        engineId: opts.engineId,
        webSearch: true,
        rawText: "…",
        sources: opts.sources ?? [],
        createdAt: opts.createdAt,
        error: opts.error,
        latencyMs: opts.latencyMs ?? 1000,
        costEstimate: opts.cost ?? 0.01,
        repeatIndex: repeat++,
      })
      .returning();
    if (opts.error) return r;
    await db.insert(schema.detections).values([
      { resultId: r.id, entityType: "brand", entityId: projectId, ...(opts.brand ?? { cited: false, mentioned: false }) },
      { resultId: r.id, entityType: "competitor", entityId: competitorId, ...(opts.competitor ?? { cited: false, mentioned: false }) },
    ]);
    return r;
  }

  const rablab = { url: "https://www.rablab.ca/blog/seo-llm/?utm_source=chatgpt", domain: "rablab.ca" };
  const rablabClean = { url: "https://rablab.ca/blog/seo-llm", domain: "rablab.ca" };
  const digitad = { url: "https://www.digitad.ca/seo/", domain: "digitad.ca" };
  const clutch = { url: "https://clutch.co/ca/seo", domain: "clutch.co" };

  // Prompt 1, marque citée sur ChatGPT (deux jours), mentionnée seulement sur Claude
  await result({ promptId: citedPromptId, engineId: engineA, createdAt: today, sources: [rablab, clutch], brand: { cited: true, mentioned: true }, latencyMs: 800, cost: 0.02 });
  await result({ promptId: citedPromptId, engineId: engineA, createdAt: yesterday, sources: [rablabClean], brand: { cited: true, mentioned: true }, latencyMs: 1200 });
  await result({ promptId: citedPromptId, engineId: engineB, createdAt: todayLater, sources: [clutch], brand: { cited: false, mentioned: true }, latencyMs: 3000 });
  // Prompt 2, concurrent cité et pas nous, sur les deux moteurs
  await result({ promptId: rivalPromptId, engineId: engineA, createdAt: today, sources: [digitad, clutch], competitor: { cited: true, mentioned: true }, latencyMs: 900 });
  await result({ promptId: rivalPromptId, engineId: engineB, createdAt: yesterday, sources: [digitad], competitor: { cited: true, mentioned: true }, latencyMs: 2000 });
  // Prompt 3, personne
  await result({ promptId: emptyPromptId, engineId: engineA, createdAt: today, sources: [], latencyMs: 700 });
  // Erreur moteur, ignorée des taux
  await result({ promptId: emptyPromptId, engineId: engineB, createdAt: today, error: "timeout" });
  // Période précédente : marque jamais citée, pour la variation
  await result({ promptId: citedPromptId, engineId: engineA, createdAt: lastPeriod, sources: [clutch], brand: { cited: false, mentioned: false } });
  // Autre projet, jamais compté
  await result({ runId: otherRun.id, promptId: prOther.id, engineId: engineA, createdAt: today, sources: [rablab], brand: { cited: true, mentioned: true } });
});

describe("getEngineCards", () => {
  it("computes rates, delta and cost per engine on the period", async () => {
    const cards = await q.getEngineCards(projectId, 30);
    const a = cards.find((c) => c.id === engineA)!;
    const b = cards.find((c) => c.id === engineB)!;
    expect(a).toMatchObject({ label: "ChatGPT", provider: "openai", answers: 4 });
    expect(a.citationRate).toBeCloseTo(0.5, 5);
    expect(a.mentionRate).toBeCloseTo(0.5, 5);
    // Période précédente : 0 % de citation, donc +50 points
    expect(a.citationDelta).toBeCloseTo(50, 5);
    expect(a.costEur).toBeCloseTo((0.02 + 0.01 * 3) * 0.92, 5);
    // Claude : 2 réponses valides sur 3, l'erreur ne compte pas
    expect(b.answers).toBe(2);
    expect(b.citationRate).toBe(0);
    expect(b.mentionRate).toBeCloseTo(0.5, 5);
    expect(b.citationDelta).toBeNull();
  });
  it("ignores the previous period when days is 7", async () => {
    const [a] = await q.getEngineCards(projectId, 7);
    expect(a.citationDelta).toBeNull();
  });
});

describe("getShareOfVoice", () => {
  it("ranks brand and competitors with share and prompt counts", async () => {
    const rows = await q.getShareOfVoice(projectId, 30);
    expect(rows).toHaveLength(2);
    const brand = rows.find((r) => r.entityType === "brand")!;
    const rival = rows.find((r) => r.entityType === "competitor")!;
    expect(brand).toMatchObject({ name: "Rablab", answers: 6, cited: 2, mentioned: 3, promptCount: 1 });
    expect(brand.citationRate).toBeCloseTo(2 / 6, 5);
    expect(brand.share).toBeCloseTo(0.5, 5);
    expect(rival).toMatchObject({ name: "Digitad", cited: 2, mentioned: 2, promptCount: 1 });
    expect(brand.citationDelta).toBeCloseTo((2 / 6) * 100, 5);
  });
});

describe("getQuickOpportunities", () => {
  it("lists prompts where a competitor is cited without the brand", async () => {
    const rows = await q.getQuickOpportunities(projectId, 30);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ promptId: rivalPromptId, answers: 2, tags: ["seo", "llm"] });
    expect(rows[0].competitors).toEqual([{ id: competitorId, name: "Digitad", answers: 2 }]);
  });
});

describe("getEngineThemeMatrix", () => {
  it("aggregates brand citation by tag and engine, untagged prompts under a default theme", async () => {
    const m = await q.getEngineThemeMatrix(projectId, 30);
    expect(m.themes).toEqual(["llm", "seo", q.NO_THEME]);
    expect(m.engines.map((e) => e.id).sort()).toEqual([engineA, engineB].sort());
    expect(m.cells.seo[engineA]).toEqual({ total: 3, cited: 2, mentioned: 2 });
    expect(m.cells.seo[engineB]).toEqual({ total: 2, cited: 0, mentioned: 1 });
    expect(m.cells.llm[engineA]).toEqual({ total: 1, cited: 0, mentioned: 0 });
    expect(m.cells[q.NO_THEME][engineA]).toEqual({ total: 1, cited: 0, mentioned: 0 });
    expect(m.cells[q.NO_THEME][engineB]).toBeUndefined();
  });
});

describe("getThemeSummary", () => {
  it("gives one block per theme with prompt counts and per-engine detail", async () => {
    const rows = await q.getThemeSummary(projectId, 30);
    const seo = rows.find((r) => r.theme === "seo")!;
    expect(seo).toMatchObject({ promptCount: 2, answers: 5 });
    expect(seo.citationRate).toBeCloseTo(2 / 5, 5);
    expect(seo.mentionRate).toBeCloseTo(3 / 5, 5);
    expect(seo.engines.find((e) => e.id === engineA)).toMatchObject({ label: "ChatGPT", total: 3, cited: 2 });
    expect(rows.at(-1)?.theme).toBe(q.NO_THEME);
    expect(rows[0].theme).toBe("seo");
  });
});

describe("getEngineDomains", () => {
  it("returns top domains per engine with brand and competitor badges", async () => {
    const rows = await q.getEngineDomains(projectId, 30, 8);
    const a = rows.find((r) => r.engine.id === engineA)!;
    expect(a.answers).toBe(4);
    // clutch.co et rablab.ca à égalité (2), tri alphabétique ensuite
    expect(a.domains.map((d) => d.domain)).toEqual(["clutch.co", "rablab.ca", "digitad.ca"]);
    expect(a.domains[0]).toMatchObject({ count: 2, entity: null });
    expect(a.domains[1]).toMatchObject({ count: 2, entity: "brand", entityName: "Rablab" });
    expect(a.domains.find((d) => d.domain === "digitad.ca")).toMatchObject({ count: 1, entity: "competitor", entityName: "Digitad" });
    const b = rows.find((r) => r.engine.id === engineB)!;
    expect(b.domains.map((d) => d.domain).sort()).toEqual(["clutch.co", "digitad.ca"]);
  });
});

describe("getEngineStats", () => {
  it("computes median latency, average cost and sources share", async () => {
    const rows = await q.getEngineStats(projectId, 30);
    const a = rows.find((r) => r.engine.id === engineA)!;
    expect(a).toMatchObject({ answers: 4, errors: 0, model: "gpt-test" });
    expect(a.medianLatencyMs).toBe(850);
    expect(a.avgCostEur).toBeCloseTo(((0.02 + 0.03) / 4) * 0.92, 5);
    expect(a.avgSources).toBeCloseTo(5 / 4, 5);
    expect(a.withSourcesRate).toBeCloseTo(3 / 4, 5);
    const b = rows.find((r) => r.engine.id === engineB)!;
    expect(b).toMatchObject({ answers: 2, errors: 1, medianLatencyMs: 2500 });
    expect(b.withSourcesRate).toBe(1);
  });
});

describe("getPromptHistory", () => {
  it("returns chronological results with brand status and cited competitors", async () => {
    const rows = await q.getPromptHistory(rivalPromptId, 30);
    expect(rows).toHaveLength(2);
    expect(rows[0].engine.id).toBe(engineB);
    expect(rows[0]).toMatchObject({ status: "none", competitors: ["Digitad"], sourcesCount: 1 });
    expect(rows[1].engine.id).toBe(engineA);
    const cited = await q.getPromptHistory(citedPromptId, 30);
    expect(cited.map((r) => r.status)).toEqual(["cited", "cited", "mentioned"]);
    expect(cited[0].costEur).toBeCloseTo(0.01 * 0.92, 5);
  });
  it("marks engine errors", async () => {
    const rows = await q.getPromptHistory(emptyPromptId, 30);
    expect(rows.map((r) => r.status).sort()).toEqual(["error", "none"]);
  });
  it("returns nothing for an unknown prompt", async () => {
    expect(await q.getPromptHistory("nope", 30)).toEqual([]);
  });
});

describe("getPromptCompetitors", () => {
  it("counts citations and mentions per competitor on a prompt", async () => {
    const rows = await q.getPromptCompetitors(rivalPromptId, 30);
    expect(rows).toEqual([{ id: competitorId, name: "Digitad", cited: 2, mentioned: 2, answers: 2 }]);
    const none = await q.getPromptCompetitors(emptyPromptId, 30);
    expect(none[0]).toMatchObject({ cited: 0, mentioned: 0, answers: 1 });
  });
});

describe("getShareOfVoiceSeries", () => {
  it("gives daily citation counts per entity", async () => {
    const rows = await q.getShareOfVoiceSeries(projectId, 30);
    const brand = rows.filter((r) => r.entityType === "brand");
    expect(brand.map((r) => r.cited)).toEqual([1, 1]);
    expect(brand[0].day < brand[1].day).toBe(true);
    expect(rows.find((r) => r.entityType === "competitor")).toMatchObject({ name: "Digitad" });
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day))).toBe(true);
  });
});

describe("getCompetitorOverlap", () => {
  it("lists prompts won by the competitor and its most cited pages", async () => {
    const [d] = await q.getCompetitorOverlap(projectId, 30);
    expect(d.name).toBe("Digitad");
    expect(d.prompts).toEqual([{ promptId: rivalPromptId, text: "Quelle agence pour le SEO des LLM ?", answers: 2 }]);
    expect(d.pages).toEqual([{ url: "https://www.digitad.ca/seo/", count: 2 }]);
  });
});

describe("getDomainsInsteadOfUs", () => {
  it("lists third-party domains cited when the brand is not, with brand presence", async () => {
    const rows = await q.getDomainsInsteadOfUs(projectId, 30);
    expect(rows.map((r) => r.domain)).toEqual(["clutch.co", "digitad.ca"]);
    const clutch = rows[0];
    // clutch.co : 3 réponses sur la période, dont 1 où la marque est aussi citée
    expect(clutch).toMatchObject({ answers: 3, withoutBrand: 2, brandPresent: true, entity: null });
    expect(clutch.engines.map((e) => e.id).sort()).toEqual([engineA, engineB].sort());
    expect(rows[1]).toMatchObject({ answers: 2, withoutBrand: 2, brandPresent: false, entity: "competitor", entityName: "Digitad" });
    expect(rows.some((r) => r.domain === "rablab.ca")).toBe(false);
  });
});

describe("getBrandPages", () => {
  it("groups brand URLs despite tracking params and www", async () => {
    const rows = await q.getBrandPages(projectId, 30);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 2, promptCount: 1 });
    expect(rows[0].engines.map((e) => e.id)).toEqual([engineA]);
  });
});

describe("getPromptsWithoutBrand", () => {
  it("lists prompts never cited on the period, competitors first", async () => {
    const rows = await q.getPromptsWithoutBrand(projectId, 30);
    expect(rows.map((r) => r.promptId)).toEqual([rivalPromptId, emptyPromptId]);
    expect(rows[0]).toMatchObject({ answers: 2, competitors: ["Digitad"], mentioned: 0 });
    expect(rows[1]).toMatchObject({ answers: 1, competitors: [] });
  });
});

describe("getProjects", () => {
  it("lists projects in creation order", async () => {
    const rows = await q.getProjects();
    expect(rows.map((r) => r.name)).toEqual(["Rablab", "Autre"]);
  });
});
