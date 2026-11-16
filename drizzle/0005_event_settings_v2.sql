CREATE TYPE "public"."score_status" AS ENUM('approved', 'pending');--> statement-breakpoint
ALTER TABLE "access_codes" ADD COLUMN "allowed_round_ids" jsonb;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "submissions_paused" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "require_team_confirmation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "referee_edit_window_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "volunteers_control_timer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "volunteers_see_ranking" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "mesa_notice" text;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "require_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "scorers_can_edit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "show_team_details" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "show_qr_code" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "status" "score_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "confirmed_by_team" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "reviewed_by" text;