"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Check, ChevronDown, DoorOpen, ListChecks, Lock, NotebookPen, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { addSession, deleteSession, generateSchedule, updateSession } from "@/app/actions/judging";
import { cornerBtn, EmptyState, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import type { JudgingSessionStatus } from "@/lib/rubric-types";
import { fromLocalInput, LocalTime, SESSION_STATUS, SessionStatusPill, toLocalInput } from "./shared";

type Rubric = { id: string; name: string };
type Room = { id: string; name: string; rubricIds: string[]; active: boolean };
type Team = { id: string; name: string; number: string | null };
type Session = {
  id: string;
  teamId: string;
  roomId: string | null;
  startsAt: string | null;
  durationMin: number;
  status: JudgingSessionStatus;
  notes: string | null;
  teamName: string;
  teamNumber: string | null;
  sheets: { rubricId: string; status: "draft" | "submitted" }[];
};

export function ScheduleManager({
  eventId,
  isAdmin,
  locked,
  rubrics,
  rooms,
  sessions,
  teams,
}: {
  eventId: string;
  isAdmin: boolean;
  locked: boolean;
  rubrics: Rubric[];
  rooms: Room[];
  sessions: Session[];
  teams: Team[];
}) {
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<JudgingSessionStatus | "all">("all");
  const [showGen, setShowGen] = useState(sessions.length === 0);
  const [showAdd, setShowAdd] = useState(false);

  const roomName = useMemo(() => new Map(rooms.map((r) => [r.id, r.name])), [rooms]);
  const neededFor = (roomId: string | null) => {
    const room = rooms.find((r) => r.id === roomId);
    return !room || !room.rubricIds.length ? rubrics.map((r) => r.id) : room.rubricIds;
  };
  const scheduled = new Set(sessions.map((s) => s.teamId));
  const unscheduled = teams.filter((t) => !scheduled.has(t.id));

  const counts = {
    total: sessions.length,
    done: sessions.filter((s) => s.status === "done").length,
    in_progress: sessions.filter((s) => s.status === "in_progress").length,
    absent: sessions.filter((s) => s.status === "absent").length,
  };

  const visible = sessions.filter(
    (s) => (roomFilter === "all" || (roomFilter === "none" ? !s.roomId : s.roomId === roomFilter)) && (statusFilter === "all" || s.status === statusFilter),
  );

  const notReady = !rubrics.length || !rooms.length;

  return (
    <div className="space-y-6">
      {locked && (
        <div className="flex items-center gap-2 rounded-tl-xl rounded-br-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <Lock size={16} /> Avaliações travadas: só admins alteram fichas. {isAdmin && <Link href={`/hub/${eventId}/avaliacao/resultados`} className="link">Destravar em Resultados</Link>}
        </div>
      )}

      {notReady && isAdmin && (
        <Panel kicker="/ PRIMEIROS PASSOS" title="Monte a avaliação por rubricas">
          <p className="mb-4 text-sm text-base-content/65">
            As equipes são avaliadas em sessões separadas da partida — como as salas de avaliação da FLL ou a entrevista da FTC. As notas e os
            comentários ficam só aqui no hub: nada aparece no telão.
          </p>
          <ol className="grid gap-3 md:grid-cols-3">
            <Step n={1} done={rubrics.length > 0} href={`/hub/${eventId}/avaliacao/rubricas`} icon={<ListChecks size={18} />} title="Rubricas" text="Use um modelo (FLL, FTC) ou crie a sua." />
            <Step n={2} done={rooms.length > 0} href={`/hub/${eventId}/avaliacao/salas`} icon={<DoorOpen size={18} />} title="Salas" text="Cada sala aplica algumas rubricas e ganha um código para a banca." />
            <Step n={3} done={sessions.length > 0} href="#cronograma" icon={<CalendarClock size={18} />} title="Cronograma" text="Gere os horários de cada equipe nas salas." />
          </ol>
        </Panel>
      )}

      {notReady && !isAdmin && (
        <EmptyState icon={<NotebookPen size={22} />} title="Avaliação ainda não configurada" text="A organização ainda não criou as rubricas e as salas deste evento." />
      )}

      {!notReady && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Sessões" value={counts.total} hint={unscheduled.length ? `${unscheduled.length} equipe(s) sem horário` : "todas as equipes com horário"} />
            <Stat label="Concluídas" value={counts.done} />
            <Stat label="Em avaliação" value={counts.in_progress} />
            <Stat label="Ausentes" value={counts.absent} />
          </div>

          {isAdmin && (
            <div id="cronograma" className="flex flex-wrap gap-2">
              <button type="button" className={`btn btn-sm ${showGen ? "btn-neutral" : "btn-outline"}`} onClick={() => setShowGen((v) => !v)}>
                <Wand2 size={15} /> Gerar cronograma <ChevronDown size={14} className={showGen ? "rotate-180" : ""} />
              </button>
              <button type="button" className={`btn btn-sm ${showAdd ? "btn-neutral" : "btn-outline"}`} onClick={() => setShowAdd((v) => !v)}>
                <Plus size={15} /> Sessão avulsa
              </button>
            </div>
          )}

          {isAdmin && showGen && <GenerateForm eventId={eventId} rooms={rooms} hasSessions={sessions.length > 0} pendingTeams={unscheduled.length} onDone={() => setShowGen(false)} />}
          {isAdmin && showAdd && <SessionForm eventId={eventId} rooms={rooms} teams={teams} onDone={() => setShowAdd(false)} />}

          <Panel
            kicker={`/ ${visible.length} SESSÃO(ÕES)`}
            title="Cronograma"
            action={
              <div className="flex gap-2">
                <select className="select select-bordered select-sm" value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} aria-label="Filtrar por sala">
                  <option value="all">Todas as salas</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  <option value="none">Sem sala</option>
                </select>
                <select
                  className="select select-bordered select-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as JudgingSessionStatus | "all")}
                  aria-label="Filtrar por status"
                >
                  <option value="all">Todos os status</option>
                  {Object.entries(SESSION_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {visible.length === 0 ? (
              <EmptyState
                icon={<CalendarClock size={22} />}
                title={sessions.length ? "Nada com esses filtros" : "Nenhuma sessão agendada"}
                text={sessions.length ? undefined : isAdmin ? "Use “Gerar cronograma” para distribuir as equipes pelas salas." : "A organização ainda não gerou o cronograma."}
              />
            ) : (
              <ul className="divide-y divide-base-300">
                {visible.map((s) => (
                  <SessionRow
                    key={s.id}
                    eventId={eventId}
                    session={s}
                    rooms={rooms}
                    roomName={s.roomId ? (roomName.get(s.roomId) ?? "—") : "Sem sala"}
                    needed={neededFor(s.roomId)}
                    isAdmin={isAdmin}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function Step({ n, done, href, icon, title, text }: { n: number; done: boolean; href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <li>
      <Link
        href={href}
        className={`flex h-full items-start gap-3 rounded-tl-xl rounded-br-xl border-2 p-4 transition hover:-translate-y-0.5 ${
          done ? "border-success/40 bg-success/5" : "border-base-300 hover:border-base-content/40"
        }`}
      >
        <span className={`grid size-9 shrink-0 place-items-center rounded-tl-lg rounded-br-lg ${done ? "bg-success text-success-content" : "bg-base-200"}`}>
          {done ? <Check size={18} /> : icon}
        </span>
        <span>
          <span className="block text-sm font-bold">
            {n}. {title}
          </span>
          <span className="block text-xs text-base-content/60">{text}</span>
        </span>
      </Link>
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 px-4 py-3">
      <p className="kicker">{label.toUpperCase()}</p>
      <p className="font-mono text-2xl font-black">{value}</p>
      {hint && <p className="text-[11px] text-base-content/55">{hint}</p>}
    </div>
  );
}

function GenerateForm({
  eventId,
  rooms,
  hasSessions,
  pendingTeams,
  onDone,
}: {
  eventId: string;
  rooms: Room[];
  hasSessions: boolean;
  pendingTeams: number;
  onDone: () => void;
}) {
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(30);
  const [gap, setGap] = useState(10);
  const [roomIds, setRoomIds] = useState<string[]>(rooms.filter((r) => r.active).map((r) => r.id));
  const [order, setOrder] = useState<"number" | "name" | "random">("number");
  const [replace, setReplace] = useState(false);
  const [pending, startT] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const iso = fromLocalInput(start);
    if (!iso) return addToast("Escolha o horário de início.", "warning");
    if (replace) {
      const ok = await confirm({
        title: "Refazer o cronograma?",
        message: "Sessões sem nenhuma ficha preenchida serão apagadas e geradas de novo. Sessões já avaliadas são mantidas.",
        confirmLabel: "Refazer",
        danger: true,
      });
      if (ok === false) return;
    }
    startT(async () => {
      const r = await generateSchedule(eventId, { startIso: iso, durationMin: duration, gapMin: gap, roomIds, order, replace });
      if (!r.ok) return addToast(r.error, "error", 5000);
      addToast(`${r.data.created} sessão(ões) criada(s).`, "success");
      onDone();
    });
  };

  const waves = roomIds.length ? Math.ceil((replace ? Infinity : pendingTeams) / roomIds.length) : 0;

  return (
    <Panel kicker="/ GERAR" title="Distribuir equipes pelas salas">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-base-content/70">Início da 1ª sessão</span>
            <input type="datetime-local" className="input input-bordered mt-1 w-full" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-base-content/70">Duração (min)</span>
            <input type="number" min={1} max={240} className="input input-bordered mt-1 w-full" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-base-content/70">Intervalo entre sessões (min)</span>
            <input type="number" min={0} max={120} className="input input-bordered mt-1 w-full" value={gap} onChange={(e) => setGap(Number(e.target.value))} />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-base-content/70">Salas usadas</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {rooms.map((r) => {
              const on = roomIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRoomIds((ids) => (on ? ids.filter((x) => x !== r.id) : [...ids, r.id]))}
                  className={`btn btn-sm ${on ? "btn-neutral" : "btn-outline"}`}
                >
                  {on && <Check size={14} />} {r.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs font-medium text-base-content/70">Ordem das equipes</span>
            <select className="select select-bordered mt-1" value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
              <option value="number">Pelo número</option>
              <option value="name">Pelo nome</option>
              <option value="random">Sorteio</option>
            </select>
          </label>
          {hasSessions && (
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
              <input type="checkbox" className="checkbox checkbox-sm" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Substituir sessões ainda não avaliadas
            </label>
          )}
          <div className="flex-1" />
          {!replace && pendingTeams > 0 && roomIds.length > 0 && (
            <p className="pb-2 text-xs text-base-content/55">
              {pendingTeams} equipe(s) em {waves} rodada(s) de horários
            </p>
          )}
          <button className={`btn btn-primary ${cornerBtn}`} disabled={pending || !roomIds.length}>
            {pending ? <span className="loading loading-spinner loading-sm" /> : <Wand2 size={16} />} Gerar
          </button>
        </div>
      </form>
    </Panel>
  );
}

function SessionForm({
  eventId,
  rooms,
  teams,
  session,
  onDone,
}: {
  eventId: string;
  rooms: Room[];
  teams?: Team[];
  session?: Session;
  onDone: () => void;
}) {
  const [teamId, setTeamId] = useState(session?.teamId ?? "");
  const [roomId, setRoomId] = useState(session?.roomId ?? rooms[0]?.id ?? "");
  const [start, setStart] = useState(toLocalInput(session?.startsAt ?? null));
  const [duration, setDuration] = useState(session?.durationMin ?? 30);
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [pending, startT] = useTransition();
  const { addToast } = useToast();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startT(async () => {
      const input = { teamId, roomId: roomId || null, startIso: fromLocalInput(start), durationMin: duration, notes };
      const r = session ? await updateSession(eventId, session.id, input) : await addSession(eventId, input);
      if (!r.ok) return addToast(r.error, "error");
      if (!session) addToast("Sessão adicionada.", "success");
      onDone();
    });
  };

  const body = (
    <form onSubmit={submit} className={`grid items-end gap-2 ${session ? "sm:grid-cols-[1fr_1fr_90px_1fr_auto]" : "sm:grid-cols-[1.4fr_1fr_1fr_90px_auto]"}`}>
      {!session && (
        <select className="select select-bordered select-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)} required aria-label="Equipe">
          <option value="">Equipe…</option>
          {teams?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.number ? `${t.number} · ` : ""}
              {t.name}
            </option>
          ))}
        </select>
      )}
      <select className="select select-bordered select-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Sala">
        <option value="">Sem sala</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <input type="datetime-local" className="input input-bordered input-sm" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Horário" />
      <input
        type="number"
        min={1}
        max={240}
        className="input input-bordered input-sm"
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        aria-label="Duração em minutos"
      />
      {session && (
        <input className="input input-bordered input-sm" placeholder="Observação (só a organização e a banca veem)" value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
      )}
      <div className="flex gap-1">
        <button className="btn btn-sm btn-primary" disabled={pending}>
          {session ? <Check size={15} /> : <Plus size={15} />} {session ? "" : "Adicionar"}
        </button>
        {session && (
          <button type="button" className="btn btn-sm btn-ghost btn-square" onClick={onDone} aria-label="Cancelar">
            <X size={15} />
          </button>
        )}
      </div>
    </form>
  );

  return session ? body : <Panel kicker="/ AVULSA" title="Nova sessão">{body}</Panel>;
}

function SessionRow({
  eventId,
  session,
  rooms,
  roomName,
  needed,
  isAdmin,
}: {
  eventId: string;
  session: Session;
  rooms: Room[];
  roomName: string;
  needed: string[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const sent = session.sheets.filter((x) => x.status === "submitted" && needed.includes(x.rubricId)).length;

  const remove = async () => {
    const ok = await confirm({
      title: `Apagar a sessão de ${session.teamName}?`,
      message: session.sheets.length ? `As ${session.sheets.length} ficha(s) desta sessão também serão apagadas.` : undefined,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (ok === false) return;
    start(async () => {
      const r = await deleteSession(eventId, session.id);
      if (!r.ok) addToast(r.error, "error");
    });
  };

  if (editing) {
    return (
      <li className="py-3">
        <p className="mb-2 text-sm font-medium">{session.teamName}</p>
        <SessionForm eventId={eventId} rooms={rooms} session={session} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <span className="w-14 shrink-0 font-mono text-sm font-bold">
        <LocalTime iso={session.startsAt} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {session.teamNumber && <span className="mr-1.5 font-mono text-xs text-base-content/50">#{session.teamNumber}</span>}
          {session.teamName}
        </p>
        <p className="truncate text-xs text-base-content/55">
          {roomName} · {session.durationMin} min{session.notes ? ` · ${session.notes}` : ""}
        </p>
      </div>
      <span className="font-mono text-xs text-base-content/55" title="Fichas enviadas">
        {sent}/{needed.length} fichas
      </span>
      <SessionStatusPill status={session.status} />
      <Link href={`/hub/${eventId}/avaliacao/sessao/${session.id}`} className="btn btn-sm btn-outline">
        <NotebookPen size={14} /> Avaliar
      </Link>
      {isAdmin && (
        <>
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => setEditing(true)} aria-label={`Editar sessão de ${session.teamName}`}>
            <Pencil size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={remove} aria-label={`Apagar sessão de ${session.teamName}`}>
            <Trash2 size={15} />
          </button>
        </>
      )}
    </li>
  );
}
