-- Telão: aviso atual da organização (um só) e câmera. event_settings já tem gatilho de revisão.
ALTER TABLE "event_settings" ADD COLUMN "screen_message" jsonb;--> statement-breakpoint
ALTER TABLE "event_settings" ADD COLUMN "camera" jsonb;