CREATE TABLE "inspection_answers" (
	"id" text PRIMARY KEY NOT NULL,
	"inspection_id" text NOT NULL,
	"question_index" integer NOT NULL,
	"engine_id" text NOT NULL,
	"raw_text" text DEFAULT '' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cost_estimate" real DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"url_cited" boolean DEFAULT false NOT NULL,
	"url_rank" integer,
	"domain_cited" boolean DEFAULT false NOT NULL,
	"domain_rank" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"content_hash" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"page" jsonb,
	"access" jsonb,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engine_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions_reused" boolean DEFAULT false NOT NULL,
	"workflow_run_id" text,
	"planned_count" integer DEFAULT 0 NOT NULL,
	"done_count" integer DEFAULT 0 NOT NULL,
	"cost_estimate" real DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "inspection_cost_cap_eur" real DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "inspections_per_day" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD CONSTRAINT "inspection_answers_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD CONSTRAINT "inspection_answers_engine_id_engines_id_fk" FOREIGN KEY ("engine_id") REFERENCES "public"."engines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inspection_answers_uniq" ON "inspection_answers" USING btree ("inspection_id","question_index","engine_id");--> statement-breakpoint
CREATE INDEX "inspections_project_created_idx" ON "inspections" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "inspections_url_idx" ON "inspections" USING btree ("project_id","normalized_url");