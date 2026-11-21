"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Blocks, LayoutTemplate, ListChecks, Map, Minus, Plus, Radio, Ruler, Scale, Sparkles, Swords, Timer, Trophy } from "lucide-react";
import { createEvent, type CreateEventInput } from "@/app/actions/events";
import { cornerBtn } from "@/components/ui/brand";
import { ToolButton, ToolDialog } from "@/components/stage";
import { useToast } from "@/components/ui/Toast";
import { CHALLENGE_PRESETS, CHALLENGE_TYPES, type ChallengeType } from "@/lib/competition/challenge";
import { SEASONS } from "@/lib/competition/missions";
import { ALLIANCE_PRESETS } from "@/lib/competition/alliance-presets";
import type { UserPrefs } from "@/lib/auth/prefs";

type Tpl = { id: string; name: string; type: string; alliance?: boolean };
type Source = NonNullable<CreateEventInput["source"]>;
const ICON = { missions: ListChecks, time: Timer, judged: Scale, measure: Ruler } as const;

export function CreateEventButton({ big = false, prefs, templates = [] }: { big?: boolean; prefs?: UserPrefs; templates?: Tpl[] }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const router = useRouter();
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<CreateEventInput["format"]>(prefs?.defaultFormat ?? "fll");
  const [season, setSeason] = useState<string>(prefs?.defaultSeason ?? SEASONS[0].id);
  const customTemplates = templates.filter((t) => !t.alliance);
  const allianceTemplates = templates.filter((t) => t.alliance);
  const [source, setSource] = useState<Source>(
    customTemplates[0] ? { kind: "template", id: customTemplates[0].id } : { kind: "preset", id: CHALLENGE_PRESETS[0].id },
  );
  const [allianceSource, setAllianceSource] = useState<Source>({ kind: "alliance-preset", id: ALLIANCE_PRESETS[0].id });
  const [rounds, setRounds] = useState(prefs?.defaultRounds ?? 3);
  const [pending, start] = useTransition();

  const isSel = (s: Source) => JSON.stringify(s) === JSON.stringify(source);
  const pick = (s: Source, label?: string) => {
    setSource(s);
    if (label && !name.trim()) setName(label);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createEvent({
        name,
        format,
        season,
        source: format === "custom" ? source : format === "alliance" ? allianceSource : undefined,
        roundCount: rounds,
      });
      if (!r.ok) return addToast(r.error, "error");
      setOpen(false);
      if (r.data.format === "custom") {
        addToast("Evento criado! Revise o desafio e cadastre as equipes.", "success");
        router.push(`/hub/${r.data.id}/desafio`);
      } else if (r.data.format === "alliance") {
        addToast("Evento criado! Cadastre as equipes e gere as partidas.", "success");
        router.push(`/hub/${r.data.id}/equipes`);
      } else if (r.data.format === "obr") {
        addToast("Evento criado! Agora monte as 3 arenas da competição.", "success");
        router.push(`/hub/${r.data.id}/arenas`);
      } else {
        addToast("Evento criado! Agora cadastre as equipes.", "success");
        router.push(`/hub/${r.data.id}/equipes`);
      }
    });
  };

  const card = (active: boolean) =>
    `cursor-pointer rounded-tl-xl rounded-br-xl border-2 p-3 text-left transition ${
      active ? "border-primary bg-primary/5" : "border-base-300 hover:border-base-content/30"
    }`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`btn btn-primary ${big ? "btn-lg" : ""} ${cornerBtn}`}>
        <Plus size={18} /> Novo evento
      </button>

      {mounted &&
        createPortal(
          <div data-texture="off" className="stage-tool">
            <ToolDialog
              open={open}
              onClose={() => setOpen(false)}
              size="lg"
              title="Criar evento"
              description="Os códigos de acesso são gerados quando o evento ficar ao vivo."
              footer={
                <>
                  <ToolButton variant="ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </ToolButton>
                  <ToolButton
                    type="submit"
                    form="create-event"
                    variant="primary"
                    icon={<Radio />}
                    disabled={pending || name.trim().length < 3}
                  >
                    {pending && <span className="loading loading-spinner loading-xs" />} Criar evento
                  </ToolButton>
                </>
              }
            >
              <form id="create-event" onSubmit={submit}>
                <div className="space-y-5 py-2">
                  <label className="block">
                    <span className="text-sm font-medium">Nome do evento</span>
                    <input
                      autoFocus
                      required
                      minLength={3}
                      maxLength={80}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex.: Torneio Interno 2026"
                      className="input input-bordered mt-1 w-full"
                    />
                  </label>

                  <fieldset>
                    <legend className="text-sm font-medium">Formato</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" className={card(format === "fll")} onClick={() => setFormat("fll")}>
                        <Trophy size={18} className="text-primary" />
                        <span className="mt-1 block font-bold">FLL Challenge</span>
                        <span className="text-xs text-base-content/55">Missões e regras oficiais da temporada</span>
                      </button>
                      <button type="button" className={card(format === "fll_fe")} onClick={() => setFormat("fll_fe")}>
                        <Blocks size={18} className="text-accent" />
                        <span className="mt-1 block font-bold">FLL Future Edition</span>
                        <span className="text-xs text-base-content/55">BioGlow · kits Computer Science & AI</span>
                      </button>
                      <button type="button" className={card(format === "obr")} onClick={() => setFormat("obr")}>
                        <Map size={18} className="text-info" />
                        <span className="mt-1 block font-bold">OBR Resgate</span>
                        <span className="text-xs text-base-content/55">3 arenas, soma das 2 melhores + extras</span>
                      </button>
                      <button type="button" className={card(format === "custom")} onClick={() => setFormat("custom")}>
                        <Sparkles size={18} className="text-secondary" />
                        <span className="mt-1 block font-bold">Desafio personalizado</span>
                        <span className="text-xs text-base-content/55">Você define tipo, objetivo, regras e pontos</span>
                      </button>
                      <button type="button" className={`${card(format === "alliance")} col-span-2`} onClick={() => setFormat("alliance")}>
                        <Swords size={18} className="text-error" />
                        <span className="mt-1 block font-bold">Alianças · FTC e similares</span>
                        <span className="text-xs text-base-content/55">
                          Partidas vermelha × azul ou cooperativas, RP, vitórias e desempates
                        </span>
                      </button>
                    </div>
                  </fieldset>

                  {format === "alliance" ? (
                    <fieldset className="space-y-4">
                      <legend className="text-sm font-medium">Modelo de partida</legend>
                      {allianceTemplates.length > 0 && (
                        <div>
                          <p className="kicker mb-2 flex items-center gap-1.5">
                            <LayoutTemplate size={12} /> Meus templates de alianças
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {allianceTemplates.slice(0, 6).map((t) => {
                              const sel = allianceSource.kind === "template" && allianceSource.id === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={card(sel)}
                                  onClick={() => {
                                    setAllianceSource({ kind: "template", id: t.id });
                                    if (!name.trim()) setName(t.name);
                                  }}
                                >
                                  <span className="flex items-center gap-2 font-bold">
                                    <Swords size={15} /> <span className="truncate">{t.name}</span>
                                  </span>
                                  <span className="text-xs text-base-content/55">Template salvo</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ALLIANCE_PRESETS.map((p) => {
                          const sel = allianceSource.kind === "alliance-preset" && allianceSource.id === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              className={card(sel)}
                              onClick={() => setAllianceSource({ kind: "alliance-preset", id: p.id })}
                            >
                              <span className="block font-bold">{p.label}</span>
                              <span className="font-mono text-[10px] tracking-wider text-base-content/55">{p.short.toUpperCase()}</span>
                              <span className="mt-1 block text-xs text-base-content/60">{p.description}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-base-content/55">
                        Os itens da súmula são exemplos: depois de criar, ajuste tudo no construtor (tamanho das alianças, RP, desempates,
                        pontos) e salve como template para reutilizar.
                      </p>
                    </fieldset>
                  ) : format === "obr" ? (
                    <div className="rounded-tl-xl rounded-br-xl border border-info/30 bg-info/10 p-4 text-sm">
                      <p className="font-bold">Como funciona a OBR Resgate aqui</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-base-content/70">
                        <li>
                          São criadas 3 rodadas, cada uma ligada a um modelo de arena que você monta em seguida (perigos, checkpoints,
                          Desafio Surpresa).
                        </li>
                        <li>
                          Pontuação igual ao Pontuador OBR do RoboStage; classificação pela soma das 2 maiores notas e desempate pela menor
                          soma de tempos.
                        </li>
                        <li>Se quiser, crie desafios extras com ranking próprio.</li>
                      </ul>
                    </div>
                  ) : format === "fll_fe" ? (
                    <div className="rounded-tl-xl rounded-br-xl border border-accent/40 bg-accent/10 p-4 text-sm">
                      <p className="font-bold">FLL Future Edition · BioGlow</p>
                      <p className="mt-1 text-base-content/70">
                        Missões oficiais da Future Edition com penalidades por cartões (o 3º cartão zera a partida). Partida de 2:30.
                      </p>
                    </div>
                  ) : format === "fll" ? (
                    <fieldset>
                      <legend className="text-sm font-medium">Temporada FLL</legend>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {SEASONS.map((s) => (
                          <button key={s.id} type="button" className={card(season === s.id)} onClick={() => setSeason(s.id)}>
                            <span className="block font-bold">{s.label}</span>
                            <span className="font-mono text-xs text-base-content/55">{s.year}</span>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <fieldset className="space-y-4">
                      <legend className="text-sm font-medium">Desafio</legend>
                      {customTemplates.length > 0 && (
                        <div>
                          <p className="kicker mb-2 flex items-center gap-1.5">
                            <LayoutTemplate size={12} /> Meus templates
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {customTemplates.slice(0, 6).map((t) => {
                              const I = ICON[t.type as ChallengeType] ?? ListChecks;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  className={card(isSel({ kind: "template", id: t.id }))}
                                  onClick={() => pick({ kind: "template", id: t.id })}
                                >
                                  <span className="flex items-center gap-2 font-bold">
                                    <I size={15} /> <span className="truncate">{t.name}</span>
                                  </span>
                                  <span className="text-xs text-base-content/55">{CHALLENGE_TYPES[t.type as ChallengeType]?.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="kicker mb-2">Modelos prontos</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {CHALLENGE_PRESETS.map(({ id, challenge }) => {
                            const I = ICON[challenge.type];
                            return (
                              <button
                                key={id}
                                type="button"
                                className={card(isSel({ kind: "preset", id }))}
                                onClick={() => pick({ kind: "preset", id })}
                              >
                                <span className="flex items-center gap-2 font-bold">
                                  <I size={15} /> {challenge.name}
                                </span>
                                <span className="text-xs text-base-content/55">{CHALLENGE_TYPES[challenge.type].label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="kicker mb-2">Em branco</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(CHALLENGE_TYPES) as ChallengeType[]).map((t) => {
                            const I = ICON[t];
                            const active = isSel({ kind: "blank", type: t });
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => pick({ kind: "blank", type: t })}
                                className={`btn btn-sm ${active ? "btn-neutral" : "btn-outline border-base-300"}`}
                              >
                                <I size={14} /> {CHALLENGE_TYPES[t].label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <p className="text-xs text-base-content/55">Depois de criar, você ajusta tudo no construtor de desafio.</p>
                    </fieldset>
                  )}

                  {format !== "obr" && format !== "alliance" && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Rodadas classificatórias</p>
                        <p className="text-xs text-base-content/55">Dá para renomear e mudar depois.</p>
                      </div>
                      <div className="join">
                        <button
                          type="button"
                          className="btn join-item btn-sm"
                          onClick={() => setRounds((r) => Math.max(1, r - 1))}
                          aria-label="Menos"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="join-item grid w-12 place-items-center border-y border-base-300 font-mono font-bold">
                          {rounds}
                        </span>
                        <button
                          type="button"
                          className="btn join-item btn-sm"
                          onClick={() => setRounds((r) => Math.min(8, r + 1))}
                          aria-label="Mais"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </ToolDialog>
          </div>,
          document.body,
        )}
    </>
  );
}
