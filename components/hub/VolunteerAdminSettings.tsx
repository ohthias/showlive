"use client";

import { useState, useTransition } from "react";
import { Megaphone, PauseCircle, PlayCircle, ShieldCheck, UsersRound } from "lucide-react";
import { updateSettings } from "@/app/actions/settings";
import { cornerBtn, Panel } from "@/components/ui/brand";
import { useToast } from "@/components/ui/Toast";
import type { LiveSettings } from "@/lib/live-types";
import { SettingToggle } from "./SettingToggle";

const WINDOWS = [0, 2, 5, 10, 15, 30];

/** Regras para as mesas (voluntários) e para a equipe de organização. */
export function VolunteerAdminSettings({ eventId, settings }: { eventId: string; settings: LiveSettings }) {
  const [notice, setNotice] = useState(settings.mesaNotice ?? "");
  const [pending, start] = useTransition();
  const { addToast } = useToast();

  const save = (patch: Partial<LiveSettings>, ok?: string) =>
    start(async () => {
      const r = await updateSettings(eventId, patch);
      if (!r.ok) addToast(r.error, "error");
      else if (ok) addToast(ok, "success");
    });

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel kicker="/ VOLUNTÁRIOS" title="Regras das mesas" action={<UsersRound size={16} className="text-base-content/40" />}>
        <div
          className={`mb-4 flex flex-wrap items-center gap-3 rounded-tl-xl rounded-br-xl border-2 px-4 py-3 ${
            settings.submissionsPaused ? "border-warning bg-warning/10" : "border-base-300"
          }`}
        >
          {settings.submissionsPaused ? <PauseCircle className="text-warning" size={22} /> : <PlayCircle className="text-success" size={22} />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{settings.submissionsPaused ? "Envios pausados" : "Envios liberados"}</p>
            <p className="text-xs text-base-content/60">Para intervalos e revisões: as mesas continuam abertas, mas não enviam notas. O evento segue ao vivo.</p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ submissionsPaused: !settings.submissionsPaused })}
            className={`btn btn-sm ${cornerBtn} ${settings.submissionsPaused ? "btn-success" : "btn-warning"}`}
          >
            {settings.submissionsPaused ? "Liberar envios" : "Pausar envios"}
          </button>
        </div>

        <div className="space-y-3">
          <SettingToggle
            eventId={eventId}
            name="requireTeamConfirmation"
            value={settings.requireTeamConfirmation}
            label="Equipe confere a súmula antes do envio"
            hint="A mesa só envia depois de marcar que a equipe conferiu. Fica registrado na nota."
          />
          <SettingToggle
            eventId={eventId}
            name="volunteersControlTimer"
            value={settings.volunteersControlTimer}
            label="Voluntários controlam o cronômetro"
            hint="Desligado: a mesa só vê o tempo; start/pause ficam com a organização."
          />
          <SettingToggle
            eventId={eventId}
            name="volunteersSeeRanking"
            value={settings.volunteersSeeRanking}
            label="Mesa vê a classificação"
            hint="Mostra o ranking na tela da mesa. Desligado, o voluntário vê só as equipes pendentes."
          />

          <div className="rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3">
            <p className="text-sm font-medium">Voluntário pode corrigir a própria nota</p>
            <p className="mt-0.5 text-xs text-base-content/55">
              Durante esse tempo após o envio, a mesa pode reabrir a súmula ou apagar a nota que ela mesma lançou.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WINDOWS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={pending}
                  onClick={() => save({ refereeEditWindowMin: m })}
                  className={`btn btn-xs ${settings.refereeEditWindowMin === m ? "btn-neutral" : "btn-ghost border-base-300"}`}
                >
                  {m === 0 ? "Não pode" : `${m} min`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Megaphone size={14} /> Aviso para as mesas
            </p>
            <p className="mt-0.5 text-xs text-base-content/55">Fica fixo no topo da tela de todas as mesas (ex.: &quot;Conferir GP antes de enviar&quot;).</p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save({ mesaNotice: notice }, notice.trim() ? "Aviso publicado nas mesas." : "Aviso removido.");
              }}
            >
              <input
                value={notice}
                maxLength={200}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="Sem aviso"
                className="input input-bordered input-sm flex-1"
              />
              <button className="btn btn-sm btn-primary" disabled={pending || notice === (settings.mesaNotice ?? "")}>
                Publicar
              </button>
            </form>
          </div>
        </div>
        <p className="mt-3 text-xs text-base-content/55">Para limitar uma mesa a certas rodadas (ex.: uma mesa por arena), use Acessos.</p>
      </Panel>

      <Panel kicker="/ ADMINISTRAÇÃO" title="Controle das notas" action={<ShieldCheck size={16} className="text-base-content/40" />}>
        <div className="space-y-3">
          <SettingToggle
            eventId={eventId}
            name="requireApproval"
            value={settings.requireApproval}
            label="Aprovar notas antes do telão"
            hint="Notas das mesas entram pendentes e só aparecem (e são comemoradas) no telão depois que alguém da organização aprovar. Desligar aprova as pendentes."
          />
          <SettingToggle
            eventId={eventId}
            name="scorersCanEdit"
            value={settings.scorersCanEdit}
            label="Apuradores podem corrigir e aprovar notas"
            hint="Por padrão só admins corrigem, apagam e aprovam. Ligue para dar isso também aos apuradores."
          />
        </div>
      </Panel>
    </div>
  );
}
