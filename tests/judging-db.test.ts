import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { sanitizeRubric } from "@/lib/rubric";
import { RUBRIC_PRESET_GROUPS } from "@/lib/rubric-presets";

/** Tabelas da avaliação por rubricas: restrições, cascatas e isolamento do telão. */
describe("avaliação por rubricas no banco", () => {
  it("uma ficha por rubrica e sessão, cascatas e nenhuma revisão do telão", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const { events, teams, rubrics, judgingRooms, judgingSessions, rubricEvaluations } = schema;

    const [ev] = await db
      .insert(events)
      .values({ name: "T", ownerId: "u", season: "s", theme: { preset: "x", colors: ["#000000", "#111111", "#ffffff"], background: null, blur: false } })
      .returning();
    const [team] = await db.insert(teams).values({ eventId: ev.id, name: "Alfa" }).returning();
    const rev = async () => (await db.select({ r: events.revision }).from(events).where(eq(events.id, ev.id)))[0].r;
    const before = await rev();

    const preset = RUBRIC_PRESET_GROUPS[0].presets[0];
    const [rb] = await db.insert(rubrics).values({ eventId: ev.id, name: preset.name, definition: sanitizeRubric(preset.definition) }).returning();
    const [room] = await db.insert(judgingRooms).values({ eventId: ev.id, name: "Sala 1", rubricIds: [rb.id] }).returning();
    const [ses] = await db.insert(judgingSessions).values({ eventId: ev.id, teamId: team.id, roomId: room.id, startsAt: new Date() }).returning();
    const sheet = { eventId: ev.id, sessionId: ses.id, teamId: team.id, rubricId: rb.id, submittedBy: "x", submittedByLabel: "x" };
    await db.insert(rubricEvaluations).values({ ...sheet, scores: { ip_problem: 3 }, total: 3, maxTotal: 28 });

    // Avaliação é confidencial: nada disso mexe na revisão que alimenta o telão.
    expect(await rev()).toBe(before);

    // Segunda ficha da mesma rubrica na mesma sessão vira atualização.
    await db
      .insert(rubricEvaluations)
      .values({ ...sheet, scores: { ip_problem: 4 }, total: 4, maxTotal: 28, status: "submitted" })
      .onConflictDoUpdate({ target: [rubricEvaluations.sessionId, rubricEvaluations.rubricId], set: { total: 4, status: "submitted" } });
    const rows = await db.select().from(rubricEvaluations);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ total: 4, status: "submitted" });

    // Apagar a sala mantém a sessão (sem sala) e a ficha.
    await db.delete(judgingRooms).where(eq(judgingRooms.id, room.id));
    expect((await db.select().from(judgingSessions))[0].roomId).toBeNull();
    expect(await db.select().from(rubricEvaluations)).toHaveLength(1);

    // Apagar a equipe leva sessão e ficha junto.
    await db.delete(teams).where(eq(teams.id, team.id));
    expect(await db.select().from(judgingSessions)).toHaveLength(0);
    expect(await db.select().from(rubricEvaluations)).toHaveLength(0);

    // Código de sala é único entre salas.
    await db.insert(judgingRooms).values({ eventId: ev.id, name: "A", code: "ABC234" });
    await expect(db.insert(judgingRooms).values({ eventId: ev.id, name: "B", code: "ABC234" })).rejects.toThrow();
  }, 30000);
});
