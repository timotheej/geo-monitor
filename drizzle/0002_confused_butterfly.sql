ALTER TABLE "detections" ADD COLUMN "retrieved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "detections" ADD COLUMN "retrieved_rank" integer;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "search_queries" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "url_retrieved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "domain_retrieved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "search_queries" jsonb DEFAULT '[]'::jsonb NOT NULL;