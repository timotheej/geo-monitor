CREATE TABLE "comparison_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"normalized_url" text NOT NULL,
	"url" text NOT NULL,
	"content_hash" text,
	"http_status" integer,
	"signals" jsonb,
	"page_type" text,
	"error" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"inspection_id" text,
	"url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"content_hash" text,
	"grid_version" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"signals" jsonb,
	"page_type" text,
	"access" jsonb,
	"content" jsonb,
	"result" jsonb,
	"score" integer,
	"confidence" text,
	"judge" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comparison" jsonb,
	"cost_estimate" real DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "page_analyses" ADD CONSTRAINT "page_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_analyses" ADD CONSTRAINT "page_analyses_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_pages_url_uniq" ON "comparison_pages" USING btree ("normalized_url");--> statement-breakpoint
CREATE INDEX "page_analyses_project_url_idx" ON "page_analyses" USING btree ("project_id","normalized_url");--> statement-breakpoint
CREATE INDEX "page_analyses_inspection_idx" ON "page_analyses" USING btree ("inspection_id");