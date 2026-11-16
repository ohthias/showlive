-- Cenas do telão: até 4 disposições prontas e qual está no ar (event_settings já tem gatilho de revisão).
ALTER TABLE "event_settings" ADD COLUMN "scenes" jsonb;