ALTER TYPE "public"."event_format" ADD VALUE 'fll_fe';--> statement-breakpoint
ALTER TYPE "public"."event_format" ADD VALUE 'obr';--> statement-breakpoint
ALTER TYPE "public"."ranking_mode" ADD VALUE 'best2';--> statement-breakpoint
ALTER TYPE "public"."round_kind" ADD VALUE 'extra';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "league" jsonb;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "tiebreak" double precision;