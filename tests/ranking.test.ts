import { describe, expect, it } from "vitest";
import {
  availableRoundsForTeam,
  computePlayoffs,
  computeRanking,
  currentRound,
  isQualifyingComplete,
} from "@/lib/ranking";
import type { LiveRound, LiveScore, LiveTeam } from "@/lib/live-types";

const T = (id: string): LiveTeam => ({ id, name: `Equipe ${id}`, number: null, organization: null });
const R = (id: string, position: number, kind: LiveRound["kind"] = "qualifying"): LiveRound => ({
  id,
  name: id,
  position,
  kind,
});
const S = (teamId: string, roundId: string, points: number | null): LiveScore => ({ teamId, roundId, points, at: 0 });

const base = { rankingMode: "best" as const, enablePlayoffs: false, playoffFormat: "final" as const, showOnlyCurrentRound: false };
const rounds = [R("r1", 1), R("r2", 2), R("r3", 3)];

describe("computeRanking", () => {
  it("usa a maior nota e desempata pela segunda maior (regra FLL)", () => {
    const teams = [T("a"), T("b"), T("c")];
    const scores = [
      S("a", "r1", 300), S("a", "r2", 100),
      S("b", "r1", 300), S("b", "r2", 250),
      S("c", "r1", 310),
    ];
    const r = computeRanking(teams, rounds, scores, base);
    expect(r.map((x) => x.team.id)).toEqual(["c", "b", "a"]);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it("empate total divide a posição", () => {
    const teams = [T("a"), T("b"), T("c")];
    const scores = [S("a", "r1", 200), S("b", "r1", 200), S("c", "r1", 100)];
    expect(computeRanking(teams, rounds, scores, base).map((x) => x.rank)).toEqual([1, 1, 3]);
  });

  it("modo soma", () => {
    const teams = [T("a"), T("b")];
    const scores = [S("a", "r1", 300), S("b", "r1", 200), S("b", "r2", 200)];
    const r = computeRanking(teams, rounds, scores, { ...base, rankingMode: "sum" });
    expect(r[0].team.id).toBe("b");
    expect(r[0].score).toBe(400);
  });

  it("notas ocultas contam como avaliadas mas não pontuam", () => {
    const r = computeRanking([T("a")], rounds, [S("a", "r1", null)], base);
    expect(r[0].evaluated).toBe(1);
    expect(r[0].byRound.r1).toBeNull();
    expect(r[0].best).toBe(0);
  });
});

describe("rodada atual e mesa", () => {
  const teams = [T("a"), T("b")];
  it("detecta a rodada em andamento", () => {
    expect(currentRound(teams, rounds, [S("a", "r1", 1)])?.id).toBe("r1");
    expect(currentRound(teams, rounds, [S("a", "r1", 1), S("b", "r1", 1)])?.id).toBe("r2");
  });

  it("modo 'só rodada atual' libera apenas ela", () => {
    const scores = [S("a", "r1", 1)];
    const free = availableRoundsForTeam("a", teams, rounds, scores, { ...base, showOnlyCurrentRound: true });
    expect(free).toEqual([]);
    const freeB = availableRoundsForTeam("b", teams, rounds, scores, { ...base, showOnlyCurrentRound: true });
    expect(freeB.map((r) => r.id)).toEqual(["r1"]);
    const normal = availableRoundsForTeam("a", teams, rounds, scores, base);
    expect(normal.map((r) => r.id)).toEqual(["r2", "r3"]);
  });
});

describe("playoffs", () => {
  const teams = ["a", "b", "c", "d", "e"].map(T);
  const pr = [...rounds, R("semi", 1000, "semifinal"), R("final", 1001, "final")];
  const quals = teams.flatMap((t, i) => rounds.map((r) => S(t.id, r.id, 500 - i * 50)));
  const settings = { ...base, enablePlayoffs: true, playoffFormat: "semifinal" as const };

  it("espera as classificatórias terminarem", () => {
    expect(computePlayoffs(teams, pr, quals.slice(1), settings).phase).toBe("waiting");
    expect(isQualifyingComplete(teams, pr, quals)).toBe(true);
  });

  it("top 4 vai à semi, top 2 da semi à final, campeão pela final", () => {
    let st = computePlayoffs(teams, pr, quals, settings);
    expect(st.phase).toBe("semifinal");
    expect(st.semifinal.map((s) => s.team.id)).toEqual(["a", "b", "c", "d"]);
    expect(availableRoundsForTeam("e", teams, pr, quals, settings)).toEqual([]);
    expect(availableRoundsForTeam("a", teams, pr, quals, settings).map((r) => r.id)).toEqual(["semi"]);

    const semi = [S("a", "semi", 100), S("b", "semi", 400), S("c", "semi", 350), S("d", "semi", 50)];
    st = computePlayoffs(teams, pr, [...quals, ...semi], settings);
    expect(st.phase).toBe("final");
    expect(st.final.map((s) => s.team.id)).toEqual(["b", "c"]);

    const fin = [S("b", "final", 200), S("c", "final", 300)];
    st = computePlayoffs(teams, pr, [...quals, ...semi, ...fin], settings);
    expect(st.phase).toBe("done");
    expect(st.champion?.id).toBe("c");
  });

  it("final direta com top 2", () => {
    const st = computePlayoffs(teams, pr, quals, { ...settings, playoffFormat: "final" });
    expect(st.phase).toBe("final");
    expect(st.final.map((s) => s.team.id)).toEqual(["a", "b"]);
  });
});

describe("menor vence (desafios de tempo)", () => {
  const teams = [T("a"), T("b"), T("c")];
  const lower = { ...base, direction: "lower" as const };
  it("melhor tempo primeiro, sem nota por último", () => {
    const scores = [S("a", "r1", 42.5), S("a", "r2", 40.1), S("b", "r1", 38.0)];
    const r = computeRanking(teams, rounds, scores, lower);
    expect(r.map((x) => x.team.id)).toEqual(["b", "a", "c"]);
    expect(r[0].best).toBe(38);
    expect(r[1].best).toBe(40.1);
    expect(r[2].evaluated).toBe(0);
  });
  it("desempate pelo segundo melhor tempo", () => {
    const scores = [S("a", "r1", 30), S("a", "r2", 50), S("b", "r1", 30), S("b", "r2", 45)];
    expect(computeRanking(teams.slice(0, 2), rounds, scores, lower).map((x) => x.team.id)).toEqual(["b", "a"]);
  });
  it("campeão da final é o menor tempo", () => {
    const ts = ["a", "b", "c"].map(T);
    const pr = [R("r1", 1), R("final", 1001, "final")];
    const sc = [S("a", "r1", 30), S("b", "r1", 31), S("c", "r1", 40), S("a", "final", 35), S("b", "final", 29)];
    const st = computePlayoffs(ts, pr, sc, { ...lower, enablePlayoffs: true });
    expect(st.final.map((s) => s.team.id)).toEqual(["a", "b"]);
    expect(st.champion?.id).toBe("b");
  });
});

describe("aprovação e mesas restritas", () => {
  const teams = [T("a"), T("b")];
  it("nota pendente não conta no ranking mas a equipe não fica disponível de novo", () => {
    const scores = [{ ...S("a", "r1", 500), pending: true }, S("b", "r1", 100)];
    const r = computeRanking(teams, rounds, scores, base);
    expect(r[0].team.id).toBe("b");
    expect(r.find((x) => x.team.id === "a")!.evaluated).toBe(0);
    expect(availableRoundsForTeam("a", teams, rounds, scores, base).map((x) => x.id)).toEqual(["r2", "r3"]);
  });
  it("mesa restrita a uma rodada só vê essa rodada", () => {
    expect(availableRoundsForTeam("a", teams, rounds, [], base, ["r2"]).map((x) => x.id)).toEqual(["r2"]);
  });
});
