import { describe, expect, it } from "vitest";
import {
  allCriteria,
  buildSchedule,
  rankOverall,
  rankRubric,
  roomRubrics,
  sanitizeComments,
  sanitizeRubric,
  sanitizeScores,
  scoreRubric,
  submitProblems,
  type ResultsEvaluation,
} from "@/lib/rubric";
import { findPresetGroup, RUBRIC_PRESET_GROUPS, suggestedPresetGroup } from "@/lib/rubric-presets";

const simple = sanitizeRubric({
  levels: [
    { value: 1, label: "A" },
    { value: 2, label: "B" },
    { value: 3, label: "C" },
    { value: 4, label: "D" },
  ],
  sections: [
    {
      id: "s",
      title: "S",
      criteria: [
        { id: "a", label: "Critério A" },
        { id: "b", label: "Critério B", weight: 2 },
      ],
    },
  ],
  commentFromLevel: 4,
  requireFeedback: true,
});

describe("rubricas", () => {
  it("todos os modelos prontos são válidos e têm ids únicos", () => {
    for (const g of RUBRIC_PRESET_GROUPS)
      for (const p of g.presets) {
        const def = sanitizeRubric(p.definition);
        expect(allCriteria(def).length).toBe(allCriteria(p.definition).length);
        const ids = allCriteria(def).map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
  });

  it("catálogo de modelos é consistente", () => {
    const groups = RUBRIC_PRESET_GROUPS;
    const presets = groups.flatMap((g) => g.presets);
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length);
    // nomes únicos: o banco exige nome único por evento
    expect(new Set(presets.map((p) => p.name.toLowerCase())).size).toBe(presets.length);
    for (const g of groups) for (const id of g.recommended ?? []) expect(g.presets.some((p) => p.id === id)).toBe(true);
    for (const p of presets) {
      for (const c of allCriteria(p.definition)) if (c.hints) expect(c.hints, `${p.id}/${c.id}`).toHaveLength(p.definition.levels.length);
      expect(p.name.length).toBeLessThanOrEqual(60);
    }
    expect(presets.length).toBeGreaterThanOrEqual(25);
    for (const f of ["fll", "fll_fe", "obr", "custom"]) expect(findPresetGroup(suggestedPresetGroup(f))).not.toBeNull();
  });

  it("sanitize recusa escala curta e rubrica vazia, e ordena os níveis", () => {
    expect(() => sanitizeRubric({ levels: [{ value: 1, label: "x" }], sections: [{ title: "s", criteria: [{ label: "c" }] }] })).toThrow();
    expect(() => sanitizeRubric({ levels: [{ value: 1 }, { value: 2 }], sections: [{ title: "s", criteria: [] }] })).toThrow();
    const def = sanitizeRubric({
      levels: [{ value: 3, label: "três" }, { value: 1, label: "um" }, { value: 1, label: "dup" }],
      sections: [{ title: "s", criteria: [{ id: "x", label: "c" }, { id: "x", label: "d" }] }],
      commentFromLevel: 99,
    });
    expect(def.levels.map((l) => l.value)).toEqual([1, 3]);
    expect(def.commentFromLevel).toBeNull();
    const ids = allCriteria(def).map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("calcula total ponderado e percentual", () => {
    const s = scoreRubric(simple, { a: 4, b: 2 });
    expect(s).toMatchObject({ total: 8, max: 12, answered: 2, criteria: 2 });
    expect(s.percent).toBeCloseTo(66.67, 2);
  });

  it("descarta níveis inválidos e critérios desconhecidos", () => {
    expect(sanitizeScores(simple, { a: 7, b: 3, zz: 4 })).toEqual({ b: 3 });
    expect(sanitizeComments(simple, { a: "  ok  ", zz: "x" })).toEqual({ a: "ok" });
  });

  it("exige todos os níveis, comentário no nível alto e retorno para a equipe", () => {
    expect(submitProblems(simple, { a: 1 }, {}, {})).toHaveLength(2); // b sem nível + retorno
    const p = submitProblems(simple, { a: 4, b: 1 }, {}, { strengths: "x", improvements: "y" });
    expect(p).toHaveLength(1);
    expect(p[0].criterionId).toBe("a");
    expect(submitProblems(simple, { a: 4, b: 1 }, { a: "justificado" }, { strengths: "x", improvements: "y" })).toHaveLength(0);
  });
});

describe("resultados", () => {
  const teams = [
    { id: "t1", name: "Alfa", number: "1" },
    { id: "t2", name: "Beta", number: "2" },
    { id: "t3", name: "Gama", number: "3" },
  ];
  const ev = (teamId: string, rubricId: string, percent: number, status: "draft" | "submitted" = "submitted"): ResultsEvaluation => ({
    teamId,
    rubricId,
    percent,
    total: percent,
    max: 100,
    status,
  });

  it("rascunhos não contam e fichas repetidas viram média; empate divide a posição", () => {
    const rows = rankRubric(teams, "r1", [ev("t1", "r1", 80), ev("t1", "r1", 60), ev("t2", "r1", 70), ev("t3", "r1", 99, "draft")]);
    expect(rows.map((r) => [r.team.id, r.percent, r.rank])).toEqual([
      ["t1", 70, 1],
      ["t2", 70, 1],
      ["t3", null, null],
    ]);
  });

  it("geral = média ponderada das rubricas e da partida", () => {
    const rubrics = [
      { id: "r1", name: "R1", weight: 1 },
      { id: "r2", name: "R2", weight: 2 },
    ];
    const evals = [ev("t1", "r1", 90), ev("t1", "r2", 60), ev("t2", "r1", 60), ev("t2", "r2", 90), ev("t3", "r1", 100)];
    const rows = rankOverall(teams, rubrics, evals);
    expect(rows[0]).toMatchObject({ team: { id: "t2" }, overall: 80, complete: true, rank: 1 });
    expect(rows.find((r) => r.team.id === "t3")).toMatchObject({ complete: false, overall: 33.33 });

    const withGame = rankOverall(teams, rubrics, evals, { weight: 3, direction: "higher", scores: { t1: 400, t2: 200, t3: null } });
    // t1: (90 + 120 + 300)/6 = 85 ; t2: (60 + 180 + 150)/6 = 65
    expect(withGame[0]).toMatchObject({ team: { id: "t1" }, overall: 85, robotGame: 100 });
    expect(withGame.find((r) => r.team.id === "t2")?.overall).toBe(65);

    const lower = rankOverall(teams, [], [], { weight: 1, direction: "lower", scores: { t1: 20, t2: 10, t3: null } });
    expect(lower.map((r) => [r.team.id, r.robotGame])).toEqual([
      ["t2", 100],
      ["t1", 50],
      ["t3", null],
    ]);
  });
});

describe("cronograma", () => {
  it("distribui em ondas pelas salas", () => {
    const start = Date.UTC(2026, 10, 14, 12, 0);
    const slots = buildSchedule({ teamIds: ["a", "b", "c", "d", "e"], roomIds: ["r1", "r2"], startMs: start, durationMin: 30, gapMin: 10 });
    expect(slots.map((s) => [s.teamId, s.roomId, (s.startsAt.getTime() - start) / 60000])).toEqual([
      ["a", "r1", 0],
      ["b", "r2", 0],
      ["c", "r1", 40],
      ["d", "r2", 40],
      ["e", "r1", 80],
    ]);
    expect(buildSchedule({ teamIds: ["a"], roomIds: [], startMs: start, durationMin: 30, gapMin: 0 })).toEqual([]);
  });

  it("sala sem rubricas escolhidas aplica todas", () => {
    const all = [{ id: "1" }, { id: "2" }, { id: "3" }];
    expect(roomRubrics(all, [])).toHaveLength(3);
    expect(roomRubrics(all, ["3", "1"]).map((r) => r.id)).toEqual(["1", "3"]);
  });
});
