"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { addTeams, deleteTeam, updateTeam } from "@/app/actions/teams";
import { cornerBtn, EmptyState, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";

type Team = { id: string; name: string; number: string | null; organization: string | null; scores: number };

export function TeamsManager({ eventId, teams }: { eventId: string; teams: Team[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await addTeams(eventId, text);
      if (!r.ok) return addToast(r.error, "error");
      setText("");
      addToast(
        `${r.data.added} equipe(s) adicionada(s)${r.data.skipped ? ` · ${r.data.skipped} ignorada(s) por repetição` : ""}.`,
        "success",
      );
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
      <Panel kicker="/ ADICIONAR" title="Colar lista de equipes">
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            placeholder={"Uma por linha. Exemplos:\nRobôs do Sertão\n12345 - Mecatrônicos\n54321; LEGOlândia; Escola Estadual X"}
            className="textarea textarea-bordered w-full font-mono text-sm leading-6"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-base-content/55">Número e escola são opcionais. Nomes repetidos são ignorados.</p>
            <button className={`btn btn-primary ${cornerBtn}`} disabled={pending || !lines}>
              {pending ? <span className="loading loading-spinner loading-sm" /> : <Plus size={16} />}
              Adicionar {lines > 0 && lines}
            </button>
          </div>
        </form>
      </Panel>

      <Panel kicker={`/ ${teams.length} EQUIPES`} title="Cadastradas">
        {teams.length === 0 ? (
          <EmptyState icon={<Users size={22} />} title="Nenhuma equipe ainda" text="Cole a lista ao lado para começar." />
        ) : (
          <ul className="divide-y divide-base-300">
            {teams.map((t) => (
              <TeamRow key={t.id} eventId={eventId} team={t} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function TeamRow({ eventId, team }: { eventId: string; team: Team }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: team.name, number: team.number ?? "", organization: team.organization ?? "" });
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const save = () =>
    start(async () => {
      const r = await updateTeam(eventId, team.id, form);
      if (!r.ok) return addToast(r.error, "error");
      setEditing(false);
    });

  const remove = async () => {
    const ok = await confirm({
      title: `Remover ${team.name}?`,
      message: team.scores ? `As ${team.scores} nota(s) desta equipe também serão apagadas.` : "A equipe some do telão na hora.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (ok === false) return;
    start(async () => {
      const r = await deleteTeam(eventId, team.id);
      if (!r.ok) addToast(r.error, "error");
    });
  };

  if (editing) {
    return (
      <li className="grid gap-2 py-3 sm:grid-cols-[90px_1fr_1fr_auto]">
        <input className="input input-bordered input-sm" placeholder="Nº" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
        <input className="input input-bordered input-sm" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input input-bordered input-sm" placeholder="Escola / organização" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
        <div className="flex gap-1">
          <button type="button" className="btn btn-sm btn-primary btn-square" onClick={save} disabled={pending} aria-label="Salvar">
            <Check size={15} />
          </button>
          <button type="button" className="btn btn-sm btn-ghost btn-square" onClick={() => setEditing(false)} aria-label="Cancelar">
            <X size={15} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`flex items-center gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}>
      <span className="grid h-8 min-w-12 place-items-center rounded-tl-md rounded-br-md bg-base-200 px-2 font-mono text-xs font-bold">
        {team.number ?? "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{team.name}</p>
        {team.organization && <p className="truncate text-xs text-base-content/55">{team.organization}</p>}
      </div>
      <span className="font-mono text-xs text-base-content/45">{team.scores} nota(s)</span>
      <button type="button" className="btn btn-ghost btn-sm btn-square" onClick={() => setEditing(true)} aria-label={`Editar ${team.name}`}>
        <Pencil size={15} />
      </button>
      <button type="button" className="btn btn-ghost btn-sm btn-square text-error" onClick={remove} aria-label={`Remover ${team.name}`}>
        <Trash2 size={15} />
      </button>
    </li>
  );
}
