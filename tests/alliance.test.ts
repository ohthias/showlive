import { describe, expect, it } from "vitest";
import {
  buildMatchSchedule,
  computeAllianceRanking,
  sanitizeAlliance,
  scoreMatch,
  seededRandom,
  type RankMatch,
} from "@/lib/alliance";
import { ALLIANCE_PRESETS, findAlliancePreset } from "@/lib/alliance-presets";
import { sanitizeChallenge } from "@/lib/challenge";

const ftc = sanitizeChallenge(findAlliancePreset("ftc")!.challenge);
const cfg = ftc.alliance!;

describe("modelos de alianças", () => {
  it("todos passam pela validação sem perder a configuração", () => {
    for (const p of ALLIANCE_PRESETS) {
      const ch = sanitizeChallenge(p.challenge);
      expect(ch.alliance, p.id).toEqual(p.challenge.alliance);
      expect(ch.scoring.direction).toBe("higher");
    }
  });

  it("sanitize corrige valores fora do lugar", () => {
    const a = sanitizeAlliance(
      { mode: "coop", teamsPerAlliance: 9, rankBy: "rp_avg", tiebreakers: ["wins", "high", "group:Inexistente"], bonusRp: [{ label: "x" }] },
      ["Autônomo"],
    );
    expect(a).toMatchObject({ mode: "coop", teamsPerAlliance: 4, rankBy: "score_avg", tiebreakers: ["high"], bonusRp: [], penaltiesTo: "self" });
  });
});

describe("placar da partida", () => {
  it("penalidades viram pontos do adversário e RP bônus por grupo", () => {
    const red = { a_leave: 2, a_high: 4, t_high: 10, "pen:minor": 2 }; // 6 + 28 = 34 auto; 50 teleop → 84 base
    const blue = { a_leave: 1, t_low: 5, e_lift: 2, "pen:major": 1 }; // 3 auto, 10 teleop, 40 fim → 53 base
    const r = scoreMatch(ftc, cfg, red, blue, {});
    expect(r.red).toMatchObject({ base: 84, penalty: 10, score: 84 + 15, bonus: ["RP de autônomo"], bonusRp: 1 });
    expect(r.blue).toMatchObject({ base: 53, penalty: 15, score: 53 + 10, bonus: ["RP de fim de jogo"], bonusRp: 1 });
    expect(r.red.byGroup).toEqual({ Autônomo: 34, Teleoperado: 50, "Fim de jogo": 0 });
  });

  it("modo cooperativo desconta da própria aliança", () => {
    const coop = sanitizeChallenge(findAlliancePreset("coop2")!.challenge);
    const r = scoreMatch(coop, coop.alliance!, { c_goal: 4, "pen:c_foul": 3 }, null);
    expect(r.red.score).toBe(9);
    expect(r.blue).toBeNull();
  });
});

describe("classificação", () => {
  const teams = ["A", "B", "C", "D"].map((n) => ({ id: n, name: n, number: null, organization: null }));
  const res = (score: number, bonusRp = 0, auto = 0) => ({ score, penalty: 0, byGroup: { Autônomo: auto }, bonusRp });
  const m = (n: number, red: string[], blue: string[], rs: number, bs: number, extra: Partial<RankMatch> = {}): RankMatch => ({
    id: `m${n}`,
    number: n,
    red: red.map((teamId) => ({ teamId })),
    blue: blue.map((teamId) => ({ teamId })),
    final: true,
    result: { red: res(rs), blue: res(bs), flags: {} },
    ...extra,
  });

  it("RP por resultado, média e desempates; surrogate e DQ", () => {
    const matches = [
      m(1, ["A", "B"], ["C", "D"], 100, 80),
      m(2, ["A", "C"], ["B", "D"], 50, 50),
      {
        ...m(3, ["A", "D"], ["B", "C"], 90, 60),
        red: [{ teamId: "A" }, { teamId: "D", surrogate: true }],
        result: { red: res(90, 1), blue: res(60), flags: { C: "dq" as const } },
      },
      m(4, ["B", "C"], ["A", "D"], 10, 20, { final: false }), // pendente: não conta
    ];
    const rows = computeAllianceRanking(teams, matches, cfg);
    const by = Object.fromEntries(rows.map((r) => [r.team.id, r]));
    // A: vitória 3 + empate 1 + vitória 3 + bônus 1 = 8 em 3 partidas
    expect(by.A).toMatchObject({ rank: 1, played: 3, wins: 2, ties: 1, losses: 0, rp: 8, rs: 2.67, avg: 80, high: 100 });
    // D jogou a 3ª como surrogate: só 2 partidas contam
    expect(by.D).toMatchObject({ played: 2, losses: 1, ties: 1, rp: 1 });
    // C foi desclassificado na 3ª: 0 RP e 0 pontos nela
    expect(by.C).toMatchObject({ played: 3, rp: 1, losses: 2 });
    expect(rows.map((r) => r.team.id)).toEqual(["A", "B", "D", "C"]);
  });

  it("descarta as piores partidas e ordena cooperativo pela média", () => {
    const coop = sanitizeChallenge(findAlliancePreset("coop2")!.challenge).alliance!;
    const c = (n: number, red: string[], s: number): RankMatch => ({
      id: `c${n}`,
      number: n,
      red: red.map((teamId) => ({ teamId })),
      blue: [],
      final: true,
      result: { red: res(s), blue: null, flags: {} },
    });
    const rows = computeAllianceRanking(teams, [c(1, ["A", "B"], 10), c(2, ["A", "C"], 30), c(3, ["A", "D"], 50), c(4, ["B", "C"], 40)], coop);
    const A = rows.find((r) => r.team.id === "A")!;
    expect(A).toMatchObject({ avg: 40, score: 40, high: 50, played: 3 }); // 10 descartada
    expect(rows[0].team.id).toBe("D"); // 1 partida só: nada a descartar → média 50
  });
});

describe("gerador de partidas", () => {
  it("cada equipe joga N vezes (+ surrogate quando não fecha) sem repetir na mesma partida", () => {
    const teamIds = Array.from({ length: 13 }, (_, i) => `t${i}`);
    const sched = buildMatchSchedule({ teamIds, matchesPerTeam: 5, teamsPerAlliance: 2, mode: "versus", random: seededRandom(42), attempts: 80 });
    expect(sched).toHaveLength(Math.ceil((13 * 5) / 4)); // 17 partidas, 3 vagas de surrogate
    const counted = new Map<string, number>();
    let surrogates = 0;
    for (const match of sched) {
      const ids = [...match.red, ...match.blue].map((s) => s.teamId);
      expect(new Set(ids).size).toBe(4);
      for (const s of [...match.red, ...match.blue]) {
        if (s.surrogate) surrogates++;
        else counted.set(s.teamId, (counted.get(s.teamId) ?? 0) + 1);
      }
    }
    expect(surrogates).toBe(3);
    for (const t of teamIds) expect(counted.get(t)).toBe(5);
  });

  it("cooperativo, 3×3 e 1×1; recusa equipes de menos", () => {
    const ids = Array.from({ length: 8 }, (_, i) => `t${i}`);
    expect(buildMatchSchedule({ teamIds: ids, matchesPerTeam: 4, teamsPerAlliance: 2, mode: "coop", random: seededRandom(1), attempts: 20 }).every((m) => m.blue.length === 0)).toBe(true);
    expect(buildMatchSchedule({ teamIds: ids, matchesPerTeam: 3, teamsPerAlliance: 3, mode: "versus", random: seededRandom(1), attempts: 20 })[0].red).toHaveLength(3);
    expect(buildMatchSchedule({ teamIds: ids, matchesPerTeam: 3, teamsPerAlliance: 1, mode: "versus", random: seededRandom(1), attempts: 20 })).toHaveLength(12);
    expect(() => buildMatchSchedule({ teamIds: ids.slice(0, 3), matchesPerTeam: 3, teamsPerAlliance: 2, mode: "versus" })).toThrow(/4 equipes/);
  });
});
