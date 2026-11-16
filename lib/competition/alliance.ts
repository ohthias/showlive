import { itemValue, penaltyTier } from "./challenge";
import type { Challenge, CustomResponses } from "./challenge-types";
import type {
  AllianceConfig,
  AllianceResult,
  AllianceSlot,
  MatchResult,
  TeamMatchFlag,
} from "./alliance-types";

export type * from "./alliance-types";
export * from "./alliance-config";

/**
 * Formato de alianças — funções puras (servidor, mesa e telão).
 *
 * Placar: cada aliança preenche a súmula do desafio. Os itens somam para a
 * própria aliança; as penalidades vão para o adversário (FTC/FRC) ou
 * descontam da própria aliança, conforme a configuração.
 *
 * Classificação (versus): RP por vitória/empate/derrota + RP bônus,
 * ordenada por média (ou soma) de RP e pelos desempates escolhidos.
 * Cooperativo: média de pontos da aliança.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------- placar */

function penaltyOf(ch: Challenge, responses: CustomResponses) {
  let zeroed = false;
  const total = ch.penalties.reduce((acc, p) => {
    const n = clamp(Math.round(responses[`pen:${p.id}`] ?? 0), 0, p.max);
    if (p.table?.length) {
      const tier = penaltyTier(p, n);
      if (tier?.zeroesTotal) zeroed = true;
      return acc + (tier?.points ?? 0);
    }
    return acc + n * p.points;
  }, 0);
  return { total, zeroed };
}

function allianceBase(ch: Challenge, responses: CustomResponses) {
  const byGroup: Record<string, number> = {};
  let base = 0;
  for (const item of ch.items) {
    const v = itemValue(item, responses[item.id]);
    base += v;
    if (item.group) byGroup[item.group] = (byGroup[item.group] ?? 0) + v;
  }
  return { base, byGroup };
}

const round = (v: number, decimals: number) => Math.round(v * 10 ** decimals) / 10 ** decimals;

/**
 * Placar de uma partida a partir das respostas de cada aliança.
 * Lança Error se faltar item obrigatório.
 */
export function scoreMatch(
  ch: Challenge,
  cfg: AllianceConfig,
  red: CustomResponses,
  blue: CustomResponses | null,
  flags: Record<string, TeamMatchFlag> = {},
): MatchResult {
  const versus = cfg.mode === "versus" && blue !== null;
  const sides = versus ? [red, blue!] : [red];
  for (const resp of sides) {
    const missing = ch.items.filter((i) => i.required && resp[i.id] === undefined);
    if (missing.length) throw new Error(`Preencha: ${missing.map((i) => i.label).join(", ")}.`);
  }
  const parts = sides.map((resp) => ({ resp, ...allianceBase(ch, resp), pen: penaltyOf(ch, resp) }));

  const result = (i: number): AllianceResult => {
    const me = parts[i];
    const opp = versus ? parts[1 - i] : null;
    let score =
      cfg.penaltiesTo === "opponent" && opp ? me.base + opp.pen.total : me.base - me.pen.total;
    if (me.pen.zeroed) score = opp && cfg.penaltiesTo === "opponent" ? opp.pen.total : 0;
    if (ch.scoring.floorAtZero) score = Math.max(0, score);
    const bonus = cfg.bonusRp.filter((b) => (b.group ? (me.byGroup[b.group] ?? 0) : me.base) >= b.min);
    return {
      responses: me.resp,
      base: round(me.base, ch.scoring.decimals),
      penalty: round(me.pen.total, ch.scoring.decimals),
      byGroup: Object.fromEntries(Object.entries(me.byGroup).map(([k, v]) => [k, round(v, ch.scoring.decimals)])),
      bonus: bonus.map((b) => b.label),
      bonusRp: bonus.reduce((a, b) => a + b.rp, 0),
      score: round(score, ch.scoring.decimals),
    };
  };
  return { red: result(0), blue: versus ? result(1) : null, flags };
}

/* ------------------------------------------------------- classificação */

export interface RankMatch {
  id: string;
  number: number;
  red: AllianceSlot[];
  blue: AllianceSlot[];
  /** Só partidas com resultado final (aprovado) entram. */
  final: boolean;
  result: {
    red: Pick<AllianceResult, "score" | "penalty" | "byGroup" | "bonusRp">;
    blue: Pick<AllianceResult, "score" | "penalty" | "byGroup" | "bonusRp"> | null;
    flags: Record<string, TeamMatchFlag>;
  } | null;
}

export interface AllianceRankRow {
  team: { id: string; name: string; number: string | null; organization: string | null };
  rank: number;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  rp: number;
  /** Média de RP nas partidas que contam. */
  rs: number;
  avg: number;
  high: number;
  /** Valor usado na ordenação principal. */
  score: number;
  /** Valores dos desempates, na ordem da configuração. */
  tb: number[];
  evaluated: number;
}

interface Entry {
  rp: number;
  score: number;
  opp: number | null;
  win: boolean;
  loss: boolean;
  tie: boolean;
  penalty: number;
  byGroup: Record<string, number>;
}

const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function computeAllianceRanking(
  teams: AllianceRankRow["team"][],
  matches: RankMatch[],
  cfg: AllianceConfig,
): AllianceRankRow[] {
  const entries = new Map<string, Entry[]>(teams.map((t) => [t.id, []]));
  for (const m of matches) {
    if (!m.final || !m.result) continue;
    const sides: { slots: AllianceSlot[]; me: NonNullable<RankMatch["result"]>["red"]; opp: NonNullable<RankMatch["result"]>["red"] | null }[] = [
      { slots: m.red, me: m.result.red, opp: m.result.blue },
    ];
    if (cfg.mode === "versus" && m.result.blue) sides.push({ slots: m.blue, me: m.result.blue, opp: m.result.red });
    for (const side of sides) {
      const versus = side.opp !== null;
      const win = versus && side.me.score > side.opp!.score;
      const loss = versus && side.me.score < side.opp!.score;
      const tie = versus && !win && !loss;
      for (const slot of side.slots) {
        if (slot.surrogate) continue;
        const list = entries.get(slot.teamId);
        if (!list) continue;
        const flag = m.result.flags[slot.teamId];
        const out = flag === "dq" || flag === "noshow";
        const rp = out ? 0 : (win ? cfg.rp.win : loss ? cfg.rp.loss : tie ? cfg.rp.tie : 0) + side.me.bonusRp;
        list.push({
          rp,
          score: out && flag === "dq" ? 0 : side.me.score,
          opp: side.opp?.score ?? null,
          win: win && !out,
          loss: loss || out,
          tie: tie && !out,
          penalty: side.me.penalty,
          byGroup: side.me.byGroup,
        });
      }
    }
  }

  const rows = teams.map((team) => {
    const all = entries.get(team.id) ?? [];
    let counted = all;
    if (cfg.dropLowest > 0 && all.length > cfg.dropLowest) {
      const sorted = [...all].sort((a, b) => (cfg.mode === "coop" ? a.score - b.score : a.rp - b.rp || a.score - b.score));
      counted = sorted.slice(cfg.dropLowest);
    }
    const rpTotal = counted.reduce((a, e) => a + e.rp, 0);
    const avg = avgOf(counted.map((e) => e.score));
    const high = Math.max(0, ...counted.map((e) => e.score));
    const tbValue = (t: string): number => {
      if (t === "avg") return avg;
      if (t === "high") return high;
      if (t === "wins") return counted.filter((e) => e.win).length;
      if (t === "margin") return avgOf(counted.filter((e) => e.opp !== null).map((e) => e.score - (e.opp ?? 0)));
      if (t === "penalties") return -avgOf(counted.map((e) => e.penalty));
      if (t.startsWith("group:")) return avgOf(counted.map((e) => e.byGroup[t.slice(6)] ?? 0));
      return 0;
    };
    const score = cfg.rankBy === "rp_total" ? rpTotal : cfg.rankBy === "score_avg" ? avg : avgOf(counted.map((e) => e.rp));
    return {
      team,
      played: all.length,
      wins: all.filter((e) => e.win).length,
      losses: all.filter((e) => e.loss).length,
      ties: all.filter((e) => e.tie).length,
      rp: r2(rpTotal),
      rs: r2(avgOf(counted.map((e) => e.rp))),
      avg: r2(avg),
      high,
      score: r2(score),
      tb: cfg.tiebreakers.map((t) => r2(tbValue(t))),
      evaluated: all.length,
    };
  });

  const key = (r: (typeof rows)[number]) => (r.played ? [r.score, ...r.tb] : []);
  const cmp = (a: number[], b: number[]) => {
    if (!a.length || !b.length) return b.length - a.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (b[i] ?? 0) - (a[i] ?? 0);
    return 0;
  };
  rows.sort((a, b) => cmp(key(a), key(b)) || a.team.name.localeCompare(b.team.name, "pt-BR"));
  let last: number[] | null = null;
  let lastRank = 0;
  return rows.map((row, i) => {
    const k = key(row);
    const rank = last && k.length && cmp(last, k) === 0 ? lastRank : i + 1;
    last = k;
    lastRank = rank;
    return { ...row, rank };
  });
}

/* --------------------------------------------------- gerador de partidas */

export interface ScheduleOptions {
  teamIds: string[];
  matchesPerTeam: number;
  teamsPerAlliance: number;
  mode: AllianceConfig["mode"];
  /** Tentativas aleatórias; fica com a de menor custo. */
  attempts?: number;
  /** Gerador aleatório (testes passam um determinístico). */
  random?: () => number;
}

export interface GeneratedMatch {
  red: AllianceSlot[];
  blue: AllianceSlot[];
}

/** Gerador simples e determinístico a partir de uma semente (mulberry32). */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function slotsPerMatch(o: Pick<ScheduleOptions, "teamsPerAlliance" | "mode">) {
  return o.teamsPerAlliance * (o.mode === "versus" ? 2 : 1);
}

/**
 * Cronograma de classificatórias: cada equipe joga `matchesPerTeam` vezes.
 * Se as vagas não fecham, algumas equipes jogam uma partida a mais como
 * "surrogate" (não conta para elas). Entre várias tentativas, fica a que
 * menos repete parceiros/adversários e menos coloca equipes em partidas
 * seguidas.
 */
export function buildMatchSchedule(o: ScheduleOptions): GeneratedMatch[] {
  const S = slotsPerMatch(o);
  const teams = [...new Set(o.teamIds)];
  if (teams.length < S) throw new Error(`São necessárias pelo menos ${S} equipes para este formato.`);
  const N = Math.max(1, Math.round(o.matchesPerTeam));
  const total = teams.length * N;
  const matches = Math.ceil(total / S);
  const extra = matches * S - total;
  const rnd = o.random ?? Math.random;
  const attempts = o.attempts ?? 200;
  const k = o.teamsPerAlliance;

  let best: { cost: number; schedule: GeneratedMatch[] } | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Sequência: N passadas embaralhadas + extras (surrogates) de equipes distintas.
    const seq: { teamId: string; surrogate: boolean }[] = [];
    for (let r = 0; r < N; r++) for (const t of shuffle(teams, rnd)) seq.push({ teamId: t, surrogate: false });
    for (const t of shuffle(teams, rnd).slice(0, extra)) seq.push({ teamId: t, surrogate: true });

    // Monta as partidas tirando da sequência e evitando repetir equipe na mesma partida
    // e equipes que acabaram de jogar.
    const pool = [...seq];
    const built: { teamId: string; surrogate: boolean }[][] = [];
    let ok = true;
    while (pool.length) {
      const prev = new Set((built.at(-1) ?? []).map((x) => x.teamId));
      const chosen: { teamId: string; surrogate: boolean }[] = [];
      const inMatch = new Set<string>();
      for (const pass of [0, 1]) {
        for (let i = 0; i < pool.length && chosen.length < S; i++) {
          const c = pool[i];
          if (inMatch.has(c.teamId) || (pass === 0 && prev.has(c.teamId))) continue;
          chosen.push(c);
          inMatch.add(c.teamId);
          pool.splice(i, 1);
          i--;
        }
      }
      if (chosen.length < S) {
        ok = false;
        break;
      }
      built.push(chosen);
    }
    if (!ok) continue;

    // Divide cada partida em alianças minimizando parceiros repetidos.
    const partners = new Map<string, number>();
    const opponents = new Map<string, number>();
    const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    let cost = 0;
    const schedule: GeneratedMatch[] = [];
    let prevIds = new Set<string>();
    for (const m of built) {
      let split = { red: m.slice(0, k), blue: m.slice(k) };
      if (o.mode === "versus" && k > 1) {
        let bestSplit = split;
        let bestCost = Infinity;
        for (let t = 0; t < 12; t++) {
          const s = shuffle(m, rnd);
          const cand = { red: s.slice(0, k), blue: s.slice(k) };
          let c = 0;
          for (const side of [cand.red, cand.blue])
            for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++) c += (partners.get(pk(side[i].teamId, side[j].teamId)) ?? 0) * 4;
          for (const a of cand.red) for (const b of cand.blue) c += opponents.get(pk(a.teamId, b.teamId)) ?? 0;
          if (c < bestCost) {
            bestCost = c;
            bestSplit = cand;
          }
        }
        split = bestSplit;
      }
      for (const side of [split.red, split.blue])
        for (let i = 0; i < side.length; i++)
          for (let j = i + 1; j < side.length; j++) {
            const key = pk(side[i].teamId, side[j].teamId);
            const n = partners.get(key) ?? 0;
            cost += n * 4;
            partners.set(key, n + 1);
          }
      for (const a of split.red)
        for (const b of split.blue) {
          const key = pk(a.teamId, b.teamId);
          const n = opponents.get(key) ?? 0;
          cost += n;
          opponents.set(key, n + 1);
        }
      const ids = m.map((x) => x.teamId);
      cost += ids.filter((id) => prevIds.has(id)).length * 6;
      prevIds = new Set(ids);
      const slot = (x: { teamId: string; surrogate: boolean }): AllianceSlot => (x.surrogate ? { teamId: x.teamId, surrogate: true } : { teamId: x.teamId });
      schedule.push({ red: split.red.map(slot), blue: o.mode === "versus" ? split.blue.map(slot) : [] });
    }
    if (!best || cost < best.cost) best = { cost, schedule };
    if (cost === 0) break;
  }
  if (!best) throw new Error("Não consegui montar o cronograma. Tente com mais equipes ou menos partidas por equipe.");
  return best.schedule;
}
