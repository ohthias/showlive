-- Formato de alianças (estilo FTC): partidas vermelha × azul ou cooperativas.
-- As partidas aparecem ao vivo, então também incrementam events.revision.
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'pending', 'final');--> statement-breakpoint
ALTER TYPE "public"."event_format" ADD VALUE 'alliance';--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"field" text,
	"scheduled_at" timestamp with time zone,
	"red" jsonb NOT NULL,
	"blue" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"red_score" double precision,
	"blue_score" double precision,
	"result" jsonb,
	"confirmed_by_teams" boolean DEFAULT false NOT NULL,
	"submitted_by" text,
	"submitted_by_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_event_number_unique" UNIQUE("event_id","number")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_event_idx" ON "matches" USING btree ("event_id");--> statement-breakpoint
CREATE TRIGGER matches_bump AFTER INSERT OR UPDATE OR DELETE ON matches
  FOR EACH ROW EXECUTE FUNCTION showlive_bump_revision();
