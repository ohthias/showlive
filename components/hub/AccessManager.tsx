"use client";

import { useState, useTransition } from "react";
import { Clock, KeyRound, MailPlus, Plus, RefreshCw, ShieldCheck, Trash2, Tv, UserRound } from "lucide-react";
import {
  addRefereeCode,
  deleteRefereeCode,
  setRefereeCodeRounds,
  inviteMember,
  removeMember,
  rotateRefereeCode,
  setRefereeCodeActive,
  updateMemberRole,
} from "@/app/actions/access";
import { regeneratePublicCode } from "@/app/actions/events";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { CopyChip } from "./CopyChip";

type Code = { id: string; code: string | null; label: string; active: boolean; lastUsedAt: string | null; allowedRoundIds: string[] | null };
type Member = { id: string; email: string; name: string | null; role: "owner" | "admin" | "scorer"; status: "active" | "pending"; isMe: boolean };

const ROLE = {
  owner: { label: "Dono", hint: "Tudo, inclusive apagar o evento" },
  admin: { label: "Admin", hint: "Configura o evento, equipes, notas e acessos" },
  scorer: { label: "Apurador", hint: "Abre a mesa e acompanha o evento" },
} as const;

const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

export function AccessManager({
  eventId,
  publicCode,
  live,
  site,
  codes,
  members,
  rounds,
}: {
  eventId: string;
  publicCode: string | null;
  live: boolean;
  rounds: { id: string; name: string }[];
  site: string;
  codes: Code[];
  members: Member[];
}) {
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "scorer">("admin");

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error");
      else if (success) addToast(success, "success");
    });

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
              <b>Evento ao vivo — códigos ativos.</b> Eles foram gerados quando o evento entrou no ar e deixam de funcionar assim que ele
              voltar para preparação ou for encerrado. Na próxima ativação, códigos novos são gerados.
            </>
          ) : (
            <>
              <b>Evento fora do ar — nenhum código ativo.</b> Os códigos do telão e das mesas são gerados no momento em que você colocar o
              evento <b>Ao vivo</b>, e só funcionam enquanto ele estiver ativo. Aqui você já pode preparar as mesas e a equipe.
            </>
          )}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel kicker="/ PÚBLICO" title="Código do evento" action={<Tv size={16} className="text-base-content/40" />}>
          <p className="text-sm text-base-content/65">Abre o telão. Pode ir no slide de abertura, no QR do cartaz, no grupo das equipes.</p>
          {publicCode ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <CopyChip value={publicCode} className="text-xl" />
              <CopyChip label="LINK" value={`${site}/e/${publicCode}`} display={`${site.replace(/^https?:\/\//, "")}/e/${publicCode}`} />
            </div>
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 rounded-tl-lg rounded-br-lg bg-base-200 px-3 py-2 font-mono text-sm tracking-[0.3em] text-base-content/40">
              ······ <span className="font-sans text-xs tracking-normal">gerado ao ficar ao vivo</span>
            </p>
          )}
          {publicCode && <button
            type="button"
            className="btn btn-ghost btn-sm mt-4"
            disabled={pending}
            onClick={async () => {
              const ok = await confirm({
                title: "Trocar o código do evento?",
                message: "Links e telões abertos com o código antigo param de funcionar. Use se o código vazou para um evento fechado.",
                confirmLabel: "Trocar código",
                danger: true,
              });
              if (ok !== false) act(() => regeneratePublicCode(eventId), "Novo código gerado.");
            }}
          >
            <RefreshCw size={14} /> Gerar outro código
          </button>}
        </Panel>

        <Panel kicker="/ ARBITRAGEM" title="Mesas de arbitragem" action={<KeyRound size={16} className="text-base-content/40" />}>
          <p className="text-sm text-base-content/65">
            Um código por mesa deixa o histórico mais claro (&quot;Mesa 2 · Ana&quot;). Com o evento ao vivo, desative ou troque um código a qualquer momento: quem entrou com ele perde o acesso na hora.
          </p>
          <ul className="mt-4 divide-y divide-base-300">
            {codes.map((c) => (
              <li key={c.id} className={`py-2.5 ${c.active ? "" : "opacity-55"}`}>
                <div className="flex flex-wrap items-center gap-3">
                <span className="w-20 truncate text-sm font-medium">{c.label}</span>
                {c.code ? (
                  <CopyChip value={c.code} />
                ) : (
                  <span className="rounded-tl-lg rounded-br-lg bg-base-200 px-3 py-1.5 font-mono text-sm tracking-[0.3em] text-base-content/35">······</span>
                )}
                <span className="hidden items-center gap-1 text-xs text-base-content/50 sm:inline-flex">
                  <Clock size={12} /> {c.lastUsedAt ? fmt.format(new Date(c.lastUsedAt)) : "nunca usado"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm toggle-success"
                    checked={c.active}
                    disabled={pending}
                    onChange={() => act(() => setRefereeCodeActive(eventId, c.id, !c.active))}
                    aria-label={c.active ? "Desativar" : "Ativar"}
                  />
                  <button type="button" className="btn btn-ghost btn-xs btn-square" title="Trocar código" disabled={pending || !live} onClick={() => act(() => rotateRefereeCode(eventId, c.id), "Código trocado.")}>
                    <RefreshCw size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square text-error"
                    title="Apagar"
                    disabled={pending}
                    onClick={async () => {
                      if ((await confirm({ title: `Apagar o código da ${c.label}?`, confirmLabel: "Apagar", danger: true })) !== false)
                        act(() => deleteRefereeCode(eventId, c.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                </div>
                <MesaRounds eventId={eventId} code={c} rounds={rounds} />
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => addRefereeCode(eventId, label), "Código criado.");
              setLabel("");
            }}
          >
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`Mesa ${codes.length + 1}`} maxLength={30} className="input input-bordered input-sm flex-1" />
            <button className={`btn btn-sm btn-secondary ${cornerBtn}`} disabled={pending}>
              <Plus size={14} /> Nova mesa
            </button>
          </form>
        </Panel>
      </div>

      <Panel kicker="/ HUB DE ADMINS" title="Equipe de organização" action={<ShieldCheck size={16} className="text-base-content/40" />}>
        <p className="text-sm text-base-content/65">
          Convide pelo e-mail da conta RoboStage. Se a pessoa ainda não tem conta, o convite fica pendente e vira acesso no primeiro login dela no ShowLive.
        </p>
        <form
          className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await inviteMember(eventId, email, role);
              if (!r.ok) return addToast(r.error, "error");
              setEmail("");
              addToast(r.data.pending ? "Convite pendente: a pessoa ganha acesso ao entrar com esse e-mail." : "Acesso liberado.", "success", 5000);
            });
          }}
        >
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="input input-bordered input-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "scorer")} className="select select-bordered select-sm">
            <option value="admin">Admin</option>
            <option value="scorer">Apurador</option>
          </select>
          <button className={`btn btn-sm btn-primary ${cornerBtn}`} disabled={pending}>
            <MailPlus size={14} /> Convidar
          </button>
        </form>

        <ul className="mt-5 divide-y divide-base-300">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="grid size-9 place-items-center rounded-tl-lg rounded-br-lg bg-base-200">
                <UserRound size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name ?? m.email} {m.isMe && <span className="text-base-content/45">(você)</span>}
                </p>
                <p className="truncate text-xs text-base-content/55">
                  {m.email} {m.status === "pending" && <span className="ml-1 font-semibold text-warning">· pendente</span>}
                </p>
              </div>
              {m.role === "owner" ? (
                <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-primary">DONO</span>
              ) : (
                <>
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) => act(() => updateMemberRole(eventId, m.id, e.target.value as "admin" | "scorer"))}
                    className="select select-ghost select-xs"
                    title={ROLE[m.role].hint}
                  >
                    <option value="admin">Admin</option>
                    <option value="scorer">Apurador</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square text-error"
                    disabled={pending}
                    aria-label="Remover"
                    onClick={async () => {
                      if ((await confirm({ title: `Remover ${m.name ?? m.email}?`, confirmLabel: "Remover", danger: true })) !== false)
                        act(() => removeMember(eventId, m.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-2 text-xs text-base-content/55 sm:grid-cols-3">
          {Object.values(ROLE).map((r) => (
            <div key={r.label}>
              <dt className="font-bold text-base-content/70">{r.label}</dt>
              <dd>{r.hint}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}

/** Rodadas que a mesa pode avaliar (nenhuma marcada = todas). */
function MesaRounds({ eventId, code, rounds }: { eventId: string; code: Code; rounds: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const selected = new Set(code.allowedRoundIds ?? []);
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    start(async () => {
      const r = await setRefereeCodeRounds(eventId, code.id, [...next]);
      if (!r.ok) addToast(r.error, "error");
    });
  };
  if (rounds.length < 2) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[5.75rem]">
      <span className="text-[11px] text-base-content/50">{selected.size ? "Só avalia:" : "Avalia todas as rodadas · restringir:"}</span>
      {rounds.map((r) => (
        <button
          key={r.id}
          type="button"
          disabled={pending}
          onClick={() => toggle(r.id)}
          className={`btn btn-xs ${selected.has(r.id) ? "btn-secondary" : "btn-ghost border-base-300 font-normal"}`}
        >
          {r.name}
        </button>
      ))}
    </div>
  );
}
