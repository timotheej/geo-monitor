import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull(),
  brandName: text("brand_name").notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
  domains: jsonb("domains").$type<string[]>().default([]).notNull(),
  locale: text("locale").default("fr-FR").notNull(),
  repeats: integer("repeats").default(1).notNull(),
  costCapEur: real("cost_cap_eur").default(5).notNull(),
  inspectionCostCapEur: real("inspection_cost_cap_eur").default(0.5).notNull(),
  inspectionsPerDay: integer("inspections_per_day").default(20).notNull(),
  createdAt: createdAt(),
});

export const competitors = pgTable("competitors", {
  id: id(),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]).notNull(),
  domains: jsonb("domains").$type<string[]>().default([]).notNull(),
  createdAt: createdAt(),
});

export const prompts = pgTable(
  "prompts",
  {
    id: id(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    text: text("text").notNull(),
    lang: text("lang").default("fr").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    webSearch: boolean("web_search").default(true).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("prompts_project_idx").on(t.projectId, t.active)],
);

export type Provider = "openai" | "anthropic" | "perplexity" | "mock";

export type EngineConfig = {
  /** Prix indicatifs en USD, servent uniquement à l'estimation de coût. */
  pricing?: {
    inputPerMTok: number;
    outputPerMTok: number;
    perSearch: number;
  };
  maxSearches?: number;
};

export const engines = pgTable("engines", {
  id: id(),
  provider: text("provider").$type<Provider>().notNull(),
  model: text("model").notNull(),
  label: text("label").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").$type<EngineConfig>().default({}).notNull(),
  createdAt: createdAt(),
});

export type RunStatus = "pending" | "running" | "done" | "failed";
export type RunTrigger = "manual" | "cron" | "cli";

export const runs = pgTable(
  "runs",
  {
    id: id(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    trigger: text("trigger").$type<RunTrigger>().notNull(),
    status: text("status").$type<RunStatus>().default("pending").notNull(),
    workflowRunId: text("workflow_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    plannedCount: integer("planned_count").default(0).notNull(),
    doneCount: integer("done_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    costEstimate: real("cost_estimate").default(0).notNull(),
    error: text("error"),
  },
  (t) => [index("runs_project_started_idx").on(t.projectId, t.startedAt)],
);

export type SourceRef = { url: string; title?: string; domain: string };
export type UsageRef = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  searches?: number;
};

export const results = pgTable(
  "results",
  {
    id: id(),
    runId: text("run_id")
      .references(() => runs.id, { onDelete: "cascade" })
      .notNull(),
    promptId: text("prompt_id")
      .references(() => prompts.id, { onDelete: "cascade" })
      .notNull(),
    engineId: text("engine_id")
      .references(() => engines.id, { onDelete: "cascade" })
      .notNull(),
    repeatIndex: integer("repeat_index").default(0).notNull(),
    webSearch: boolean("web_search").notNull(),
    rawText: text("raw_text").default("").notNull(),
    sources: jsonb("sources").$type<SourceRef[]>().default([]).notNull(),
    usage: jsonb("usage").$type<UsageRef>().default({}).notNull(),
    costEstimate: real("cost_estimate").default(0).notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("results_task_uniq").on(t.runId, t.promptId, t.engineId, t.repeatIndex),
    index("results_prompt_engine_idx").on(t.promptId, t.engineId, t.createdAt),
  ],
);

export type EntityType = "brand" | "competitor";

export const detections = pgTable(
  "detections",
  {
    id: id(),
    resultId: text("result_id")
      .references(() => results.id, { onDelete: "cascade" })
      .notNull(),
    entityType: text("entity_type").$type<EntityType>().notNull(),
    /** id du projet pour la marque, id du concurrent sinon */
    entityId: text("entity_id").notNull(),
    cited: boolean("cited").default(false).notNull(),
    mentioned: boolean("mentioned").default(false).notNull(),
    citationRank: integer("citation_rank"),
    mentionRank: integer("mention_rank"),
    matchedTerms: jsonb("matched_terms").$type<string[]>().default([]).notNull(),
  },
  (t) => [index("detections_result_idx").on(t.resultId), index("detections_entity_idx").on(t.entityType, t.entityId)],
);

export type InspectionStatus = "draft" | "running" | "done" | "failed";

export type PageSnapshot = {
  finalUrl: string;
  httpStatus: number;
  responseMs: number;
  redirects: number;
  title: string;
  h1: string;
  description: string;
  h2: string[];
  lang: string;
  wordCount: number;
  publishedAt: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  jsonLdTypes: string[];
  jsSuspect: boolean;
  fetchError?: string;
};

export type AccessSnapshot = {
  robotsFound: boolean;
  agents: Array<{ agent: string; vendor: string; role: string; allowed: boolean; explicit: boolean }>;
  allAllowed: boolean;
  llmsTxt: boolean;
  checkedAt: string;
};

export type InspectionQuestion = { text: string; lang: string; source: "generated" | "manual" };

export const inspections = pgTable(
  "inspections",
  {
    id: id(),
    projectId: text("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    url: text("url").notNull(),
    normalizedUrl: text("normalized_url").notNull(),
    contentHash: text("content_hash"),
    status: text("status").$type<InspectionStatus>().default("draft").notNull(),
    page: jsonb("page").$type<PageSnapshot | null>(),
    access: jsonb("access").$type<AccessSnapshot | null>(),
    questions: jsonb("questions").$type<InspectionQuestion[]>().default([]).notNull(),
    engineIds: jsonb("engine_ids").$type<string[]>().default([]).notNull(),
    /** Vrai si les questions viennent d'une inspection précédente (cache 7 jours) */
    questionsReused: boolean("questions_reused").default(false).notNull(),
    workflowRunId: text("workflow_run_id"),
    plannedCount: integer("planned_count").default(0).notNull(),
    doneCount: integer("done_count").default(0).notNull(),
    costEstimate: real("cost_estimate").default(0).notNull(),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("inspections_project_created_idx").on(t.projectId, t.createdAt), index("inspections_url_idx").on(t.projectId, t.normalizedUrl)],
);

export const inspectionAnswers = pgTable(
  "inspection_answers",
  {
    id: id(),
    inspectionId: text("inspection_id")
      .references(() => inspections.id, { onDelete: "cascade" })
      .notNull(),
    questionIndex: integer("question_index").notNull(),
    engineId: text("engine_id")
      .references(() => engines.id, { onDelete: "cascade" })
      .notNull(),
    rawText: text("raw_text").default("").notNull(),
    sources: jsonb("sources").$type<SourceRef[]>().default([]).notNull(),
    usage: jsonb("usage").$type<UsageRef>().default({}).notNull(),
    costEstimate: real("cost_estimate").default(0).notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    error: text("error"),
    urlCited: boolean("url_cited").default(false).notNull(),
    urlRank: integer("url_rank"),
    domainCited: boolean("domain_cited").default(false).notNull(),
    domainRank: integer("domain_rank"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("inspection_answers_uniq").on(t.inspectionId, t.questionIndex, t.engineId)],
);

export const projectsRelations = relations(projects, ({ many }) => ({
  competitors: many(competitors),
  prompts: many(prompts),
  runs: many(runs),
}));
export const competitorsRelations = relations(competitors, ({ one }) => ({
  project: one(projects, { fields: [competitors.projectId], references: [projects.id] }),
}));
export const promptsRelations = relations(prompts, ({ one, many }) => ({
  project: one(projects, { fields: [prompts.projectId], references: [projects.id] }),
  results: many(results),
}));
export const runsRelations = relations(runs, ({ one, many }) => ({
  project: one(projects, { fields: [runs.projectId], references: [projects.id] }),
  results: many(results),
}));
export const resultsRelations = relations(results, ({ one, many }) => ({
  run: one(runs, { fields: [results.runId], references: [runs.id] }),
  prompt: one(prompts, { fields: [results.promptId], references: [prompts.id] }),
  engine: one(engines, { fields: [results.engineId], references: [engines.id] }),
  detections: many(detections),
}));
export const detectionsRelations = relations(detections, ({ one }) => ({
  result: one(results, { fields: [detections.resultId], references: [results.id] }),
}));
export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  project: one(projects, { fields: [inspections.projectId], references: [projects.id] }),
  answers: many(inspectionAnswers),
}));
export const inspectionAnswersRelations = relations(inspectionAnswers, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionAnswers.inspectionId], references: [inspections.id] }),
  engine: one(engines, { fields: [inspectionAnswers.engineId], references: [engines.id] }),
}));

export type Project = typeof projects.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Engine = typeof engines.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Detection = typeof detections.$inferSelect;
export type Inspection = typeof inspections.$inferSelect;
export type InspectionAnswer = typeof inspectionAnswers.$inferSelect;
