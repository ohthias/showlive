import { describe, expect, it } from "vitest";
import { arenaMaxScore, defaultArena, defaultLeague, emptyResponses, sanitizeLeague, sanitizeObrResponses, scoreObr } from "@/lib/obr";
import { futureEditionChallenge } from "@/lib/future-edition";
import { sanitizeChallenge, scoreChallenge } from "@/lib/challenge";
import { computeExtraRanking, computeRanking } from "@/lib/ranking";
import type { LiveRound, LiveScore, LiveTeam } from "@/lib/live-types";

describe("OBR Resgate", () => {
  const arena = defaultArena(0); // seções [6,6,5], 4 interseções, 1 gangorra...

  it("calcula igual ao Pontuador do RoboStage", () => {
    const r = { ...emptyResponses(arena), hazards: { intersecoes: 4, gangorras: 1 }, sections: [1, 2, 0], chegada: true, falhas: 2, vivas: 2, mortas: 1, tempo: 210 };
    const b = scoreObr(arena, r);
    // perigos 40+20, checkpoints 6×5 + 6×3, saída 5, chegada 60−10
    expect(b.base).toBe(60 + 48 + 5 + 50);
    expect(b.total).toBe(Math.ceil(163 * 1.3 ** 3 - 1e-9));
    expect(b.tempo).toBe(210);
  });

  it("não deixa marcar mais perigos do que a arena tem", () => {
    const clean = sanitizeObrResponses(arena, { hazards: { intersecoes: 99, gangorras: 5 }, vivas: 9, mortas: 3, invertidas: 3, surpresa: true, sections: [9, 1] });
    expect(clean.hazards).toEqual({ intersecoes: 4, gangorras: 1 });
    expect(clean.vivas).toBe(2);
    expect(clean.invertidas).toBe(0);
    expect(clean.surpresa).toBe(false); // arena A sem Desafio Surpresa
    expect(clean.sections).toEqual([4, 1, 0]);
  });

  it("sem chegada o tempo de desempate é o máximo", () => {
    expect(scoreObr(arena, { ...emptyResponses(arena), tempo: 100 }).tempo).toBe(300);
  });

  it("valida a liga: exatamente 3 arenas, seções obrigatórias", () => {
    expect(() => sanitizeLeague(defaultLeague())).not.toThrow();
    expect(() => sanitizeLeague({ arenas: [defaultArena(0)] })).toThrow(/3/);
    expect(() => sanitizeLeague({ arenas: [defaultArena(0), defaultArena(1), { ...defaultArena(2), sections: [] }] })).toThrow(/seção/);
    expect(arenaMaxScore(defaultArena(2))).toBeGreaterThan(arenaMaxScore(defaultArena(0)));
  });

  it("classificação: soma das 2 maiores, desempate pela menor soma de tempos", () => {
    const T = (id: string): LiveTeam => ({ id, name: id, number: null, organization: null });
    const R = (id: string, p: number): LiveRound => ({ id, name: id, position: p, kind: "qualifying" });
    const S = (t: string, r: string, points: number, tb: number): LiveScore => ({ teamId: t, roundId: r, points, tb, at: 0 });
    const rounds = [R("a1", 1), R("a2", 2), R("a3", 3)];
    const scores = [
      S("x", "a1", 200, 250), S("x", "a2", 150, 300), S("x", "a3", 10, 300), // 350, tempos 850
      S("y", "a1", 100, 200), S("y", "a2", 250, 180), S("y", "a3", 90, 300), // 350, tempos 680
      S("z", "a1", 400, 120), // 400
    ];
    const r = computeRanking([T("x"), T("y"), T("z")], rounds, scores, { rankingMode: "best2", enablePlayoffs: false, playoffFormat: "final" });
    expect(r.map((x) => x.team.id)).toEqual(["z", "y", "x"]);
    expect(r[1].score).toBe(350);
    expect(r[1].tbTotal).toBe(680);
  });
});

describe("FLL Future Edition", () => {
  const ch = futureEditionChallenge();
  it("gera um desafio válido a partir dos dados do RoboStage", () => {
    expect(() => sanitizeChallenge(ch)).not.toThrow();
    expect(ch.items.length).toBeGreaterThan(10);
    expect(ch.items[0].group).toMatch(/^M01/);
  });
  it("cartões: 1 → −10, 2 → −30, 3 → zera", () => {
    const base = { "m01-floresta-jovem": 3, "m04-especies-liberadas-ninho": 1 }; // 60 + 30
    expect(scoreChallenge(ch, base).value).toBe(90);
    expect(scoreChallenge(ch, { ...base, "pen:cartoes": 1 }).value).toBe(80);
    expect(scoreChallenge(ch, { ...base, "pen:cartoes": 2 }).value).toBe(60);
    const z = scoreChallenge(ch, { ...base, "pen:cartoes": 3 });
    expect(z.value).toBe(0);
    expect(z.zeroed).toBe(true);
  });
});

describe("desafio extra", () => {
  it("ranking próprio respeita a direção", () => {
    const teams = ["a", "b"].map((id) => ({ id, name: id, number: null, organization: null }));
    const round: LiveRound = { id: "x", name: "Extra", position: 2000, kind: "extra", extra: { id: "e", name: "E", scoring: { direction: "lower", unit: "s", decimals: 2 } } };
    const r = computeExtraRanking(teams, round, [
      { teamId: "a", roundId: "x", points: 30, at: 0 },
      { teamId: "b", roundId: "x", points: 20, at: 0 },
    ]);
    expect(r.map((x) => x.team.id)).toEqual(["b", "a"]);
  });
});

describe("imagens das missões", () => {
  it("Future Edition leva a imagem da missão para os itens e a validação preserva", () => {
    const ch = futureEditionChallenge();
    expect(ch.items[0].image).toMatch(/^\/images\/missions\/bioglow-fe\/.+\.webp$/);
    expect(sanitizeChallenge(ch).items[0].image).toBe(ch.items[0].image);
    expect(sanitizeChallenge({ ...ch, items: [{ ...ch.items[0], image: "https://evil.example/x.png" }] }).items[0].image).toBeUndefined();
  });
});
