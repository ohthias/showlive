"use client";

import { useState, useTransition } from "react";
import { Check, DoorOpen, KeyRound, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { addRoom, deleteRoom, rotateRoomCode, updateRoom } from "@/app/actions/judging";
import { CopyChip } from "@/components/hub/CopyChip";
import { cornerBtn, EmptyState, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { LocalTime } from "./shared";

type Rubric = { id: string; name: string };
type Room = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  rubricIds: string[];
  lastUsedAt: string | null;
  sessions: number;
};

export function RoomManager({ eventId, live, site, rubrics, rooms }: { eventId: string; live: boolean; site: string; rubrics: Rubric[]; rooms: Room[] }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const { addToast } = useToast();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addRoom(eventId, name);
      if (!r.ok) return addToast(r.error, "error");
      setName("");
    });
  };

  return (
    <div className="space-y-6">
      <div
        className={`flex items-start gap-3 rounded-tl-2xl rounded-br-2xl border-2 p-4 ${
          live ? "border-primary/40 bg-primary/5" : "border-dashed border-base-content/25 bg-base-100"
        }`}
      >
        <KeyRound size={20} className={live ? "mt-0.5 text-primary" : "mt-0.5 text-base-content/50"} />
        <p className="text-sm">
          {live ? (
            <>
              <b>Evento ao vivo — códigos das salas ativos.</b> A banca entra em <span className="font-mono">{site.replace(/^https?:\/\//, "")}/entrar</span>{" "}
              com o código da sala e vê só as equipes daquela sala. Os códigos deixam de valer quando o evento sai do ar.
            </>
          ) : (
            <>
              <b>Evento fora do ar — salas sem código.</b> Os códigos nascem quando o evento fica <b>Ao vivo</b>. Antes disso, membros do evento
              (admins e apuradores) já podem avaliar pelo hub.
            </>
          )}
        </p>
      </div>

      <Panel kicker={`/ ${rooms.length} SALA(S)`} title="Salas de avaliação">
        <form onSubmit={add} className="mb-4 flex gap-2">
          <input className="input input-bordered input-sm flex-1" placeholder={`Sala ${rooms.length + 1}`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <button className={`btn btn-sm btn-primary ${cornerBtn}`} disabled={pending}>
            <Plus size={15} /> Adicionar sala
          </button>
        </form>
        {rooms.length === 0 ? (
          <EmptyState icon={<DoorOpen size={22} />} title="Nenhuma sala" text="Crie uma sala por banca de avaliadores. Cada uma pode aplicar todas as rubricas ou só algumas." />
        ) : (
          <ul className="space-y-3">
            {rooms.map((r) => (
              <RoomRow key={r.id} eventId={eventId} room={r} rubrics={rubrics} live={live} site={site} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function RoomRow({ eventId, room, rubrics, live, site }: { eventId: string; room: Room; rubrics: Rubric[]; live: boolean; site: string }) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(room.name);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error");
    });

  const all = room.rubricIds.length === 0;
  const toggleRubric = (id: string) => {
    const current = all ? rubrics.map((r) => r.id) : room.rubricIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    if (!next.length) return addToast("A sala precisa aplicar pelo menos uma rubrica.", "warning");
    act(() => updateRoom(eventId, room.id, { rubricIds: next.length === rubrics.length ? [] : next }));
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Apagar ${room.name}?`,
      message: room.sessions ? `As ${room.sessions} sessão(ões) desta sala ficam “sem sala” (as fichas são mantidas).` : undefined,
      confirmLabel: "Apagar",
      danger: true,
    });
    if (ok !== false) act(() => deleteRoom(eventId, room.id));
  };

  return (
    <li className={`rounded-tl-xl rounded-br-xl border border-base-300 p-4 ${pending ? "opacity-60" : ""} ${room.active ? "" : "bg-base-200/50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        {editingName ? (
          <form
            className="flex flex-1 gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => updateRoom(eventId, room.id, { name }));
              setEditingName(false);
            }}
          >
            <input className="input input-bordered input-sm flex-1" autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-sm btn-primary btn-square" aria-label="Salvar nome">
              <Check size={15} />
            </button>
            <button type="button" className="btn btn-sm btn-ghost btn-square" onClick={() => setEditingName(false)} aria-label="Cancelar">
              <X size={15} />
            </button>
          </form>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-bold">
              {room.name}
              <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setEditingName(true)} aria-label={`Renomear ${room.name}`}>
                <Pencil size={13} />
              </button>
            </p>
            <p className="text-xs text-base-content/55">
              {room.sessions} sessão(ões)
              {room.lastUsedAt && (
                <>
                  {" "}
                  · último acesso <LocalTime iso={room.lastUsedAt} withDay />
                </>
              )}
            </p>
          </div>
        )}
        {live && room.code ? (
          <CopyChip label="SALA" value={`${site}/entrar?code=${room.code}`} display={room.code} className={room.active ? "" : "opacity-50"} />
        ) : (
          <span className="font-mono text-[11px] text-base-content/45">{live ? "sem código" : "código ao ficar ao vivo"}</span>
        )}
        {live && (
          <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => act(() => rotateRoomCode(eventId, room.id))} title="Trocar código" aria-label="Trocar código">
            <RefreshCw size={15} />
          </button>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" className="toggle toggle-sm toggle-primary" checked={room.active} onChange={(e) => act(() => updateRoom(eventId, room.id, { active: e.target.checked }))} />
          Ativa
        </label>
        <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={remove} aria-label={`Apagar ${room.name}`}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-3">
        <p className="mb-1.5 text-xs text-base-content/60">Rubricas aplicadas nesta sala{all && rubrics.length ? " · todas" : ""}</p>
        {rubrics.length === 0 ? (
          <p className="text-xs text-base-content/50">Crie as rubricas primeiro.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {rubrics.map((r) => {
              const on = all || room.rubricIds.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => toggleRubric(r.id)}
                  className={`btn btn-xs ${on ? "btn-neutral" : "btn-outline"}`}
                >
                  {on && <Check size={12} />} {r.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </li>
  );
}
