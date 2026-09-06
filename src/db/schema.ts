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

export type Project = typeof projects.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type Engine = typeof engines.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Detection = typeof detections.$inferSelect;
