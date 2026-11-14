import { describe, expect, it } from "vitest";
import { CHALLENGE_PRESETS, blankChallenge, sanitizeChallenge, sanitizeCustomResponses, scoreChallenge } from "@/lib/challenge";
import { formatScore } from "@/lib/format";

const preset = (id: string) => CHALLENGE_PRESETS.find((p) => p.id === id)!.challenge;

describe("desafios personalizados", () => {
  it("todos os modelos prontos passam na validação", () => {
    for (const p of CHALLENGE_PRESETS) expect(() => sanitizeChallenge(p.challenge)).not.toThrow();
  });

  it("missões: soma itens e desconta penalidades", () => {
    const ch = preset("resgate");
    const r = scoreChallenge(ch, { cubos: 4, vermelho: 1, base: 2, "pen:interv": 1 });
    expect(r.value).toBe(4 * 15 + 25 + 20 - 10);
  });

  it("contra o tempo: penalidade soma, bônus desconta, DNF usa o limite", () => {
    const ch = preset("seguidor-de-linha");
    expect(scoreChallenge(ch, { tempo: 40.256, "pen:saida": 2, atalho: 1 }).value).toBe(40.26 + 10 - 5);
    const dnf = scoreChallenge(ch, { dnf: 1 });
    expect(dnf.value).toBe(120);
    expect(dnf.missing).toHaveLength(0);
    expect(scoreChallenge(ch, {}).missing.map((i) => i.id)).toEqual(["tempo"]);
  });

  it("rubrica: nota × peso com decimais", () => {
    const ch = preset("apresentacao");
    const r = scoreChallenge(ch, { problema: 4, solucao: 3, pesquisa: 2, comunicacao: 4, prototipo: 1 });
    expect(r.value).toBe(8 + 9 + 4 + 4 + 2);
  });

  it("nunca negativo com floorAtZero", () => {
    const ch = preset("resgate");
    expect(scoreChallenge(ch, { "pen:interv": 5 }).value).toBe(0);
  });

  it("respostas do cliente são limitadas às faixas válidas", () => {
    const ch = preset("resgate");
    expect(sanitizeCustomResponses(ch, { cubos: 99, base: 7, x: 1, "pen:interv": -3, vermelho: "1" })).toEqual({ cubos: 6, base: 2, vermelho: 1 });
  });

  it("valida a definição", () => {
    expect(() => sanitizeChallenge({ ...blankChallenge("missions", "ab") })).toThrow(/nome/);
    expect(() => sanitizeChallenge({ ...blankChallenge("time", "Corrida"), items: [] })).toThrow();
    const ok = sanitizeChallenge({ ...blankChallenge("time", "Corrida"), scoring: { direction: "higher" } });
    expect(ok.scoring.direction).toBe("lower");
  });

  it("formata valores por unidade", () => {
    expect(formatScore(83.5, { unit: "s", decimals: 2, direction: "lower" })).toBe("1:23.50 s");
    expect(formatScore(90, { unit: "pts", decimals: 0, direction: "higher" })).toBe("90 pts");
  });
});
