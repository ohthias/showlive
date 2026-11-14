-- Avaliação por rubricas: sessões separadas da partida (salas da FLL, entrevista da FTC).
-- Nada daqui entra no snapshot do telão nem dispara os gatilhos de revisão.
CREATE TYPE "public"."evaluation_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."judging_session_status" AS ENUM('scheduled', 'in_progress', 'done', 'absent');--> statement-breakpoint
CREATE TABLE "judging_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rubric_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"code" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "judging_rooms_code_unique" UNIQUE("code"),
	CONSTRAINT "judging_rooms_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
CREATE TABLE "judging_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"room_id" uuid,
	"starts_at" timestamp with time zone,
	"duration_min" integer DEFAULT 30 NOT NULL,
	"status" "judging_session_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubric_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"rubric_id" uuid NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comments" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"feedback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"max_total" double precision DEFAULT 0 NOT NULL,
	"status" "evaluation_status" DEFAULT 'draft' NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_by_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubric_evaluations_session_rubric_unique" UNIQUE("session_id","rubric_id")
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"definition" jsonb NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubrics_event_name_unique" UNIQUE("event_id","name")
);
--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "judging_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "judging_include_robot_game" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "judging_robot_game_weight" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_rooms" ADD CONSTRAINT "judging_rooms_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_sessions" ADD CONSTRAINT "judging_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_sessions" ADD CONSTRAINT "judging_sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_sessions" ADD CONSTRAINT "judging_sessions_room_id_judging_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."judging_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_evaluations" ADD CONSTRAINT "rubric_evaluations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_evaluations" ADD CONSTRAINT "rubric_evaluations_session_id_judging_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."judging_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_evaluations" ADD CONSTRAINT "rubric_evaluations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_evaluations" ADD CONSTRAINT "rubric_evaluations_rubric_id_rubrics_id_fk" FOREIGN KEY ("rubric_id") REFERENCES "public"."rubrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "judging_rooms_event_idx" ON "judging_rooms" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "judging_sessions_event_idx" ON "judging_sessions" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE INDEX "judging_sessions_room_idx" ON "judging_sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "rubric_evaluations_event_idx" ON "rubric_evaluations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "rubrics_event_idx" ON "rubrics" USING btree ("event_id");