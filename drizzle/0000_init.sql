CREATE TYPE "public"."event_format" AS ENUM('fll');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'live', 'finished');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'scorer');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'pending');--> statement-breakpoint
CREATE TYPE "public"."playoff_format" AS ENUM('final', 'semifinal');--> statement-breakpoint
CREATE TYPE "public"."ranking_mode" AS ENUM('best', 'sum');--> statement-breakpoint
CREATE TYPE "public"."round_kind" AS ENUM('qualifying', 'semifinal', 'final');--> statement-breakpoint
CREATE TABLE "access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text DEFAULT 'Mesa' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text,
	"role" "member_role" DEFAULT 'admin' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_members_event_user_unique" UNIQUE("event_id","user_id"),
	CONSTRAINT "event_members_event_email_unique" UNIQUE("event_id","email")
);
--> statement-breakpoint
CREATE TABLE "event_settings" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"show_only_current_round" boolean DEFAULT false NOT NULL,
	"ranking_mode" "ranking_mode" DEFAULT 'best' NOT NULL,
	"enable_playoffs" boolean DEFAULT false NOT NULL,
	"playoff_format" "playoff_format" DEFAULT 'final' NOT NULL,
	"hide_scores_until_round_ends" boolean DEFAULT false NOT NULL,
	"highlight_leader" boolean DEFAULT true NOT NULL,
	"show_brackets" boolean DEFAULT true NOT NULL,
	"show_ticker" boolean DEFAULT true NOT NULL,
	"show_timer" boolean DEFAULT false NOT NULL,
	"celebrate_scores" boolean DEFAULT true NOT NULL,
	"rows_per_page" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"format" "event_format" DEFAULT 'fll' NOT NULL,
	"season" text NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"theme" jsonb NOT NULL,
	"timer_duration_sec" integer DEFAULT 150 NOT NULL,
	"timer_started_at" timestamp with time zone,
	"timer_remaining_ms" integer,
	"revision" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"kind" "round_kind" DEFAULT 'qualifying' NOT NULL,
	CONSTRAINT "rounds_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"responses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extras" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_by_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_team_round_unique" UNIQUE("team_id","round_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"number" text,
	"organization" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_settings" ADD CONSTRAINT "event_settings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_codes_event_idx" ON "access_codes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "activity_event_idx" ON "activity" USING btree ("event_id","id");--> statement-breakpoint
CREATE INDEX "event_members_user_idx" ON "event_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "event_members_email_idx" ON "event_members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "events_owner_idx" ON "events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "rounds_event_idx" ON "rounds" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "scores_event_idx" ON "scores" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "teams_event_idx" ON "teams" USING btree ("event_id");