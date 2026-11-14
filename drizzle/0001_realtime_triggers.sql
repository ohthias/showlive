-- Realtime do ShowLive
-- Toda mudança que aparece ao vivo incrementa events.revision. O stream SSE
-- (app/api/live/[code]/stream) só compara esse número para decidir se manda
-- um novo snapshot — uma consulta trivial, independente do nº de telas.

CREATE OR REPLACE FUNCTION showlive_bump_revision() RETURNS trigger AS $$
DECLARE
  target uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.event_id;
  ELSE
    target := NEW.event_id;
  END IF;
  UPDATE events SET revision = revision + 1, updated_at = now() WHERE id = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Mudanças diretas no evento (nome, tema, cronômetro, status) também contam.
-- Se quem atualizou já mexeu na revisão (o gatilho acima), não soma de novo.
CREATE OR REPLACE FUNCTION showlive_event_self_bump() RETURNS trigger AS $$
BEGIN
  IF NEW.revision = OLD.revision THEN
    NEW.revision := OLD.revision + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER events_self_bump BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION showlive_event_self_bump();
--> statement-breakpoint
CREATE TRIGGER teams_bump AFTER INSERT OR UPDATE OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION showlive_bump_revision();
--> statement-breakpoint
CREATE TRIGGER rounds_bump AFTER INSERT OR UPDATE OR DELETE ON rounds
  FOR EACH ROW EXECUTE FUNCTION showlive_bump_revision();
--> statement-breakpoint
CREATE TRIGGER scores_bump AFTER INSERT OR UPDATE OR DELETE ON scores
  FOR EACH ROW EXECUTE FUNCTION showlive_bump_revision();
--> statement-breakpoint
CREATE TRIGGER event_settings_bump AFTER INSERT OR UPDATE ON event_settings
  FOR EACH ROW EXECUTE FUNCTION showlive_bump_revision();
