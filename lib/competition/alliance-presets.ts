import type { Challenge } from "./challenge-types";
import type { AllianceConfig } from "./alliance-types";

/**
 * Modelos prontos de eventos com alianças. Os itens e valores são exemplos
 * editáveis no construtor de desafios — não reproduzem o manual de nenhuma
 * temporada.
 */

export interface AlliancePreset {
  id: string;
  label: string;
  /** Linha curta para os cartões ("2 × 2 · vermelha × azul"). */
  short: string;
  description: string;
  /** Duração do cronômetro da partida (s). */
  timerSec: number;
  challenge: Challenge;
}

const base = (name: string, objective: string, alliance: AllianceConfig, rest: Pick<Challenge, "items" | "penalties" | "rules">): Challenge => ({
  version: 1,
  type: "missions",
  name,
  objective,
  scoring: { direction: "higher", unit: "pts", decimals: 0, timeLimitSec: null, floorAtZero: true },
  alliance,
  ...rest,
});

const ftc: AlliancePreset = {
  id: "ftc",
  label: "FTC (genérico)",
  short: "2 × 2 · vermelha × azul · RP",
  description:
    "Estrutura da FIRST Tech Challenge: autônomo de 30 s, teleoperado de 2 min com fim de jogo, faltas menores e maiores que viram pontos do adversário, RP por vitória e RP bônus. Os itens são exemplos para você trocar pelos da temporada.",
  timerSec: 158,
  challenge: base(
    "Partida FTC",
    "Duas alianças de duas equipes disputam cada partida. Vence a aliança com mais pontos; a classificação usa a média de RP.",
    {
      mode: "versus",
      teamsPerAlliance: 2,
      matchesPerTeam: 5,
      penaltiesTo: "opponent",
      rp: { win: 3, tie: 1, loss: 0 },
      bonusRp: [
        { id: "auto", label: "RP de autônomo", group: "Autônomo", min: 30, rp: 1 },
        { id: "end", label: "RP de fim de jogo", group: "Fim de jogo", min: 30, rp: 1 },
      ],
      rankBy: "rp_avg",
      tiebreakers: ["avg", "group:Autônomo", "high"],
      dropLowest: 0,
    },
    {
      rules: [
        "Partida de 2:30: autônomo de 30 s, 8 s de transição e teleoperado de 2 min (os últimos 20 s são o fim de jogo).",
        "Cada aliança tem a própria súmula; os pontos são da aliança, não de cada robô.",
        "Faltas viram pontos para a aliança adversária: menor = 5, maior = 15 (valores de exemplo).",
        "Vitória vale 3 RP, empate 1 RP. Cada RP bônus é conquistado ao atingir a meta indicada.",
        "Classificação pela média de RP; desempates: média de pontos, média no autônomo e maior pontuação.",
      ],
      items: [
        { id: "a_leave", label: "Robôs que saíram da zona de largada", kind: "count", points: 3, max: 2, group: "Autônomo" },
        { id: "a_high", label: "Elementos no alvo alto", kind: "count", points: 7, max: 20, group: "Autônomo" },
        { id: "a_low", label: "Elementos no alvo baixo", kind: "count", points: 3, max: 20, group: "Autônomo" },
        { id: "t_high", label: "Elementos no alvo alto", kind: "count", points: 5, max: 60, group: "Teleoperado" },
        { id: "t_low", label: "Elementos no alvo baixo", kind: "count", points: 2, max: 60, group: "Teleoperado" },
        { id: "e_park", label: "Robôs estacionados na base", kind: "count", points: 5, max: 2, group: "Fim de jogo" },
        { id: "e_lift", label: "Robôs suspensos", kind: "count", points: 20, max: 2, group: "Fim de jogo" },
      ],
      penalties: [
        { id: "minor", label: "Falta menor", points: 5, max: 20 },
        { id: "major", label: "Falta maior", points: 15, max: 10 },
      ],
    },
  ),
};

const coop: AlliancePreset = {
  id: "coop2",
  label: "Cooperativo de 2 equipes",
  short: "2 equipes juntas · média de pontos",
  description:
    "Duas equipes jogam juntas contra o placar e as duas recebem os pontos (estilo VEX IQ Teamwork). Classificação pela média de pontos, com a pior partida descartada.",
  timerSec: 60,
  challenge: base(
    "Desafio em dupla",
    "As duas equipes da aliança cooperam para somar o máximo de pontos em 60 segundos.",
    {
      mode: "coop",
      teamsPerAlliance: 2,
      matchesPerTeam: 4,
      penaltiesTo: "self",
      rp: { win: 0, tie: 0, loss: 0 },
      bonusRp: [],
      rankBy: "score_avg",
      tiebreakers: ["high"],
      dropLowest: 1,
    },
    {
      rules: [
        "Partida de 60 s com duas equipes na mesma aliança.",
        "A pontuação da partida vale para as duas equipes.",
        "Classificação pela média de pontos, descartando a pior partida de cada equipe; desempate pela maior pontuação.",
      ],
      items: [
        { id: "c_zone", label: "Elementos na zona de pontuação", kind: "count", points: 1, max: 30, group: "Partida" },
        { id: "c_goal", label: "Elementos no gol", kind: "count", points: 3, max: 20, group: "Partida" },
        { id: "c_stack", label: "Pilhas completas", kind: "count", points: 5, max: 10, group: "Partida" },
        { id: "c_park", label: "Robôs estacionados no fim", kind: "count", points: 2, max: 2, group: "Fim" },
      ],
      penalties: [{ id: "c_foul", label: "Elemento fora do campo", points: 1, max: 10 }],
    },
  ),
};

const frc: AlliancePreset = {
  id: "3v3",
  label: "Alianças 3 × 3",
  short: "3 × 3 · vermelha × azul · RP",
  description: "Alianças de três equipes (estilo FRC): autônomo, teleoperado e fim de jogo, faltas para o adversário e RP bônus.",
  timerSec: 150,
  challenge: base(
    "Partida 3 × 3",
    "Duas alianças de três equipes disputam cada partida.",
    {
      mode: "versus",
      teamsPerAlliance: 3,
      matchesPerTeam: 6,
      penaltiesTo: "opponent",
      rp: { win: 3, tie: 1, loss: 0 },
      bonusRp: [
        { id: "auto", label: "RP de autônomo", group: "Autônomo", min: 20, rp: 1 },
        { id: "score", label: "RP de pontuação", group: null, min: 120, rp: 1 },
      ],
      rankBy: "rp_avg",
      tiebreakers: ["avg", "group:Autônomo", "group:Fim de jogo"],
      dropLowest: 0,
    },
    {
      rules: [
        "Autônomo de 15 s e teleoperado de 2:15.",
        "Faltas viram pontos para a aliança adversária.",
        "Vitória 3 RP, empate 1 RP, mais os RP bônus.",
      ],
      items: [
        { id: "a_move", label: "Robôs que se moveram no autônomo", kind: "count", points: 3, max: 3, group: "Autônomo" },
        { id: "a_score", label: "Elementos pontuados no autônomo", kind: "count", points: 6, max: 20, group: "Autônomo" },
        { id: "t_score", label: "Elementos pontuados no teleoperado", kind: "count", points: 3, max: 80, group: "Teleoperado" },
        { id: "e_park", label: "Robôs estacionados", kind: "count", points: 2, max: 3, group: "Fim de jogo" },
        { id: "e_climb", label: "Robôs na escalada", kind: "count", points: 12, max: 3, group: "Fim de jogo" },
      ],
      penalties: [
        { id: "foul", label: "Falta", points: 4, max: 20 },
        { id: "tech", label: "Falta técnica", points: 12, max: 10 },
      ],
    },
  ),
};

const duel: AlliancePreset = {
  id: "1v1",
  label: "Confronto 1 × 1",
  short: "1 × 1 · vitória vale RP",
  description: "Duas equipes se enfrentam direto (sumô, futebol de robôs, mini-sumô). Vitória 3, empate 1; desempate pelo saldo.",
  timerSec: 120,
  challenge: base(
    "Confronto direto",
    "Cada partida é um duelo entre duas equipes. Vence quem marcar mais pontos.",
    {
      mode: "versus",
      teamsPerAlliance: 1,
      matchesPerTeam: 4,
      penaltiesTo: "opponent",
      rp: { win: 3, tie: 1, loss: 0 },
      bonusRp: [],
      rankBy: "rp_total",
      tiebreakers: ["margin", "wins", "avg"],
      dropLowest: 0,
    },
    {
      rules: [
        "Partida de 2 minutos entre duas equipes.",
        "Vitória 3 pontos de classificação, empate 1.",
        "Desempate: saldo médio, número de vitórias e média de pontos.",
      ],
      items: [
        { id: "d_points", label: "Pontos marcados (gols, rounds ou empurrões)", kind: "count", points: 1, max: 30, group: "Partida" },
        { id: "d_bonus", label: "Vitória por nocaute / ring out", kind: "check", points: 3, group: "Partida" },
      ],
      penalties: [{ id: "d_foul", label: "Falta (ponto para o adversário)", points: 1, max: 10 }],
    },
  ),
};

const blank: AlliancePreset = {
  id: "blank",
  label: "Personalizado",
  short: "Você define tudo",
  description: "Começa com uma súmula mínima de 2 × 2; ajuste o tamanho das alianças, RP, desempates e itens no construtor.",
  timerSec: 150,
  challenge: base(
    "Partida de alianças",
    "",
    {
      mode: "versus",
      teamsPerAlliance: 2,
      matchesPerTeam: 5,
      penaltiesTo: "opponent",
      rp: { win: 2, tie: 1, loss: 0 },
      bonusRp: [],
      rankBy: "rp_avg",
      tiebreakers: ["avg", "high"],
      dropLowest: 0,
    },
    {
      rules: [],
      items: [{ id: "p1", label: "Pontos da tarefa 1", kind: "count", points: 5, max: 10, group: "Partida" }],
      penalties: [{ id: "f1", label: "Falta", points: 5, max: 10 }],
    },
  ),
};

export const ALLIANCE_PRESETS: AlliancePreset[] = [ftc, coop, frc, duel, blank];

export function findAlliancePreset(id: string) {
  return ALLIANCE_PRESETS.find((p) => p.id === id) ?? null;
}
