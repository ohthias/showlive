import { sql, type SQL } from "drizzle-orm";
import { generateCode } from "./codes";

/**
 * Códigos ao vivo com isolamento entre eventos.
 *
 * Problema que isto resolve: antes, o código era sorteado, conferido nas três
 * tabelas (eventos, mesas, salas) e só depois gravado. Com vários eventos
 * ficando ao vivo ao mesmo tempo, duas ativações podiam sortear o mesmo código
 * entre a conferência e a gravação — e, como cada tabela só garante unicidade
 * dentro dela, a sala de um evento e a mesa de outro podiam ficar com o mesmo
 * código. Quem digitasse esse código em /entrar caía no evento errado.
 *
 * Agora cada código é reservado em `live_codes` (chave primária = código) e
 * gravado na mesa/sala NA MESMA instrução SQL. Se outro evento reservou o
 * código primeiro, o INSERT não faz nada, o UPDATE também não, e sorteamos
 * outro. Invariante: todo código gravado em events/access_codes/judging_rooms
 * tem uma linha em live_codes apontando para aquela mesma linha.
 *
 * Não importa "server-only" para poder ser testado com PGlite; quem usa no app
 * é lib/unique-code.ts.
 */

export type LiveCodeKind = "public" | "mesa" | "room";

/** O mínimo que precisamos do cliente Drizzle (neon-http ou PGlite). */
export interface ExecDb {
  execute(query: SQL): Promise<unknown>;
}

const TABLE: Record<LiveCodeKind, { table: string; eventCol: string; extra: string }> = {
  public: { table: "events", eventCol: "id", extra: "" },
  mesa: { table: "access_codes", eventCol: "event_id", extra: ", last_used_at = NULL" },
  room: { table: "judging_rooms", eventCol: "event_id", extra: ", last_used_at = NULL" },
};

function rowsOf(res: unknown): Record<string, unknown>[] {
  const r = res as { rows?: Record<string, unknown>[] } | Record<string, unknown>[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

export class CodeTargetMissing extends Error {}

/**
 * Sorteia, reserva e grava um código novo para a linha `refId`.
 * O código antigo dessa linha (se havia) é liberado depois.
 */
export async function reserveLiveCode(
  db: ExecDb,
  target: { eventId: string; kind: LiveCodeKind; refId: string },
  gen: () => string = generateCode,
  attempts = 12,
): Promise<string> {
  const t = TABLE[target.kind];
  if (!t) throw new Error(`tipo de código inválido: ${target.kind}`);
  const table = sql.raw(t.table);
  const eventCol = sql.raw(t.eventCol);
  const extra = sql.raw(t.extra);

  for (let i = 0; i < attempts; i++) {
    const candidate = gen();
    const res = await db.execute(sql`
      WITH ins AS (
        INSERT INTO live_codes (code, event_id, kind, ref_id)
        VALUES (${candidate}, ${target.eventId}, ${target.kind}, ${target.refId})
        ON CONFLICT (code) DO NOTHING
        RETURNING code
      ), upd AS (
        UPDATE ${table} SET code = ins.code${extra}
        FROM ins
        WHERE ${table}.id = ${target.refId} AND ${table}.${eventCol} = ${target.eventId}
        RETURNING ${table}.code
      )
      SELECT (SELECT code FROM ins) AS reserved, (SELECT code FROM upd) AS applied
    `);
    const row = rowsOf(res)[0] ?? {};
    if (row.applied) {
      await releaseStale(db, target.kind, target.refId);
      return String(row.applied);
    }
    if (row.reserved) {
      // Reservou, mas a linha não existe (ou é de outro evento): desfaz.
      await releaseStale(db, target.kind, target.refId);
      throw new CodeTargetMissing("Mesa ou sala não encontrada neste evento.");
    }
    // Código já usado por outro evento (ou por este): tenta outro.
  }
  throw new Error("Não foi possível gerar um código único");
}

/**
 * Apaga as reservas da linha que não são mais o código dela (o antigo, depois
 * de trocar; todas, se ela ficou sem código ou foi apagada). Lê o código atual
 * na mesma instrução, então nunca solta o código que está em uso.
 */
export async function releaseStale(db: ExecDb, kind: LiveCodeKind, refId: string) {
  const table = sql.raw(TABLE[kind].table);
  await db.execute(sql`
    DELETE FROM live_codes
    WHERE kind = ${kind} AND ref_id = ${refId}
      AND code IS DISTINCT FROM (SELECT code FROM ${table} WHERE id = ${refId})
  `);
}

/** Evento saiu do ar: tira os códigos das linhas e depois solta as reservas. */
export async function releaseEventCodes(db: ExecDb, eventId: string) {
  await db.execute(sql`UPDATE events SET code = NULL WHERE id = ${eventId}`);
  await db.execute(sql`UPDATE access_codes SET code = NULL WHERE event_id = ${eventId}`);
  await db.execute(sql`UPDATE judging_rooms SET code = NULL WHERE event_id = ${eventId}`);
  await db.execute(sql`DELETE FROM live_codes WHERE event_id = ${eventId}`);
}

export interface ResolvedCode {
  code: string;
  kind: LiveCodeKind;
  eventId: string;
  refId: string;
}

/**
 * Para onde um código aponta. Confere a linha de destino também: só vale se
 * ela ainda tem exatamente esse código.
 */
export async function resolveLiveCode(db: ExecDb, code: string): Promise<ResolvedCode | null> {
  const res = await db.execute(sql`
    SELECT l.code, l.kind, l.event_id, l.ref_id
    FROM live_codes l
    LEFT JOIN events e ON l.kind = 'public' AND e.id = l.ref_id
    LEFT JOIN access_codes a ON l.kind = 'mesa' AND a.id = l.ref_id AND a.event_id = l.event_id
    LEFT JOIN judging_rooms r ON l.kind = 'room' AND r.id = l.ref_id AND r.event_id = l.event_id
    WHERE l.code = ${code} AND COALESCE(e.code, a.code, r.code) = l.code
    LIMIT 1
  `);
  const row = rowsOf(res)[0];
  if (!row) return null;
  return { code: String(row.code), kind: row.kind as LiveCodeKind, eventId: String(row.event_id), refId: String(row.ref_id) };
}
