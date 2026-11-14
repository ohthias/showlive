"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  eventSettings,
  events,
  judgingRooms,
  judgingSessions,
  rubricEvaluations,
  rubrics,
  teams,
  type JudgingSessionRow,
} from "@/db/schema";
import { AccessError, requireEventRole } from "@/lib/access";
import { cleanText, run, UserError } from "@/lib/action";
import { normalizeCode } from "@/lib/codes";
import { getJudge, judgeCanEdit, judgingSettings } from "@/lib/judging";
import { clearJudgeSession, writeJudgeSession } from "@/lib/referee";
import {
  buildSchedule,
  LIMITS,
  roomRubrics,
  sanitizeComments,
  sanitizeFeedback,
  sanitizeRubric,
  sanitizeScores,
  scoreRubric,
  submitProblems,
} from "@/lib/rubric";
import { findPresetGroup } from "@/lib/rubric-presets";
import type { JudgingSessionStatus, RubricDefinition } from "@/lib/rubric-types";
import { uniqueCode } from "@/lib/unique-code";

/**
 * Avaliação por rubricas: rubricas, salas, cronograma e fichas.
 * Nada daqui chega ao telão — os resultados ficam só no hub.
 */

const refresh = (eventId: string) => {
  revalidatePath(`/hub/${eventId}`, "layout");
  revalidatePath("/banca", "layout");
};

const asError = (fn: () => RubricDefinition) => {
  try {
    return fn();
  } catch (err) {
    throw new UserError(err instanceof Error ? err.message : "Rubrica inválida.");
  }
};

/* ----------------------------------------------------------- rubricas */

/** Adiciona as rubricas de um grupo de modelos (todas, ou só as escolhidas). */
export async function addRubricPresets(eventId: string, groupId: string, presetIds?: string[]) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const group = findPresetGroup(groupId);
    if (!group) throw new UserError("Modelo não encontrado.");
    const chosen = presetIds?.length ? group.presets.filter((p) => presetIds.includes(p.id)) : group.presets;
    if (!chosen.length) throw new UserError("Modelo não encontrado.");
    const db = await getDb();
    const existing = await db.select({ name: rubrics.name, position: rubrics.position }).from(rubrics).where(eq(rubrics.eventId, eventId));
    const names = new Set(existing.map((r) => r.name.toLowerCase()));
    const fresh = chosen.filter((p) => !names.has(p.name.toLowerCase()));
    if (!fresh.length) throw new UserError(chosen.length > 1 ? "As rubricas deste modelo já estão no evento." : "Essa rubrica já está no evento.");
    if (existing.length + fresh.length > LIMITS.rubricsPerEvent) throw new UserError(`Limite de ${LIMITS.rubricsPerEvent} rubricas por evento.`);
    let pos = Math.max(0, ...existing.map((r) => r.position));
    await db.insert(rubrics).values(
      fresh.map((p) => ({
        eventId,
        name: p.name,
        description: p.description,
        definition: sanitizeRubric(p.definition),
        weight: p.weight ?? 1,
        position: ++pos,
      })),
    );
    refresh(eventId);
    return { added: fresh.length };
  });
}

export interface RubricInput {
  name: string;
  description?: string;
  weight: number;
  definition: unknown;
}

export async function saveRubric(eventId: string, rubricIdToSave: string | null, input: RubricInput) {
  return run(
    async () => {
      await requireEventRole(eventId, "admin");
      const name = cleanText(input.name, 60);
      if (name.length < 2) throw new UserError("Dê um nome à rubrica.");
      const description = cleanText(input.description, 240) || null;
      const weight = Number(input.weight);
      if (!Number.isFinite(weight) || weight < 0 || weight > 10) throw new UserError("Peso entre 0 e 10.");
      const definition = asError(() => sanitizeRubric(input.definition));
      const db = await getDb();

      if (!rubricIdToSave) {
        const existing = await db.select({ position: rubrics.position }).from(rubrics).where(eq(rubrics.eventId, eventId));
        if (existing.length >= LIMITS.rubricsPerEvent) throw new UserError(`Limite de ${LIMITS.rubricsPerEvent} rubricas por evento.`);
        const [row] = await db
          .insert(rubrics)
          .values({ eventId, name, description, weight, definition, position: Math.max(0, ...existing.map((r) => r.position)) + 1 })
          .returning({ id: rubrics.id });
        refresh(eventId);
        return { id: row.id };
      }

      const [row] = await db
        .update(rubrics)
        .set({ name, description, weight, definition, updatedAt: new Date() })
        .where(and(eq(rubrics.id, rubricIdToSave), eq(rubrics.eventId, eventId)))
        .returning({ id: rubrics.id });
      if (!row) throw new UserError("Rubrica não encontrada.");

      // A definição mudou: refaz as contas das fichas já preenchidas. Respostas
      // de critérios removidos somem; fichas enviadas que ficaram incompletas
      // voltam a rascunho para a banca completar.
      const sheets = await db.select().from(rubricEvaluations).where(eq(rubricEvaluations.rubricId, row.id));
      for (const e of sheets) {
        const scores = sanitizeScores(definition, e.scores);
        const comments = sanitizeComments(definition, e.comments);
        const s = scoreRubric(definition, scores);
        const stillOk = submitProblems(definition, scores, comments, e.feedback).length === 0;
        await db
          .update(rubricEvaluations)
          .set({ scores, comments, total: s.total, maxTotal: s.max, status: e.status === "submitted" && stillOk ? "submitted" : "draft" })
          .where(eq(rubricEvaluations.id, e.id));
      }
      refresh(eventId);
      return { id: row.id };
    },
    { unique: "Já existe uma rubrica com esse nome." },
  );
}

export async function deleteRubric(eventId: string, id: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(rubrics).where(and(eq(rubrics.id, id), eq(rubrics.eventId, eventId)));
    // Tira a rubrica das salas que a aplicavam.
    const rooms = await db.select().from(judgingRooms).where(eq(judgingRooms.eventId, eventId));
    for (const r of rooms)
      if (r.rubricIds.includes(id))
        await db.update(judgingRooms).set({ rubricIds: r.rubricIds.filter((x) => x !== id) }).where(eq(judgingRooms.id, r.id));
    refresh(eventId);
    return null;
  });
}

export async function moveRubric(eventId: string, id: string, dir: -1 | 1) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const list = await db.select({ id: rubrics.id }).from(rubrics).where(eq(rubrics.eventId, eventId)).orderBy(asc(rubrics.position), asc(rubrics.createdAt));
    const i = list.findIndex((r) => r.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return null;
    [list[i], list[j]] = [list[j], list[i]];
    for (const [pos, r] of list.entries()) await db.update(rubrics).set({ position: pos + 1 }).where(eq(rubrics.id, r.id));
    refresh(eventId);
    return null;
  });
}

/* -------------------------------------------------------------- salas */

export async function addRoom(eventId: string, rawName: string) {
  return run(
    async () => {
      const { event } = await requireEventRole(eventId, "admin");
      const db = await getDb();
      const existing = await db.select({ id: judgingRooms.id }).from(judgingRooms).where(eq(judgingRooms.eventId, eventId));
      if (existing.length >= LIMITS.roomsPerEvent) throw new UserError(`Limite de ${LIMITS.roomsPerEvent} salas.`);
      const name = cleanText(rawName, 40) || `Sala ${existing.length + 1}`;
      await db.insert(judgingRooms).values({ eventId, name, code: event.status === "live" ? await uniqueCode() : null });
      refresh(eventId);
      return null;
    },
    { unique: "Já existe uma sala com esse nome." },
  );
}

export async function updateRoom(eventId: string, roomId: string, patch: { name?: string; rubricIds?: string[]; active?: boolean }) {
  return run(
    async () => {
      await requireEventRole(eventId, "admin");
      const db = await getDb();
      const set: Partial<typeof judgingRooms.$inferInsert> = {};
      if (patch.name !== undefined) {
        const name = cleanText(patch.name, 40);
        if (name.length < 1) throw new UserError("Dê um nome à sala.");
        set.name = name;
      }
      if (patch.rubricIds !== undefined) {
        const valid = new Set((await db.select({ id: rubrics.id }).from(rubrics).where(eq(rubrics.eventId, eventId))).map((r) => r.id));
        set.rubricIds = [...new Set(patch.rubricIds)].filter((id) => valid.has(id));
      }
      if (patch.active !== undefined) set.active = !!patch.active;
      if (!Object.keys(set).length) return null;
      await db.update(judgingRooms).set(set).where(and(eq(judgingRooms.id, roomId), eq(judgingRooms.eventId, eventId)));
      refresh(eventId);
      return null;
    },
    { unique: "Já existe uma sala com esse nome." },
  );
}

export async function rotateRoomCode(eventId: string, roomId: string) {
  return run(async () => {
    const { event } = await requireEventRole(eventId, "admin");
    if (event.status !== "live") throw new UserError("Os códigos só existem com o evento ao vivo.");
    const db = await getDb();
    await db
      .update(judgingRooms)
      .set({ code: await uniqueCode(), active: true, lastUsedAt: null })
      .where(and(eq(judgingRooms.id, roomId), eq(judgingRooms.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

export async function deleteRoom(eventId: string, roomId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    // As sessões ficam sem sala (room_id = null) e as fichas são mantidas.
    await db.delete(judgingRooms).where(and(eq(judgingRooms.id, roomId), eq(judgingRooms.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

/* --------------------------------------------------------- cronograma */

const parseDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new UserError("Horário inválido.");
  return d;
};
const clampDuration = (n: unknown) => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 1 || v > 240) throw new UserError("Duração entre 1 e 240 minutos.");
  return v;
};

async function assertRoom(eventId: string, roomId: string | null | undefined) {
  if (!roomId) return null;
  const db = await getDb();
  const [r] = await db.select({ id: judgingRooms.id }).from(judgingRooms).where(and(eq(judgingRooms.id, roomId), eq(judgingRooms.eventId, eventId))).limit(1);
  if (!r) throw new UserError("Sala não encontrada.");
  return r.id;
}

export interface GenerateScheduleInput {
  startIso: string;
  durationMin: number;
  gapMin: number;
  roomIds: string[];
  order: "number" | "name" | "random";
  /** Apaga as sessões sem nenhuma ficha antes de gerar. */
  replace: boolean;
}

export async function generateSchedule(eventId: string, input: GenerateScheduleInput) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const start = parseDate(input.startIso);
    if (!start) throw new UserError("Escolha o horário de início.");
    const durationMin = clampDuration(input.durationMin);
    const gapMin = Math.max(0, Math.min(120, Math.round(Number(input.gapMin) || 0)));

    const rooms = await db.select({ id: judgingRooms.id }).from(judgingRooms).where(eq(judgingRooms.eventId, eventId)).orderBy(asc(judgingRooms.createdAt));
    const valid = new Set(rooms.map((r) => r.id));
    const roomIds = rooms.map((r) => r.id).filter((id) => input.roomIds.includes(id) && valid.has(id));
    if (!roomIds.length) throw new UserError("Escolha pelo menos uma sala.");

    if (input.replace) {
      const all = await db.select({ id: judgingSessions.id }).from(judgingSessions).where(eq(judgingSessions.eventId, eventId));
      const used = new Set(
        (await db.select({ s: rubricEvaluations.sessionId }).from(rubricEvaluations).where(eq(rubricEvaluations.eventId, eventId))).map((r) => r.s),
      );
      const free = all.map((s) => s.id).filter((id) => !used.has(id));
      if (free.length) await db.delete(judgingSessions).where(inArray(judgingSessions.id, free));
    }

    // Só equipes que ainda não têm sessão.
    const scheduled = new Set(
      (await db.select({ t: judgingSessions.teamId }).from(judgingSessions).where(eq(judgingSessions.eventId, eventId))).map((r) => r.t),
    );
    let list = (await db.select().from(teams).where(eq(teams.eventId, eventId))).filter((t) => !scheduled.has(t.id));
    if (!list.length) throw new UserError("Todas as equipes já têm horário. Marque “substituir” para refazer o cronograma.");
    if (input.order === "random") {
      list = list
        .map((t) => ({ t, k: crypto.getRandomValues(new Uint32Array(1))[0] }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.t);
    } else if (input.order === "number") {
      const n = (s: string | null) => (s && /^\d+$/.test(s) ? Number(s) : Number.POSITIVE_INFINITY);
      list.sort((a, b) => n(a.number) - n(b.number) || a.name.localeCompare(b.name, "pt-BR"));
    } else list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const slots = buildSchedule({ teamIds: list.map((t) => t.id), roomIds, startMs: start.getTime(), durationMin, gapMin });
    await db.insert(judgingSessions).values(slots.map((s) => ({ eventId, teamId: s.teamId, roomId: s.roomId, startsAt: s.startsAt, durationMin: s.durationMin })));
    refresh(eventId);
    return { created: slots.length };
  });
}

export interface SessionInput {
  teamId?: string;
  roomId: string | null;
  startIso: string | null;
  durationMin: number;
  notes?: string;
}

export async function addSession(eventId: string, input: SessionInput) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const [team] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId ?? ""), eq(teams.eventId, eventId))).limit(1);
    if (!team) throw new UserError("Escolha a equipe.");
    await db.insert(judgingSessions).values({
      eventId,
      teamId: team.id,
      roomId: await assertRoom(eventId, input.roomId),
      startsAt: parseDate(input.startIso),
      durationMin: clampDuration(input.durationMin),
      notes: cleanText(input.notes, 200) || null,
    });
    refresh(eventId);
    return null;
  });
}

export async function updateSession(eventId: string, sessionId: string, input: SessionInput) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db
      .update(judgingSessions)
      .set({
        roomId: await assertRoom(eventId, input.roomId),
        startsAt: parseDate(input.startIso),
        durationMin: clampDuration(input.durationMin),
        notes: cleanText(input.notes, 200) || null,
        updatedAt: new Date(),
      })
      .where(and(eq(judgingSessions.id, sessionId), eq(judgingSessions.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

export async function deleteSession(eventId: string, sessionId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(judgingSessions).where(and(eq(judgingSessions.id, sessionId), eq(judgingSessions.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

/** Sessão + quem está avaliando, com as checagens de sala e trava. */
async function judgeForSession(eventId: string, sessionId: string) {
  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new UserError("Evento não encontrado.");
  const judge = await getJudge(event);
  if (!judge) throw new AccessError("Sua sessão de avaliador expirou. Entre de novo com o código da sala.");
  const [session] = await db
    .select()
    .from(judgingSessions)
    .where(and(eq(judgingSessions.id, sessionId), eq(judgingSessions.eventId, eventId)))
    .limit(1);
  if (!session) throw new UserError("Sessão não encontrada.");
  if (judge.roomId && session.roomId !== judge.roomId) throw new AccessError("Esta equipe é avaliada em outra sala.");
  const { locked } = await judgingSettings(eventId);
  if (!judgeCanEdit(judge, locked)) throw new UserError("As avaliações foram travadas pela organização.");
  return { judge, session, event };
}

/** Status da sessão (chegou, ausente, concluída). Avaliadores da sala também podem. */
export async function setSessionStatus(eventId: string, sessionId: string, status: JudgingSessionStatus) {
  return run(async () => {
    if (!["scheduled", "in_progress", "done", "absent"].includes(status)) throw new UserError("Status inválido.");
    await judgeForSession(eventId, sessionId);
    const db = await getDb();
    await db.update(judgingSessions).set({ status, updatedAt: new Date() }).where(eq(judgingSessions.id, sessionId));
    refresh(eventId);
    return null;
  });
}

/* -------------------------------------------------------------- fichas */

export interface EvaluationInput {
  eventId: string;
  sessionId: string;
  rubricId: string;
  scores: unknown;
  comments: unknown;
  feedback: unknown;
  submit: boolean;
}

export async function saveEvaluation(input: EvaluationInput) {
  return run(async () => {
    const { judge, session } = await judgeForSession(input.eventId, input.sessionId);
    const db = await getDb();

    const [rubric] = await db.select().from(rubrics).where(and(eq(rubrics.id, input.rubricId), eq(rubrics.eventId, input.eventId))).limit(1);
    if (!rubric) throw new UserError("Rubrica não encontrada.");
    const room = session.roomId ? (await db.select().from(judgingRooms).where(eq(judgingRooms.id, session.roomId)).limit(1))[0] : null;
    if (!roomRubrics([{ id: rubric.id }], room?.rubricIds).length) throw new UserError("Esta rubrica não é aplicada nesta sala.");

    const def = rubric.definition;
    const scores = sanitizeScores(def, input.scores);
    const comments = sanitizeComments(def, input.comments);
    const feedback = sanitizeFeedback(input.feedback);
    if (input.submit) {
      const problems = submitProblems(def, scores, comments, feedback);
      if (problems.length) throw new UserError(problems[0].message + (problems.length > 1 ? ` (+${problems.length - 1})` : ""));
    }
    const s = scoreRubric(def, scores);
    const values = {
      scores,
      comments,
      feedback,
      total: s.total,
      maxTotal: s.max,
      status: input.submit ? ("submitted" as const) : ("draft" as const),
      submittedBy: judge.by,
      submittedByLabel: judge.label,
      updatedAt: new Date(),
    };
    await db
      .insert(rubricEvaluations)
      .values({ ...values, eventId: input.eventId, sessionId: session.id, teamId: session.teamId, rubricId: rubric.id })
      .onConflictDoUpdate({ target: [rubricEvaluations.sessionId, rubricEvaluations.rubricId], set: values });

    await syncSessionStatus(session, room?.rubricIds ?? []);
    refresh(input.eventId);
    return { total: s.total, max: s.max, percent: s.percent, status: values.status };
  });
}

/** Rascunho → "em avaliação"; todas as rubricas da sala enviadas → "concluída". */
async function syncSessionStatus(session: JudgingSessionRow, roomRubricIds: string[]) {
  if (session.status === "absent") return;
  const db = await getDb();
  const all = await db.select({ id: rubrics.id }).from(rubrics).where(eq(rubrics.eventId, session.eventId));
  const needed = roomRubrics(all, roomRubricIds).map((r) => r.id);
  const sheets = await db
    .select({ rubricId: rubricEvaluations.rubricId, status: rubricEvaluations.status })
    .from(rubricEvaluations)
    .where(eq(rubricEvaluations.sessionId, session.id));
  const sent = new Set(sheets.filter((s) => s.status === "submitted").map((s) => s.rubricId));
  const status: JudgingSessionStatus = needed.length && needed.every((id) => sent.has(id)) ? "done" : sheets.length ? "in_progress" : session.status;
  if (status !== session.status) await db.update(judgingSessions).set({ status, updatedAt: new Date() }).where(eq(judgingSessions.id, session.id));
}

/** Admin devolve uma ficha enviada para rascunho (a banca pode corrigir). */
export async function reopenEvaluation(eventId: string, evaluationId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    const [e] = await db
      .update(rubricEvaluations)
      .set({ status: "draft", updatedAt: new Date() })
      .where(and(eq(rubricEvaluations.id, evaluationId), eq(rubricEvaluations.eventId, eventId)))
      .returning({ sessionId: rubricEvaluations.sessionId });
    if (e) await db.update(judgingSessions).set({ status: "in_progress" }).where(eq(judgingSessions.id, e.sessionId));
    refresh(eventId);
    return null;
  });
}

export async function deleteEvaluation(eventId: string, evaluationId: string) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const db = await getDb();
    await db.delete(rubricEvaluations).where(and(eq(rubricEvaluations.id, evaluationId), eq(rubricEvaluations.eventId, eventId)));
    refresh(eventId);
    return null;
  });
}

/* ---------------------------------------------------------- ajustes */

export async function setJudgingSettings(
  eventId: string,
  patch: { locked?: boolean; includeRobotGame?: boolean; robotGameWeight?: number },
) {
  return run(async () => {
    await requireEventRole(eventId, "admin");
    const set: Partial<typeof eventSettings.$inferInsert> = {};
    if (patch.locked !== undefined) set.judgingLocked = !!patch.locked;
    if (patch.includeRobotGame !== undefined) set.judgingIncludeRobotGame = !!patch.includeRobotGame;
    if (patch.robotGameWeight !== undefined) {
      const w = Number(patch.robotGameWeight);
      if (!Number.isFinite(w) || w < 0 || w > 10) throw new UserError("Peso entre 0 e 10.");
      set.judgingRobotGameWeight = w;
    }
    const db = await getDb();
    await db
      .insert(eventSettings)
      .values({ eventId, ...set })
      .onConflictDoUpdate({ target: eventSettings.eventId, set: { ...set, updatedAt: new Date() } });
    refresh(eventId);
    return null;
  });
}

/* ------------------------------------------------- entrada por código */

export async function joinBanca(raw: string, rawName: string) {
  const code = normalizeCode(raw);
  const name = cleanText(rawName, 30);
  const db = await getDb();
  const [room] = await db
    .select({ id: judgingRooms.id, eventId: judgingRooms.eventId, active: judgingRooms.active, code: judgingRooms.code, status: events.status })
    .from(judgingRooms)
    .innerJoin(events, eq(events.id, judgingRooms.eventId))
    .where(eq(judgingRooms.code, code))
    .limit(1);
  if (!room?.active || !room.code || room.status !== "live")
    return { ok: false as const, error: "Código inválido, desativado ou evento fora do ar." };
  if (name.length < 2) return { ok: false as const, error: "Diga seu nome para o histórico das fichas." };
  await writeJudgeSession({ eventId: room.eventId, roomId: room.id, code: room.code, name });
  await db.update(judgingRooms).set({ lastUsedAt: new Date() }).where(eq(judgingRooms.id, room.id));
  redirect("/banca");
}

export async function leaveBanca() {
  await clearJudgeSession();
  redirect("/entrar");
}
