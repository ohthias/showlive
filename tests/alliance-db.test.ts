import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { findAlliancePreset } from "@/lib/alliance-presets";

/** Partidas de alianças: número único por evento, revisão do telão e cascata. */
describe("partidas no banco", () => {
  it("cria evento de alianças, partidas bumpam a revisão e somem com o evento", async () => {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    const { events, teams, matches } = schema;
    const [ev] = await db
      .insert(events)
      .values({
        name: "FTC",
        ownerId: "u",
        season: "alliance",
        format: "alliance",
        challenge: findAlliancePreset("ftc")!.challenge,
        theme: { preset: "x", colors: ["#000000", "#111111", "#ffffff"], background: null, blur: false },
      })
      .returning();
    const ts = await db.insert(teams).values(["A", "B", "C", "D"].map((name) => ({ eventId: ev.id, name }))).returning();
    const rev = async () => (await db.select({ r: events.revision }).from(events).where(eq(events.id, ev.id)))[0].r;
    const before = await rev();
    const [m] = await db
      .insert(matches)
      .values({ eventId: ev.id, number: 1, red: [{ teamId: ts[0].id }, { teamId: ts[1].id }], blue: [{ teamId: ts[2].id }, { teamId: ts[3].id }] })
      .returning();
    expect(await rev()).toBe(before + 1);
    expect(m.status).toBe("scheduled");
    await expect(db.insert(matches).values({ eventId: ev.id, number: 1, red: [] })).rejects.toThrow();
    await db.delete(events).where(eq(events.id, ev.id));
    expect(await db.select().from(matches)).toHaveLength(0);
  }, 30000);
});
