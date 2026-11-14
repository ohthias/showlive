ALTER TYPE "public"."event_format" ADD VALUE 'custom';--> statement-breakpoint
CREATE TABLE "challenge_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_codes" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "points" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "challenge" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "template_id" uuid;--> statement-breakpoint
CREATE INDEX "challenge_templates_owner_idx" ON "challenge_templates" USING btree ("owner_id");--> statement-breakpoint
-- Códigos só existem com o evento ao vivo: limpa os de eventos fora do ar.
UPDATE "events" SET "code" = NULL WHERE "status" <> 'live';--> statement-breakpoint
UPDATE "access_codes" SET "code" = NULL WHERE "event_id" IN (SELECT "id" FROM "events" WHERE "status" <> 'live');
