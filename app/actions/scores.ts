"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { activity, rounds, scores, teams } from "@/db/schema";
import { getScorer, requireEventRole, requireScoreEditor } from "@/lib/access";
import { run, UserError } from "@/lib/action";
import { getSnapshot, nudge } from "@/lib/live-hub";
import { getMissions } from "@/lib/missions";
import { availableRoundsForTeam } from "@/lib/ranking";
import { sanitizeResponses, scoreRound } from "@/lib/scoring";
import { getEventById } from "@/lib/snapshot";
import { sanitizeCustomResponses, scoreChallenge } from "@/lib/challenge";
import { sanitizeObrResponses, scoreObr } from "@/lib/obr";
import { formatScore } from "@/lib/format";
import { scoringOf } from "@/lib/event-format";

type EventRow = NonNullable<Awaited<ReturnType<typeof getEventById>>>;
type Snap = NonNullable<Awaited<ReturnType<typeof getSnapshot>>>;

/** Recalcula a nota a partir das respostas, conforme a liga/rodada. */
async function evaluate(event: EventRow, round: Snap["rounds"][number], raw: unknown) {
  let result: { points: number; extras: ReturnType<typeof scoreRound>["extras"] };
  let responses: Record<string, unknown>;
  let tiebreak: number | null = null;
  let format = scoringOf(event);
  const extra = round.extra ? event.league?.extras.find((x) => x.id === round.extra!.id) : undefined;
  const customChallenge = extra ?? (event.format === "custom" || event.format === "fll_fe" ? event.challenge : null);

  if (customChallenge) {
    const clean = sanitizeCustomResponses(customChallenge, raw);
    const r = scoreChallenge(customChallenge, clean);
    if (r.missing.length) throw new UserError(`Preencha: ${r.missing.map((i) => i.label).join(", ")}.`);
    responses = clean;
    result = { points: r.value, extras: {} };
    if (extra) format = { direction: extra.scoring.direction, unit: extra.scoring.unit, decimals: extra.scoring.decimals };
  } else if (event.format === "obr") {
    const db = await getDb();
    const [row] = await db.select({ meta: rounds.meta }).from(rounds).where(eq(rounds.id, round.id)).limit(1);
    const arena = event.league?.arenas.find((a) => a.id === row?.meta?.arenaId);
    if (!arena) throw new UserError("Esta rodada não está ligada a uma arena. Revise as arenas no hub.");
    const clean = sanitizeObrResponses(arena, raw);
    if (clean.chegada && !clean.desistiu && clean.tempo === null) throw new UserError("Informe o tempo da rodada (o robô chegou).");
    const b = scoreObr(arena, clean);
    responses = clean as unknown as Record<string, unknown>;
    result = { points: b.total, extras: {} };
    tiebreak = b.tempo;
  } else if (event.format === "custom") {
    throw new UserError("O desafio deste evento ainda não foi montado.");
  } else {
    const missions = getMissions(event.season);
    const clean = sanitizeResponses(missions, raw);
    responses = clean;
    result = scoreRound(missions, clean);
  }
  const unit = extra ? { unit: extra.scoring.unit, decimals: extra.scoring.decimals } : {};
  return { result, responses, tiebreak, format, unit };
}

/** Carrega evento, quem está na mesa e o estado completo; aplica as regras de envio. */
async function loadForMesa(eventId: string) {
  const event = await getEventById(eventId);
  if (!event) throw new UserError("Evento não encontrado.");
  if (event.status !== "live") {
    throw new UserError(
      event.status === "draft"
        ? "O evento ainda não começou. Peça à organização para colocá-lo ao vivo."
        : "O evento foi encerrado. Notas não podem mais ser lançadas.",
    );
  }
  const scorer = await getScorer(event);
  if (!scorer) throw new UserError("Sua sessão da mesa expirou ou o código foi desativado. Entre de novo.");
  const snap = await getSnapshot(event.id, "staff", event.revision);
  if (!snap) throw new UserError("Evento não encontrado.");
  // Pausa vale para voluntários; a organização logada continua podendo lançar.
  if (snap.settings.submissionsPaused && scorer.via === "code")
    throw new UserError("A organização pausou os envios. Aguarde a liberação para enviar.");
  return { event, scorer, snap };
}

/**
 * Lançamento pela mesa (voluntário com código ou membro logado).
 * A nota é recalculada aqui a partir das respostas, e a restrição única
 * (equipe, rodada) no banco impede notas duplicadas mesmo com duas mesas
 * enviando no mesmo segundo.
 */
export async function submitScore(
  eventId: string,
  input: { teamId: string; roundId: string; responses: unknown; teamConfirmed?: boolean },
) {
  return run(async () => {
    const { event, scorer, snap } = await loadForMesa(eventId);
    const team = snap.teams.find((t) => t.id === input.teamId);
    const round = snap.rounds.find((r) => r.id === input.roundId);
    if (!team || !round) throw new UserError("Equipe ou rodada inválida.");

    const allowed = availableRoundsForTeam(team.id, snap.teams, snap.rounds, snap.scores, snap.settings, scorer.allowedRoundIds);
    if (!allowed.some((r) => r.id === round.id)) {
      const already = snap.scores.some((s) => s.teamId === team.id && s.roundId === round.id);
      const restricted = scorer.allowedRoundIds?.length && !scorer.allowedRoundIds.includes(round.id);
      throw new UserError(
        already
          ? `${team.name} já foi avaliada em ${round.name}.`
          : restricted
            ? `Esta mesa não avalia ${round.name}.`
            : `${round.name} não está liberado para ${team.name} agora.`,
      );
    }
    if (snap.settings.requireTeamConfirmation && !input.teamConfirmed)
      throw new UserError("Peça para a equipe conferir a súmula e marque a confirmação antes de enviar.");

    const { result, responses, tiebreak, format, unit } = await evaluate(event, round, input.responses);
    // Com aprovação ligada, só admin/dono lança direto; o resto entra pendente.
    const pending = snap.settings.requireApproval && !(scorer.role === "admin" || scorer.role === "owner");

    const db = await getDb();
    const inserted = await db
      .insert(scores)
      .values({
        eventId: event.id,
        teamId: team.id,
        roundId: round.id,
        points: result.points,
        tiebreak,
        responses: responses as never,
        extras: result.extras,
        submittedBy: scorer.by,
        submittedByLabel: scorer.label,
        status: pending ? "pending" : "approved",
        confirmedByTeam: Boolean(input.teamConfirmed),
      })
      .onConflictDoNothing({ target: [scores.teamId, scores.roundId] })
      .returning({ id: scores.id });

    if (!inserted.length) throw new UserError(`${team.name} já foi avaliada em ${round.name} (outra mesa enviou antes).`);

    await db.insert(activity).values({
      eventId: event.id,
      kind: pending ? "score_pending" : "score",
      payload: { team: team.name, round: round.name, points: result.points, by: scorer.label, ...unit },
    });

    nudge(event.id);
    revalidatePath(`/hub/${event.id}`, "layout");
    return {
      points: result.points,
      label: formatScore(result.points, format),
      team: team.name,
      round: round.name,
      gp: result.extras.gp?.label ?? null,
      pending,
    };
  });
}

/* ------------------------------------------- correção pelo voluntário */

async function loadOwnScore(eventId: string, teamId: string, roundId: string) {
  const ctx = await loadForMesa(eventId);
  const minutes = ctx.snap.settings.refereeEditWindowMin;
  if (!minutes) throw new UserError("A organização não liberou correções pela mesa.");
  const db = await getDb();
  const [row] = await db
    .select()
    .from(scores)
    .where(and(eq(scores.eventId, eventId), eq(scores.teamId, teamId), eq(scores.roundId, roundId)))
    .limit(1);
  if (!row) throw new UserError("Nota não encontrada.");
  if (row.submittedBy !== ctx.scorer.by) throw new UserError("Você só pode corrigir notas lançadas por esta mesa.");
  if (Date.now() - row.createdAt.getTime() > minutes * 60_000)
    throw new UserError(`O prazo de ${minutes} min para corrigir esta nota acabou. Fale com a organização.`);
  if (ctx.snap.settings.requireApproval && row.status === "approved" && row.reviewedBy)
    throw new UserError("Esta nota já foi aprovada pela organização.");
  return { ...ctx, row };
}

/** Respostas de uma nota desta mesa, para reabrir a súmula. */
export async function getMyScore(eventId: string, teamId: string, roundId: string) {
  return run(async () => {
    const { row } = await loadOwnScore(eventId, teamId, roundId);
    return { responses: row.responses, points: row.points, createdAt: row.createdAt.toISOString() };
  });
}

export async function refereeAmendScore(
  eventId: string,
  input: { teamId: string; roundId: string; responses: unknown; teamConfirmed?: boolean },
) {
  return run(async () => {
    const { event, scorer, snap, row } = await loadOwnScore(eventId, input.teamId, input.roundId);
    const team = snap.teams.find((t) => t.id === input.teamId)!;
    const round = snap.rounds.find((r) => r.id === input.roundId)!;
    if (snap.settings.requireTeamConfirmation && !input.teamConfirmed)
      throw new UserError("Peça para a equipe conferir a súmula e marque a confirmação antes de enviar.");
    const { result, responses, tiebreak, format, unit } = await evaluate(event, round, input.responses);
    const pending = snap.settings.requireApproval && !(scorer.role === "admin" || scorer.role === "owner");
    const db = await getDb();
    await db
      .update(scores)
      .set({
        points: result.points,
        tiebreak,
        responses: responses as never,
        extras: result.extras,
        status: pending ? "pending" : "approved",
        confirmedByTeam: Boolean(input.teamConfirmed),
        updatedAt: new Date(),
      })
      .where(eq(scores.id, row.id));
    await db.insert(activity).values({
      eventId: event.id,
      kind: pending ? "score_pending" : "score_edit",
      payload: { team: team.name, round: round.name, points: result.points, previous: row.points, by: scorer.label, ...unit },
    });
    nudge(event.id);
    revalidatePath(`/hub/${event.id}`, "layout");
    return { points: result.points, label: formatScore(result.points, format), team: team.name, round: round.name, gp: null, pending };
  });
}

export async function refereeVoidScore(eventId: string, teamId: string, roundId: string) {
  return run(async () => {
    const { event, scorer, snap, row } = await loadOwnScore(eventId, teamId, roundId);
    const db = await getDb();
    await db.delete(scores).where(eq(scores.id, row.id));
    await db.insert(activity).values({
      eventId: event.id,
      kind: "score_void",
      payload: {
        team: snap.teams.find((t) => t.id === teamId)?.name,
        round: snap.rounds.find((r) => r.id === roundId)?.name,
        previous: row.points,
        by: scorer.label,
      },
    });
    nudge(event.id);
    revalidatePath(`/hub/${event.id}`, "layout");
    return null;
  });
}

/* ------------------------------------------------ aprovação (hub) */

export async function approveScores(eventId: string, keys: { teamId: string; roundId: string }[] | "all") {
  return run(async () => {
    const { userId } = await requireScoreEditor(eventId);
    const db = await getDb();
    const pending = await db
      .select({ id: scores.id, teamId: scores.teamId, roundId: scores.roundId, points: scores.points, team: teams.name, round: rounds.name })
      .from(scores)
      .innerJoin(teams, eq(teams.id, scores.teamId))
      .innerJoin(rounds, eq(rounds.id, scores.roundId))
      .where(and(eq(scores.eventId, eventId), eq(scores.status, "pending")));
    const chosen = keys === "all" ? pending : pending.filter((p) => keys.some((k) => k.teamId === p.teamId && k.roundId === p.roundId));
    for (const p of chosen) {
      await db.update(scores).set({ status: "approved", reviewedBy: userId, updatedAt: new Date() }).where(eq(scores.id, p.id));
      // Só agora a nota vira pública (e o telão comemora).
      await db.insert(activity).values({ eventId, kind: "score", payload: { team: p.team, round: p.round, points: p.points, by: "Aprovada" } });
    }
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return { approved: chosen.length };
  });
}

export async function rejectScore(eventId: string, teamId: string, roundId: string) {
  return run(async () => {
    await requireScoreEditor(eventId);
    const db = await getDb();
    const [row] = await db
      .select({ id: scores.id, points: scores.points, team: teams.name, round: rounds.name })
      .from(scores)
      .innerJoin(teams, eq(teams.id, scores.teamId))
      .innerJoin(rounds, eq(rounds.id, scores.roundId))
      .where(and(eq(scores.eventId, eventId), eq(scores.teamId, teamId), eq(scores.roundId, roundId), eq(scores.status, "pending")))
      .limit(1);
    if (!row) throw new UserError("Nota pendente não encontrada.");
    await db.delete(scores).where(eq(scores.id, row.id));
    await db.insert(activity).values({ eventId, kind: "score_rejected", payload: { team: row.team, round: row.round, previous: row.points, by: "Organização" } });
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/** Correção manual pela organização (ex.: revisão de súmula). */
export async function adminSetScore(eventId: string, teamId: string, roundId: string, rawPoints: number) {
  return run(async () => {
    const { userId } = await requireScoreEditor(eventId);
    const points = Math.round(Number(rawPoints) * 100) / 100;
    if (!Number.isFinite(points) || points < 0 || points > 1_000_000) throw new UserError("Nota inválida.");

    const db = await getDb();
    const [team] = await db.select().from(teams).where(and(eq(teams.id, teamId), eq(teams.eventId, eventId))).limit(1);
    const [round] = await db.select().from(rounds).where(and(eq(rounds.id, roundId), eq(rounds.eventId, eventId))).limit(1);
    if (!team || !round) throw new UserError("Equipe ou rodada inválida.");

    const [previous] = await db
      .select({ points: scores.points })
      .from(scores)
      .where(and(eq(scores.teamId, teamId), eq(scores.roundId, roundId)))
      .limit(1);

    await db
      .insert(scores)
      .values({ eventId, teamId, roundId, points, submittedBy: userId, submittedByLabel: "Organização (manual)" })
      .onConflictDoUpdate({
        target: [scores.teamId, scores.roundId],
        set: { points, submittedBy: userId, submittedByLabel: "Organização (manual)", status: "approved", reviewedBy: userId, updatedAt: new Date() },
      });

    await db.insert(activity).values({
      eventId,
      kind: previous ? "score_edit" : "score",
      payload: { team: team.name, round: round.name, points, previous: previous?.points, by: "Organização" },
    });
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/** Apaga a nota para a mesa poder avaliar de novo. */
export async function deleteScore(eventId: string, teamId: string, roundId: string) {
  return run(async () => {
    await requireScoreEditor(eventId);
    const db = await getDb();
    const [row] = await db
      .select({ points: scores.points, team: teams.name, round: rounds.name })
      .from(scores)
      .innerJoin(teams, eq(teams.id, scores.teamId))
      .innerJoin(rounds, eq(rounds.id, scores.roundId))
      .where(and(eq(scores.eventId, eventId), eq(scores.teamId, teamId), eq(scores.roundId, roundId)))
      .limit(1);
    if (!row) return null;
    await db.delete(scores).where(and(eq(scores.teamId, teamId), eq(scores.roundId, roundId)));
    await db.insert(activity).values({
      eventId,
      kind: "score_void",
      payload: { team: row.team, round: row.round, previous: row.points, by: "Organização" },
    });
    nudge(eventId);
    revalidatePath(`/hub/${eventId}`, "layout");
    return null;
  });
}

/** Detalhe de uma nota (respostas por missão) para auditoria no hub. */
export async function getScoreDetail(eventId: string, teamId: string, roundId: string) {
  return run(async () => {
    await requireEventRole(eventId, "scorer");
    const db = await getDb();
    const [row] = await db
      .select()
      .from(scores)
      .where(and(eq(scores.eventId, eventId), eq(scores.teamId, teamId), eq(scores.roundId, roundId)))
      .limit(1);
    if (!row) throw new UserError("Nota não encontrada.");
    return {
      points: row.points,
      responses: row.responses,
      extras: row.extras,
      by: row.submittedByLabel,
      at: row.updatedAt.toISOString(),
    };
  });
}
