import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { releaseEventCodes, releaseStale, reserveLiveCode, resolveLiveCode, CodeTargetMissing } from "@/lib/codes/live-codes";

/**
 * Isolamento dos códigos entre eventos simultâneos: o mesmo código nunca pode
 * levar a dois lugares, mesmo quando dois eventos sorteiam o mesmo valor.
 */

const theme = { preset: "x", colors: ["#000000", "#111111", "#ffffff"] as [string, string, string], background: null, blur: false };

async function setup() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  const { events, judgingRooms, accessCodes } = schema;
  const mk = async (name: string) => {
    const [ev] = await db.insert(events).values({ name, ownerId: "u", season: "s", theme, status: "live" }).returning();
    const [room] = await db.insert(judgingRooms).values({ eventId: ev.id, name: "Sala 1" }).returning();
    const [room2] = await db.insert(judgingRooms).values({ eventId: ev.id, name: "Sala 2" }).returning();
    const [mesa] = await db.insert(accessCodes).values({ eventId: ev.id, label: "Mesa 1" }).returning();
    return { ev, room, room2, mesa };
  };
  return { db, a: await mk("Evento A"), b: await mk("Evento B") };
}

/** Gerador que devolve a sequência dada (simula sorteios iguais). */
const seq = (...codes: string[]) => {
  let i = 0;
  return () => codes[Math.min(i++, codes.length - 1)];
};

describe("códigos ao vivo isolados por evento", () => {
  it("dois eventos que sorteiam o mesmo código: o segundo recebe outro", async () => {
    const { db, a, b } = await setup();
    const c1 = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room.id }, seq("SALA22"));
    // B sorteia o mesmo código primeiro (colisão) e depois um livre.
    const c2 = await reserveLiveCode(db, { eventId: b.ev.id, kind: "mesa", refId: b.mesa.id }, seq("SALA22", "MESA33"));
    expect(c1).toBe("SALA22");
    expect(c2).toBe("MESA33");

    expect(await resolveLiveCode(db, "SALA22")).toMatchObject({ kind: "room", eventId: a.ev.id, refId: a.room.id });
    expect(await resolveLiveCode(db, "MESA33")).toMatchObject({ kind: "mesa", eventId: b.ev.id, refId: b.mesa.id });

    const [roomA] = await db.select().from(schema.judgingRooms).where(eq(schema.judgingRooms.id, a.room.id));
    const [mesaB] = await db.select().from(schema.accessCodes).where(eq(schema.accessCodes.id, b.mesa.id));
    expect(roomA.code).toBe("SALA22");
    expect(mesaB.code).toBe("MESA33");
  });

  it("reservas em paralelo com o mesmo sorteio nunca dividem código", async () => {
    const { db, a, b } = await setup();
    const targets = [
      { eventId: a.ev.id, kind: "room" as const, refId: a.room.id },
      { eventId: a.ev.id, kind: "room" as const, refId: a.room2.id },
      { eventId: b.ev.id, kind: "room" as const, refId: b.room.id },
      { eventId: b.ev.id, kind: "room" as const, refId: b.room2.id },
      { eventId: b.ev.id, kind: "public" as const, refId: b.ev.id },
    ];
    const pool = ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD", "EEEEEE"];
    const codes = await Promise.all(targets.map((t) => reserveLiveCode(db, t, seq(...pool))));
    expect(new Set(codes).size).toBe(targets.length);
    for (const [i, t] of targets.entries()) expect((await resolveLiveCode(db, codes[i]))?.refId).toBe(t.refId);
  });

  it("cada sala do evento tem o seu código", async () => {
    const { db, a } = await setup();
    const c1 = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room.id });
    const c2 = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room2.id });
    expect(c1).not.toBe(c2);
    expect((await resolveLiveCode(db, c1))?.refId).toBe(a.room.id);
    expect((await resolveLiveCode(db, c2))?.refId).toBe(a.room2.id);
  });

  it("trocar o código solta o antigo; ele não leva mais a lugar nenhum", async () => {
    const { db, a } = await setup();
    const old = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room.id }, seq("VELHO2"));
    const fresh = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room.id }, seq("NOVO22"));
    expect(fresh).toBe("NOVO22");
    expect(await resolveLiveCode(db, old)).toBeNull();
    const rows = await db.select().from(schema.liveCodes).where(eq(schema.liveCodes.refId, a.room.id));
    expect(rows.map((r) => r.code)).toEqual(["NOVO22"]);
  });

  it("não grava código em sala de outro evento", async () => {
    const { db, a, b } = await setup();
    await expect(reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: b.room.id }, seq("TROCA2"))).rejects.toBeInstanceOf(
      CodeTargetMissing,
    );
    const [roomB] = await db.select().from(schema.judgingRooms).where(eq(schema.judgingRooms.id, b.room.id));
    expect(roomB.code).toBeNull();
    expect(await db.select().from(schema.liveCodes)).toHaveLength(0);
  });

  it("evento sai do ar: códigos dele somem, os do outro evento continuam", async () => {
    const { db, a, b } = await setup();
    const ca = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room.id });
    const cb = await reserveLiveCode(db, { eventId: b.ev.id, kind: "room", refId: b.room.id });
    await releaseEventCodes(db, a.ev.id);
    expect(await resolveLiveCode(db, ca)).toBeNull();
    expect((await resolveLiveCode(db, cb))?.eventId).toBe(b.ev.id);
    const [roomA] = await db.select().from(schema.judgingRooms).where(eq(schema.judgingRooms.id, a.room.id));
    expect(roomA.code).toBeNull();
  });

  it("sala apagada libera o código; evento apagado limpa o registro", async () => {
    const { db, a, b } = await setup();
    const ca = await reserveLiveCode(db, { eventId: a.ev.id, kind: "room", refId: a.room.id });
    await db.delete(schema.judgingRooms).where(eq(schema.judgingRooms.id, a.room.id));
    expect(await resolveLiveCode(db, ca)).toBeNull();
    await releaseStale(db, "room", a.room.id);
    expect(await db.select().from(schema.liveCodes).where(eq(schema.liveCodes.code, ca))).toHaveLength(0);

    await reserveLiveCode(db, { eventId: b.ev.id, kind: "public", refId: b.ev.id });
    await db.delete(schema.events).where(eq(schema.events.id, b.ev.id));
    expect(await db.select().from(schema.liveCodes).where(eq(schema.liveCodes.eventId, b.ev.id))).toHaveLength(0);
  });
});
