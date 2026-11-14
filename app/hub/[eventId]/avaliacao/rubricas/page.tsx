import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { rubricEvaluations } from "@/db/schema";
import { RubricManager } from "@/components/judging/RubricManager";
import { loadHubEvent } from "@/lib/hub-data";
import { loadRubrics } from "@/lib/judging";
import { RUBRIC_PRESET_GROUPS, suggestedPresetGroup } from "@/lib/rubric-presets";

export const dynamic = "force-dynamic";

export default async function RubricsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadHubEvent(eventId, "admin");
  const db = await getDb();
  const [list, counts] = await Promise.all([
    loadRubrics(event.id),
    db
      .select({ rubricId: rubricEvaluations.rubricId, n: sql<number>`count(*)::int` })
      .from(rubricEvaluations)
      .where(eq(rubricEvaluations.eventId, event.id))
      .groupBy(rubricEvaluations.rubricId),
  ]);
  const n = new Map(counts.map((c) => [c.rubricId, c.n]));
  return (
    <RubricManager
      eventId={event.id}
      rubrics={list.map((r) => ({ id: r.id, name: r.name, description: r.description, weight: r.weight, definition: r.definition, sheets: n.get(r.id) ?? 0 }))}
      presetGroups={RUBRIC_PRESET_GROUPS.map((g) => ({
        id: g.id,
        label: g.label,
        description: g.description,
        origin: g.origin,
        sessionMinutes: g.sessionMinutes ?? null,
        recommended: g.recommended ?? g.presets.map((p) => p.id),
        presets: g.presets.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          weight: p.weight ?? 1,
          levels: p.definition.levels.map((l) => `${l.value} ${l.label}`),
          sections: p.definition.sections.map((s) => ({ title: s.title, criteria: s.criteria.map((c) => c.label) })),
        })),
      }))}
      suggested={suggestedPresetGroup(event.format)}
    />
  );
}
