import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";

/** As migrações aplicam e os gatilhos de realtime incrementam a revisão. */
describe("migrações + gatilhos de revisão", () => {
  it("cada escrita relevante incrementa events.revision exatamente uma vez", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const { events, teams, rounds, scores, eventSettings } = schema;

    const [ev] = await db
      .insert(events)
      .values({ code: "ABC234", name: "Teste", ownerId: "user_1", season: "bioglow", theme: { preset: "x", colors: ["#000000", "#111111", "#ffffff"], background: null, blur: false } })
      .returning();
    const rev = async () => (await db.select({ r: events.revision }).from(events).where(eq(events.id, ev.id)))[0].r;
    expect(await rev()).toBe(0);

    await db.insert(eventSettings).values({ eventId: ev.id });
    expect(await rev()).toBe(1);
    const [t] = await db.insert(teams).values({ eventId: ev.id, name: "A" }).returning();
    const [r] = await db.insert(rounds).values({ eventId: ev.id, name: "R1", position: 1 }).returning();
    expect(await rev()).toBe(3);

    await db.insert(scores).values({ eventId: ev.id, teamId: t.id, roundId: r.id, points: 100, submittedBy: "x", submittedByLabel: "x" });
    expect(await rev()).toBe(4);

    // nota duplicada é barrada pelo banco
    const dup = await db
      .insert(scores)
      .values({ eventId: ev.id, teamId: t.id, roundId: r.id, points: 1, submittedBy: "x", submittedByLabel: "x" })
      .onConflictDoNothing()
      .returning();
    expect(dup).toHaveLength(0);
    expect(await rev()).toBe(4);

    await db.update(events).set({ name: "Novo nome" }).where(eq(events.id, ev.id));
    expect(await rev()).toBe(5);

    await db.delete(teams).where(eq(teams.id, t.id)); // cascata apaga a nota
    expect(await rev()).toBeGreaterThanOrEqual(6);
    expect(await db.select().from(scores)).toHaveLength(0);
  }, 30000);
});
