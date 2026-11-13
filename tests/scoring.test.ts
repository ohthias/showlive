import { describe, expect, it } from "vitest";
import { getMissions } from "@/lib/missions";
import { computeMissionBreakdown, sanitizeResponses, scoreRound } from "@/lib/scoring";

describe("motor de pontuação (igual ao RoboStage)", () => {
  const bioglow = getMissions("bioglow");

  it("carrega todas as temporadas", () => {
    for (const s of ["bioglow", "unearthed", "submerged", "masterpiece"]) expect(getMissions(s).length).toBeGreaterThan(10);
  });

  it("GP não soma no total e vai para extras", () => {
    const r = scoreRound(bioglow, { EL: { 0: 1 }, GP: { 0: 2 } });
    expect(r.points).toBe(20);
    expect(r.extras.gp).toEqual({ label: "Excedido", points: 4 });
  });

  it("tokens de precisão somam e aparecem nos extras", () => {
    const r = scoreRound(bioglow, { PT: { 0: 6 } });
    expect(r.points).toBe(50);
    expect(r.extras.pt).toEqual({ remaining: 6, points: 50 });
  });

  it("portão zero_whole_mission_if_false zera a missão (M04)", () => {
    const m04 = bioglow.find((m) => m.id === "M04")!;
    const gateIdx = m04["sub-mission"]!.findIndex((s) => s.zero_whole_mission_if_false) + 1;
    const open = computeMissionBreakdown(m04, { 0: 2, [gateIdx]: 1 });
    const closed = computeMissionBreakdown(m04, { 0: 2, [gateIdx]: 0 });
    expect(open.total).toBeGreaterThan(0);
    expect(closed.total).toBe(0);
    expect(closed.gated).toBe(true);
  });

  it("descarta respostas inválidas vindas do cliente", () => {
    const clean = sanitizeResponses(bioglow, { EL: { 0: 1 }, PT: { 0: 99 }, XX: { 0: 1 }, M02: { 0: "2", 7: 1 } });
    expect(clean).toEqual({ EL: { 0: 1 }, M02: { 0: 2 } });
  });
});
