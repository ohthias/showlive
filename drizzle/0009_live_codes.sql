-- Registro global dos códigos ao vivo: um código leva a UM lugar de UM evento,
-- mesmo com muitos eventos ao vivo ao mesmo tempo (ver lib/live-codes.ts).
CREATE TABLE "live_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_codes" ADD CONSTRAINT "live_codes_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_codes_event_idx" ON "live_codes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "live_codes_ref_idx" ON "live_codes" USING btree ("kind","ref_id");--> statement-breakpoint
-- Registra os códigos que já estão ao vivo (prioridade: público, mesa, sala).
INSERT INTO "live_codes" ("code", "event_id", "kind", "ref_id")
SELECT "code", "id", 'public', "id" FROM "events" WHERE "code" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "live_codes" ("code", "event_id", "kind", "ref_id")
SELECT "code", "event_id", 'mesa', "id" FROM "access_codes" WHERE "code" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
INSERT INTO "live_codes" ("code", "event_id", "kind", "ref_id")
SELECT "code", "event_id", 'room', "id" FROM "judging_rooms" WHERE "code" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;--> statement-breakpoint
-- Se dois lugares já dividiam um código, quem perdeu fica sem código (o admin
-- gera outro em "trocar código"): melhor que mandar gente para o evento errado.
UPDATE "access_codes" a SET "code" = NULL
WHERE a."code" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "live_codes" l WHERE l."code" = a."code" AND l."kind" = 'mesa' AND l."ref_id" = a."id"
);--> statement-breakpoint
UPDATE "judging_rooms" r SET "code" = NULL
WHERE r."code" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "live_codes" l WHERE l."code" = r."code" AND l."kind" = 'room' AND l."ref_id" = r."id"
);