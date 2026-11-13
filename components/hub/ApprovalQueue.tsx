"use client";

import { useTransition } from "react";
import { Check, CheckCheck, Hourglass, X } from "lucide-react";
import { approveScores, rejectScore } from "@/app/actions/scores";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import type { LiveSnapshot } from "@/lib/live-types";
import { formatScore } from "@/lib/format";

/** Notas das mesas aguardando aprovação (configuração "Aprovar notas antes do telão"). */
export function ApprovalQueue({ snapshot: s, canEdit }: { snapshot: LiveSnapshot; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const { addToast } = useToast();
  const confirm = useConfirm();
  const items = s.scores.filter((x) => x.pending).sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  if (!s.settings.requireApproval && !items.length) return null;

  const name = (id: string) => s.teams.find((t) => t.id === id)?.name ?? "?";
  const round = (id: string) => s.rounds.find((r) => r.id === id);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) addToast(r.error ?? "Erro", "error");
      else if (ok) addToast(ok, "success");
    });

  return (
    <Panel
      kicker={`/ APROVAÇÃO · ${items.length} PENDENTE(S)`}
      title="Notas aguardando aprovação"
      action={
        canEdit && items.length > 1 ? (
          <button type="button" className={`btn btn-xs btn-success ${cornerBtn}`} disabled={pending} onClick={() => act(() => approveScores(s.event.id, "all"), "Notas aprovadas.")}>
            <CheckCheck size={13} /> Aprovar todas
          </button>
        ) : (
          <Hourglass size={16} className="text-base-content/40" />
        )
      }
    >
      {!items.length ? (
        <p className="text-sm text-base-content/60">Nada pendente. Notas novas das mesas aparecem aqui antes de irem para o telão.</p>
      ) : (
        <ul className="divide-y divide-base-300">
          {items.map((x) => {
            const r = round(x.roundId);
            const f = r?.extra?.scoring ?? s.event.scoring;
            return (
              <li key={`${x.teamId}:${x.roundId}`} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {name(x.teamId)} · {r?.name}
                  </p>
                  <p className="truncate text-xs text-base-content/55">{x.by}</p>
                </div>
                <span className="font-mono font-bold tabular-nums">{x.points === null ? "—" : formatScore(x.points, f)}</span>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-xs btn-success btn-square"
                      aria-label="Aprovar"
                      disabled={pending}
                      onClick={() => act(() => approveScores(s.event.id, [{ teamId: x.teamId, roundId: x.roundId }]))}
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost btn-square text-error"
                      aria-label="Rejeitar"
                      disabled={pending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Rejeitar esta nota?",
                          message: "A nota é apagada e a equipe volta a ficar pendente nessa rodada para a mesa avaliar de novo.",
                          confirmLabel: "Rejeitar",
                          danger: true,
                        });
                        if (ok !== false) act(() => rejectScore(s.event.id, x.teamId, x.roundId));
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
