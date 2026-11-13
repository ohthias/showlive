import type {
  Challenge,
  ChallengeItem,
  ChallengePenalty,
  ChallengeScoring,
  ChallengeType,
  CustomResponses,
  ItemKind,
} from "./challenge-types";

export type * from "./challenge-types";

/* ------------------------------------------------------------- tipos */

export const CHALLENGE_TYPES: Record<
  ChallengeType,
  { label: string; short: string; description: string; scoring: ChallengeScoring; kinds: ItemKind[] }
> = {
  missions: {
    label: "Missões",
    short: "Pontos por tarefas",
    description: "O robô cumpre tarefas na arena e cada uma vale pontos. Vence quem somar mais.",
    scoring: { direction: "higher", unit: "pts", decimals: 0, timeLimitSec: 150, floorAtZero: true },
    kinds: ["check", "count", "choice"],
  },
  time: {
    label: "Contra o tempo",
    short: "Menor tempo vence",
    description: "Percurso, seguidor de linha, labirinto: vence quem completa no menor tempo. Penalidades somam segundos.",
    scoring: { direction: "lower", unit: "s", decimals: 2, timeLimitSec: 120, floorAtZero: true },
    kinds: ["time", "check", "count"],
  },
  judged: {
    label: "Avaliação por juízes",
    short: "Rubrica com critérios",
    description: "Apresentação, design de engenharia, inovação: juízes dão notas por critério, com pesos.",
    scoring: { direction: "higher", unit: "pts", decimals: 1, timeLimitSec: null, floorAtZero: true },
    kinds: ["scale", "check", "choice"],
  },
  measure: {
    label: "Medição",
    short: "Distância, altura, carga",
    description: "Lançamento, salto, carga suportada: vale o que for medido (e você escolhe se maior ou menor vence).",
    scoring: { direction: "higher", unit: "cm", decimals: 1, timeLimitSec: null, floorAtZero: true },
    kinds: ["number", "check", "count"],
  },
};

export const ITEM_KINDS: Record<ItemKind, { label: string; hint: string }> = {
  check: { label: "Sim / Não", hint: "Vale os pontos se cumprido" },
  count: { label: "Quantidade", hint: "Pontos por unidade, até um máximo" },
  choice: { label: "Opções", hint: "Uma escolha, cada uma com seus pontos" },
  scale: { label: "Nota (rubrica)", hint: "De mín. a máx., multiplicada pelo peso" },
  number: { label: "Medida", hint: "Valor medido × fator" },
  time: { label: "Tempo", hint: "Cronometrado, em segundos" },
};

/* ---------------------------------------------------------- modelos */

let seq = 0;
export const newId = (prefix = "i") => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function blankChallenge(type: ChallengeType, name = ""): Challenge {
  const meta = CHALLENGE_TYPES[type];
  const items: ChallengeItem[] =
    type === "time"
      ? [{ id: "tempo", label: "Tempo do percurso", kind: "time", required: true }]
      : type === "measure"
        ? [{ id: "medida", label: "Melhor medida da tentativa", kind: "number", points: 1, min: 0, max: 10000, required: true }]
        : type === "judged"
          ? [{ id: "c1", label: "Critério 1", kind: "scale", min: 1, max: 4, points: 1, required: true }]
          : [{ id: "m1", label: "Missão 1", kind: "check", points: 10 }];
  return { version: 1, type, name, objective: "", rules: [], items, penalties: [], scoring: { ...meta.scoring } };
}

/** Desafios prontos para começar (o usuário pode editar tudo). */
export const CHALLENGE_PRESETS: { id: string; challenge: Challenge }[] = [
  {
    id: "seguidor-de-linha",
    challenge: {
      version: 1,
      type: "time",
      name: "Seguidor de Linha",
      objective: "Percorrer a pista seguindo a linha preta, do início ao fim, no menor tempo possível.",
      rules: [
        "Cada equipe tem até 3 tentativas por rodada; vale a melhor.",
        "O robô deve ser totalmente autônomo após a largada.",
        "Sair da linha com as duas rodas é uma saída de pista.",
        "Após 3 saídas de pista, a tentativa é encerrada com o tempo limite.",
      ],
      items: [
        { id: "tempo", label: "Tempo até a chegada", kind: "time", required: true },
        { id: "atalho", label: "Passou pelo trecho de interseções sem errar", kind: "check", points: 5, description: "Bônus: desconta segundos do tempo." },
      ],
      penalties: [
        { id: "saida", label: "Saída de pista", points: 5, max: 3 },
        { id: "toque", label: "Toque da equipe no robô", points: 10, max: 2 },
      ],
      scoring: { direction: "lower", unit: "s", decimals: 2, timeLimitSec: 120, floorAtZero: true },
    },
  },
  {
    id: "resgate",
    challenge: {
      version: 1,
      type: "missions",
      name: "Resgate na Arena",
      objective: "Levar as vítimas (cubos) até a zona de resgate e voltar à base antes do fim da partida.",
      rules: [
        "Partida de 2 minutos e 30 segundos.",
        "Só contam os cubos totalmente dentro da zona de resgate ao final.",
        "Cubos derrubados para fora da arena não voltam ao jogo.",
      ],
      items: [
        { id: "cubos", label: "Cubos dentro da zona de resgate", kind: "count", points: 15, max: 6 },
        { id: "vermelho", label: "Cubo vermelho (vítima grave) resgatado", kind: "check", points: 25 },
        { id: "base", label: "Onde o robô terminou", kind: "choice", options: [
          { label: "Fora da base", points: 0 },
          { label: "Parcialmente na base", points: 10 },
          { label: "Totalmente na base", points: 20 },
        ] },
      ],
      penalties: [{ id: "interv", label: "Intervenção (robô tocado fora da base)", points: 10, max: 5 }],
      scoring: { direction: "higher", unit: "pts", decimals: 0, timeLimitSec: 150, floorAtZero: true },
    },
  },
  {
    id: "apresentacao",
    challenge: {
      version: 1,
      type: "judged",
      name: "Apresentação do Projeto",
      objective: "Avaliar a apresentação do projeto de inovação da equipe perante a banca.",
      rules: [
        "5 minutos de apresentação e 5 minutos de perguntas.",
        "Notas de 1 (iniciante) a 4 (excede) em cada critério.",
        "A nota final é a soma ponderada dos critérios.",
      ],
      items: [
        { id: "problema", label: "Identificação do problema", kind: "scale", min: 1, max: 4, points: 2, required: true },
        { id: "solucao", label: "Solução e inovação", kind: "scale", min: 1, max: 4, points: 3, required: true },
        { id: "pesquisa", label: "Pesquisa e fontes", kind: "scale", min: 1, max: 4, points: 2, required: true },
        { id: "comunicacao", label: "Comunicação e trabalho em equipe", kind: "scale", min: 1, max: 4, points: 1, required: true },
        { id: "prototipo", label: "Trouxe protótipo funcional", kind: "check", points: 2 },
      ],
      penalties: [{ id: "tempo", label: "Estourou o tempo (por minuto)", points: 1, max: 5 }],
      scoring: { direction: "higher", unit: "pts", decimals: 1, timeLimitSec: 300, floorAtZero: true },
    },
  },
  {
    id: "lancamento",
    challenge: {
      version: 1,
      type: "measure",
      name: "Lançamento de Precisão",
      objective: "O robô lança a bolinha o mais longe possível dentro do corredor demarcado.",
      rules: [
        "Medição do ponto de lançamento até o primeiro toque no chão.",
        "Bolinha fora do corredor vale 0.",
        "Duas tentativas por rodada; vale a melhor.",
      ],
      items: [
        { id: "distancia", label: "Distância (cm)", kind: "number", points: 1, min: 0, max: 2000, required: true },
        { id: "alvo", label: "Acertou o alvo central", kind: "check", points: 50, description: "Bônus em centímetros." },
      ],
      penalties: [{ id: "queima", label: "Queimou a linha de lançamento", points: 20, max: 1 }],
      scoring: { direction: "higher", unit: "cm", decimals: 1, timeLimitSec: 60, floorAtZero: true },
    },
  },
];

/* ---------------------------------------------------------- cálculo */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function itemRange(item: ChallengeItem): { min: number; max: number } {
  switch (item.kind) {
    case "check":
      return { min: 0, max: 1 };
    case "count":
      return { min: 0, max: item.max ?? 10 };
    case "choice":
      return { min: 0, max: Math.max(0, (item.options?.length ?? 1) - 1) };
    case "scale":
      return { min: item.min ?? 1, max: item.max ?? 4 };
    case "number":
      return { min: item.min ?? 0, max: item.max ?? 100000 };
    case "time":
      return { min: 0, max: 24 * 3600 };
  }
}

/** Quanto um item contribui para o resultado, dada a resposta. */
export function itemValue(item: ChallengeItem, value: number | undefined): number {
  if (value === undefined || value === null || Number.isNaN(value)) return 0;
  const { min, max } = itemRange(item);
  const v = clamp(value, min, max);
  switch (item.kind) {
    case "check":
      return v === 1 ? (item.points ?? 0) : 0;
    case "count":
      return Math.round(v) * (item.points ?? 0);
    case "choice":
      return item.options?.[Math.round(v)]?.points ?? 0;
    case "scale":
      return v * (item.points ?? 1);
    case "number":
      return v * (item.points ?? 1);
    case "time":
      return v;
  }
}

export interface CustomBreakdown {
  value: number;
  base: number;
  penalty: number;
  dnf: boolean;
  missing: ChallengeItem[];
  zeroed: boolean;
}

/**
 * Resultado de uma tentativa.
 *  - higher: soma dos itens − penalidades
 *  - lower (tempo): tempo + penalidades − bônus (itens que não são tempo)
 * "dnf" (não completou) usa o tempo limite como tempo.
 */
export function scoreChallenge(ch: Challenge, responses: CustomResponses): CustomBreakdown {
  const lower = ch.scoring.direction === "lower";
  const dnf = responses.dnf === 1 && !!ch.scoring.timeLimitSec;
  let base = 0;
  for (const item of ch.items) {
    if (item.kind === "time") {
      base += dnf ? (ch.scoring.timeLimitSec ?? 0) : itemValue(item, responses[item.id]);
    } else {
      const v = itemValue(item, responses[item.id]);
      base += lower ? -v : v;
    }
  }
  let zeroed = false;
  const penalty = ch.penalties.reduce((acc, p) => {
    const n = clamp(Math.round(responses[`pen:${p.id}`] ?? 0), 0, p.max);
    if (p.table?.length) {
      const tier = penaltyTier(p, n);
      if (tier?.zeroesTotal) zeroed = true;
      return acc + (tier?.points ?? 0);
    }
    return acc + n * p.points;
  }, 0);
  let value = zeroed ? 0 : lower ? base + penalty : base - penalty;
  if (ch.scoring.floorAtZero) value = Math.max(0, value);
  const f = 10 ** ch.scoring.decimals;
  value = Math.round(value * f) / f;

  const missing = dnf
    ? ch.items.filter((i) => i.required && i.kind !== "time" && responses[i.id] === undefined)
    : ch.items.filter((i) => i.required && responses[i.id] === undefined);
  return { value, base, penalty, dnf, missing, zeroed };
}

/** Faixa da tabela para n ocorrências (a maior faixa ≤ n). */
export function penaltyTier(p: ChallengePenalty, n: number) {
  const table = [...(p.table ?? [])].sort((a, b) => a.count - b.count);
  return table.filter((t) => t.count <= n).pop() ?? null;
}

export function sanitizeCustomResponses(ch: Challenge, raw: unknown): CustomResponses {
  const out: CustomResponses = {};
  if (!raw || typeof raw !== "object") return out;
  const input = raw as Record<string, unknown>;
  for (const item of ch.items) {
    const v = Number(input[item.id]);
    if (input[item.id] === undefined || input[item.id] === null || !Number.isFinite(v)) continue;
    const { min, max } = itemRange(item);
    out[item.id] = ["check", "count", "choice"].includes(item.kind) ? clamp(Math.round(v), min, max) : clamp(v, min, max);
  }
  for (const p of ch.penalties) {
    const v = Number(input[`pen:${p.id}`]);
    if (Number.isFinite(v) && v > 0) out[`pen:${p.id}`] = clamp(Math.round(v), 0, p.max);
  }
  if (Number(input.dnf) === 1 && ch.scoring.timeLimitSec) out.dnf = 1;
  return out;
}

/* ------------------------------------------- validação da definição */

const txt = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v: unknown, fallback: number, lo = -1e6, hi = 1e6) => {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
};

/** Normaliza um desafio vindo do cliente. Lança Error com mensagem amigável. */
export function sanitizeChallenge(input: unknown): Challenge {
  const raw = (input ?? {}) as Partial<Challenge>;
  const type: ChallengeType = raw.type && raw.type in CHALLENGE_TYPES ? raw.type : "missions";
  const name = txt(raw.name, 60);
  if (name.length < 3) throw new Error("Dê um nome com pelo menos 3 letras ao desafio.");

  const ids = new Set<string>();
  const safeId = (v: unknown, prefix: string) => {
    let id = String(v ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || newId(prefix);
    while (ids.has(id)) id = newId(prefix);
    ids.add(id);
    return id;
  };

  const items: ChallengeItem[] = (Array.isArray(raw.items) ? raw.items : []).slice(0, 40).map((it) => {
    const kind: ItemKind = it?.kind && it.kind in ITEM_KINDS ? it.kind : "check";
    const item: ChallengeItem = {
      id: safeId(it?.id, "i"),
      label: txt(it?.label, 120) || "Item sem nome",
      kind,
      required: Boolean(it?.required),
    };
    const desc = txt(it?.description, 240);
    if (desc) item.description = desc;
    const group = txt(it?.group, 80);
    if (group) item.group = group;
    if (typeof it?.image === "string" && /^\/images\/[\w/.-]+$/.test(it.image)) item.image = it.image;
    if (kind === "check" || kind === "count" || kind === "scale" || kind === "number") item.points = num(it?.points, kind === "check" ? 10 : 1);
    if (kind === "count") item.max = Math.round(num(it?.max, 5, 1, 100));
    if (kind === "scale") {
      item.min = Math.round(num(it?.min, 1, 0, 10));
      item.max = Math.round(num(it?.max, 4, item.min + 1, 20));
    }
    if (kind === "number") {
      item.min = num(it?.min, 0);
      item.max = num(it?.max, 10000, item.min + 1);
    }
    if (kind === "choice") {
      const opts = (Array.isArray(it?.options) ? it.options : [])
        .slice(0, 10)
        .map((o) => ({ label: txt(o?.label, 60) || "Opção", points: num(o?.points, 0) }));
      item.options = opts.length >= 2 ? opts : [{ label: "Não", points: 0 }, { label: "Sim", points: 10 }];
    }
    return item;
  });
  if (!items.length) throw new Error("O desafio precisa de pelo menos um item de pontuação.");
  if (type === "time" && items.filter((i) => i.kind === "time").length !== 1)
    throw new Error("Desafios contra o tempo precisam de exatamente um item do tipo Tempo.");

  const penalties: ChallengePenalty[] = (Array.isArray(raw.penalties) ? raw.penalties : []).slice(0, 20).map((p) => {
    const pen: ChallengePenalty = {
      id: safeId(p?.id, "p"),
      label: txt(p?.label, 120) || "Penalidade",
      points: Math.abs(num(p?.points, 5)),
      max: Math.round(num(p?.max, 3, 1, 50)),
    };
    if (Array.isArray(p?.table) && p.table.length) {
      pen.table = p.table.slice(0, 20).map((t) => ({
        count: Math.round(num(t?.count, 0, 0, 50)),
        points: Math.abs(num(t?.points, 0)),
        ...(t?.zeroesTotal ? { zeroesTotal: true } : {}),
      }));
    }
    return pen;
  });

  const s = (raw.scoring ?? {}) as Partial<ChallengeScoring>;
  const meta = CHALLENGE_TYPES[type].scoring;
  const scoring: ChallengeScoring = {
    direction: s.direction === "lower" || s.direction === "higher" ? s.direction : meta.direction,
    unit: txt(s.unit, 8) || meta.unit,
    decimals: ([0, 1, 2] as const).includes(s.decimals as 0) ? (s.decimals as 0 | 1 | 2) : meta.decimals,
    timeLimitSec: s.timeLimitSec ? Math.round(num(s.timeLimitSec, 0, 1, 24 * 3600)) : null,
    floorAtZero: s.floorAtZero !== false,
  };
  if (type === "time") scoring.direction = "lower";

  return {
    version: 1,
    type,
    name,
    objective: txt(raw.objective, 600),
    rules: (Array.isArray(raw.rules) ? raw.rules : []).map((r) => txt(r, 300)).filter(Boolean).slice(0, 30),
    items,
    penalties,
    scoring,
  };
}

/** Faixa teórica do resultado — usada só como referência no regulamento. */
export function bestPossible(ch: Challenge): number | null {
  if (ch.scoring.direction === "lower") return null;
  return ch.items.reduce((acc, i) => {
    const { max } = itemRange(i);
    if (i.kind === "choice") return acc + Math.max(0, ...(i.options ?? []).map((o) => o.points));
    return acc + Math.max(0, itemValue(i, max));
  }, 0);
}
