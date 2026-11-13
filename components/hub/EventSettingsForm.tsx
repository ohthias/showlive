"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, Eraser, Pencil, Plus, Save, Swords, Trash2, TriangleAlert, Users, X } from "lucide-react";
import { deleteAllTeams, deleteEvent, resetScores, updateEventBasics } from "@/app/actions/events";
import { updateSettings } from "@/app/actions/settings";
import { addRound, deleteRound, moveRound, renameRound } from "@/app/actions/teams";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import type { LiveSettings } from "@/lib/live-types";
import { SEASONS } from "@/lib/missions";
import { SettingToggle } from "./SettingToggle";
import { VolunteerAdminSettings } from "./VolunteerAdminSettings";

type Round = { id: string; name: string; kind: "qualifying" | "semifinal" | "final" | "extra"; scores: number; arena?: string | null };

export function EventSettingsForm({
  event,
  rounds,
  settings,
  teamCount,
  isOwner,
}: {
  event: { id: string; name: string; season: string; format: "fll" | "custom" | "fll_fe" | "obr"; challengeName: string | null };
  rounds: Round[];
  settings: LiveSettings;
  teamCount: number;
  isOwner: boolean;
}) {
  const [name, setName] = useState(event.name);
  const [season, setSeason] = useState(event.season);
  const [newRound, setNewRound] = useState("");
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error");
      else if (success) addToast(success, "success");
    });

  const quals = rounds.filter((r) => r.kind === "qualifying");
  const playoffRounds = rounds.filter((r) => r.kind === "semifinal" || r.kind === "final");
  const locked = event.format === "obr";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          kicker="/ EVENTO"
          title="Informações"
          action={
            <button
              type="button"
              className={`btn btn-sm btn-primary ${cornerBtn}`}
              disabled={pending || (name === event.name && season === event.season)}
              onClick={() => act(() => updateEventBasics(event.id, { name, season }), "Salvo.")}
            >
              <Save size={14} /> Salvar
            </button>
          }
        >
          <label className="block">
            <span className="text-sm font-medium">Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="input input-bordered mt-1 w-full" />
          </label>
          {event.format === "obr" || event.format === "fll_fe" ? (
            <div className="mt-4 rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3 text-sm">
              <p className="font-medium">{event.format === "obr" ? "OBR Resgate — regras oficiais" : "FLL Future Edition — regras oficiais"}</p>
              <Link href={`/hub/${event.id}/${event.format === "obr" ? "arenas" : "desafio"}`} className="link text-xs">
                {event.format === "obr" ? "Editar as 3 arenas e os desafios extras" : "Ver a súmula oficial"}
              </Link>
            </div>
          ) : event.format === "custom" ? (
            <div className="mt-4 rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3 text-sm">
              <p className="font-medium">Desafio personalizado: {event.challengeName ?? "não montado"}</p>
              <Link href={`/hub/${event.id}/desafio`} className="link text-xs">
                Abrir o construtor de desafio
              </Link>
            </div>
          ) : (
          <label className="mt-4 block">
            <span className="text-sm font-medium">Temporada (missões da mesa)</span>
            <select value={season} onChange={(e) => setSeason(e.target.value)} className="select select-bordered mt-1 w-full">
              {SEASONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {s.year}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-base-content/55">Só pode ser trocada enquanto não houver notas.</span>
          </label>
          )}
        </Panel>

        <Panel kicker="/ REGRAS" title="Classificação e mesa">
          <p className="kicker mb-2">Critério do ranking</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["best", settings.direction === "lower" ? "Melhor tentativa" : "Maior nota", "Padrão FLL. Empate: 2ª e 3ª."],
                ["best2", "2 melhores", "Padrão OBR. Empate: menor tempo."],
                ["sum", "Soma de todas", "Torneios internos."],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                disabled={pending}
                onClick={() => act(() => updateSettings(event.id, { rankingMode: id }))}
                className={`rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${
                  settings.rankingMode === id ? "border-primary bg-primary/5" : "border-base-300 hover:border-base-content/30"
                }`}
              >
                <span className="block font-bold">{label}</span>
                <span className="text-xs text-base-content/55">{hint}</span>
              </button>
            ))}
          </div>
          {(event.format === "fll" || event.format === "fll_fe") && (
            <div className="mt-4">
              <SettingToggle
                eventId={event.id}
                name="showMissionImages"
                value={settings.showMissionImages}
                label="Mesa: árbitro vê a imagem da missão"
                hint="Mostra a foto de cada missão na súmula (toque para ampliar). Desligue para uma súmula mais enxuta ou rede fraca. Vale na hora para todas as mesas."
              />
            </div>
          )}
          <div className="mt-4">
            <SettingToggle
              eventId={event.id}
              name="showOnlyCurrentRound"
              value={settings.showOnlyCurrentRound}
              label="Mesa: liberar uma rodada por vez"
              hint="O Round 2 só abre quando todas as equipes tiverem nota no Round 1."
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel kicker={`/ ${quals.length} RODADAS`} title="Rodadas classificatórias">
          <ul className="space-y-2">
            {quals.map((r, i) => (
              <RoundItem
                key={r.id}
                eventId={event.id}
                round={r}
                first={i === 0}
                last={i === quals.length - 1}
                onlyOne={quals.length === 1}
                locked={locked}
              />
            ))}
          </ul>
          {locked ? (
            <p className="mt-3 text-xs text-base-content/55">Na OBR, cada rodada usa uma das 3 arenas (Rodada 1 → 1ª arena…). Dá para renomear.</p>
          ) : (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => addRound(event.id, newRound || `Round ${quals.length + 1}`));
              setNewRound("");
            }}
          >
            <input value={newRound} onChange={(e) => setNewRound(e.target.value)} placeholder={`Round ${quals.length + 1}`} maxLength={40} className="input input-bordered input-sm flex-1" />
            <button className="btn btn-sm btn-outline" disabled={pending}>
              <Plus size={14} /> Adicionar
            </button>
          </form>
          )}
        </Panel>

        <Panel kicker="/ MATA-MATA" title="Playoffs" action={<Swords size={16} className="text-base-content/40" />}>
          <SettingToggle
            eventId={event.id}
            name="enablePlayoffs"
            value={settings.enablePlayoffs}
            label="Ativar playoffs"
            hint={`Começam sozinhos quando as classificatórias terminam. Precisa de ${settings.playoffFormat === "semifinal" ? 4 : 2}+ equipes (você tem ${teamCount}).`}
          />
          <div className={`mt-4 grid grid-cols-2 gap-2 ${settings.enablePlayoffs ? "" : "pointer-events-none opacity-50"}`}>
            {(
              [
                ["semifinal", "Semifinal + final", "Top 4 → top 2 → campeã"],
                ["final", "Final direta", "Top 2 disputam a final"],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                disabled={pending}
                onClick={() => act(() => updateSettings(event.id, { playoffFormat: id }))}
                className={`rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${
                  settings.playoffFormat === id ? "border-primary bg-primary/5" : "border-base-300 hover:border-base-content/30"
                }`}
              >
                <span className="block font-bold">{label}</span>
                <span className="text-xs text-base-content/55">{hint}</span>
              </button>
            ))}
          </div>
          {playoffRounds.length > 0 && (
            <ul className="mt-4 space-y-2">
              {playoffRounds.map((r) => (
                <RoundItem key={r.id} eventId={event.id} round={r} first last onlyOne={false} playoff />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <VolunteerAdminSettings eventId={event.id} settings={settings} />

      <section className="rounded-tl-2xl rounded-br-2xl border-2 border-error/50 bg-error/5">
        <header className="flex items-center gap-2 border-b border-error/30 px-5 py-3.5">
          <TriangleAlert size={18} className="text-error" />
          <h2 className="font-bold">Zona de perigo</h2>
        </header>
        <div className="divide-y divide-error/20">
          <Danger
            icon={<Eraser size={16} />}
            title="Zerar todas as notas"
            text="Ideal depois do ensaio. Equipes e configurações continuam."
            label="Zerar notas"
            disabled={pending}
            onClick={async () => {
              if ((await confirm({ title: "Zerar todas as notas?", message: "O telão volta para zero na hora. Não dá para desfazer.", confirmLabel: "Zerar", danger: true, typeToConfirm: "ZERAR" })) !== false)
                act(() => resetScores(event.id), "Notas zeradas.");
            }}
          />
          <Danger
            icon={<Users size={16} />}
            title="Apagar todas as equipes"
            text="Remove as equipes e as notas delas."
            label="Apagar equipes"
            disabled={pending || teamCount === 0}
            onClick={async () => {
              if ((await confirm({ title: `Apagar as ${teamCount} equipes?`, confirmLabel: "Apagar", danger: true, typeToConfirm: "APAGAR" })) !== false)
                act(() => deleteAllTeams(event.id), "Equipes apagadas.");
            }}
          />
          {isOwner && (
            <Danger
              icon={<Trash2 size={16} />}
              title="Apagar o evento"
              text="Some do hub, do telão e das mesas. Definitivo."
              label="Apagar evento"
              disabled={pending}
              onClick={async () => {
                const typed = await confirm({ title: "Apagar o evento?", confirmLabel: "Apagar para sempre", danger: true, typeToConfirm: event.name });
                if (typed === false) return;
                start(async () => {
                  const r = await deleteEvent(event.id, typed);
                  if (!r.ok) return addToast(r.error, "error");
                  router.push("/hub");
                });
              }}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Danger({ icon, title, text, label, onClick, disabled }: { icon: React.ReactNode; title: string; text: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span className="grid size-9 place-items-center rounded-tl-lg rounded-br-lg bg-error/15 text-error">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-base-content/60">{text}</p>
      </div>
      <button type="button" className="btn btn-sm btn-outline btn-error" onClick={onClick} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}

function RoundItem({
  eventId,
  round,
  first,
  last,
  onlyOne,
  playoff,
  locked,
}: {
  eventId: string;
  round: Round;
  first: boolean;
  last: boolean;
  onlyOne: boolean;
  playoff?: boolean;
  locked?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(round.name);
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error");
    });

  return (
    <li className={`flex items-center gap-2 rounded-tl-xl rounded-br-xl border border-base-300 bg-base-100 px-3 py-2 ${pending ? "opacity-50" : ""}`}>
      {playoff && <Swords size={14} className="text-primary" />}
      {editing ? (
        <form
          className="flex flex-1 gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            act(() => renameRound(eventId, round.id, name));
            setEditing(false);
          }}
        >
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="input input-bordered input-xs flex-1" />
          <button className="btn btn-xs btn-primary btn-square" aria-label="Salvar">
            <Check size={12} />
          </button>
          <button type="button" className="btn btn-xs btn-ghost btn-square" onClick={() => setEditing(false)} aria-label="Cancelar">
            <X size={12} />
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1 truncate text-sm font-medium">
            {round.name}
            {round.arena && <span className="ml-2 font-mono text-[10px] text-primary">{round.arena.toUpperCase()}</span>}
          </span>
          <span className="font-mono text-[10px] text-base-content/45">{round.scores} nota(s)</span>
          <button type="button" className="btn btn-ghost btn-xs btn-square" onClick={() => setEditing(true)} aria-label={`Renomear ${round.name}`}>
            <Pencil size={12} />
          </button>
        </>
      )}
      {!playoff && !locked && (
        <>
          <button type="button" className="btn btn-ghost btn-xs btn-square" disabled={first || pending} onClick={() => act(() => moveRound(eventId, round.id, -1))} aria-label="Subir">
            <ArrowUp size={12} />
          </button>
          <button type="button" className="btn btn-ghost btn-xs btn-square" disabled={last || pending} onClick={() => act(() => moveRound(eventId, round.id, 1))} aria-label="Descer">
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square text-error"
            disabled={onlyOne || pending}
            aria-label={`Apagar ${round.name}`}
            onClick={async () => {
              const ok = await confirm({
                title: `Apagar ${round.name}?`,
                message: round.scores ? `As ${round.scores} nota(s) desta rodada também serão apagadas.` : undefined,
                confirmLabel: "Apagar",
                danger: true,
              });
              if (ok !== false) act(() => deleteRound(eventId, round.id));
            }}
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </li>
  );
}
