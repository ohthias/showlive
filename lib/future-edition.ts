import feData from "@/data/future-edition.json";
import type { Challenge, ChallengeItem } from "./challenge-types";

/**
 * FLL Future Edition — os dados vêm de public/data/fll/future-edition.json do
 * RoboStage e viram um desafio no formato do ShowLive (itens agrupados por
 * missão + tabela de penalidades por cartões, em que o 3º cartão zera a partida).
 * Assim a mesa, o telão e o ranking usam o mesmo motor dos desafios.
 */

interface FeObjective {
  id: string;
  label: string;
  type: "toggle" | "counter" | "select";
  points?: number;
  min?: number;
  max?: number;
  pointsPerUnit?: number;
  options?: { id: string; label: string; points: number }[];
}
interface FeMission {
  id: string;
  code: string;
  title: string;
  description?: string;
  image?: string;
  objectives: FeObjective[];
}
interface FeData {
  season: string;
  title: string;
  missions: FeMission[];
  penalties: { title: string; table: { count: number; points: number; zeroesTotal?: boolean }[] };
}

const data = feData as unknown as FeData;

export const FE_SEASON_LABEL = `${data.season.charAt(0)}${data.season.slice(1).toLowerCase()} Future Edition`;

export function futureEditionChallenge(): Challenge {
  const items: ChallengeItem[] = data.missions.flatMap((m) =>
    m.objectives.map((o): ChallengeItem => {
      const base = {
        id: o.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40),
        label: o.label,
        group: `${m.code} · ${m.title}`,
        ...(m.image ? { image: m.image } : {}),
      };
      if (o.type === "toggle") return { ...base, kind: "check", points: o.points ?? 0 };
      if (o.type === "select")
        return { ...base, kind: "choice", options: (o.options ?? []).map((x) => ({ label: x.label, points: x.points })) };
      return { ...base, kind: "count", points: o.pointsPerUnit ?? 0, max: o.max ?? 30 };
    }),
  );
  const maxCards = Math.max(...data.penalties.table.map((t) => t.count));
  return {
    version: 1,
    type: "missions",
    name: data.title,
    objective: "Partida de 2 minutos e 30 segundos com os kits LEGO® Education Computer Science & AI.",
    rules: [
      "Partida de 2:30; a pontuação é conferida ao final, com a mesa parada.",
      "Penalidades por cartões: 1 cartão −10, 2 cartões −30, 3 cartões zeram a partida.",
      "Classificação pela melhor partida; empate decidido pela segunda e depois pela terceira melhor.",
    ],
    items,
    penalties: [
      {
        id: "cartoes",
        label: data.penalties.title,
        points: 0,
        max: maxCards,
        table: data.penalties.table.map((t) => ({ count: t.count, points: Math.abs(t.points), zeroesTotal: t.zeroesTotal })),
      },
    ],
    scoring: { direction: "higher", unit: "pts", decimals: 0, timeLimitSec: 150, floorAtZero: true },
  };
}
