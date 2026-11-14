import { Crown, Lock } from "lucide-react";
import type { PlayoffSlot, PlayoffState } from "@/lib/ranking";
import { FLL_FORMAT, formatValue, type ScoreFormat } from "@/lib/format";

/**
 * Chave de playoffs. Usa variáveis CSS do telão (--tv-*) quando existem e
 * cai para as cores do tema do site no hub.
 */
export function Bracket({ playoffs, dense = false, f = FLL_FORMAT }: { playoffs: PlayoffState; dense?: boolean; f?: ScoreFormat }) {
  const { semifinal, final, champion, semifinalRound, finalRound } = playoffs;
  const hasSemis = semifinal.length > 0 || (playoffs.phase === "semifinal" && !!semifinalRound);

  return (
    <div className={`grid items-center gap-6 ${hasSemis ? "md:grid-cols-[1fr_1fr_auto]" : "md:grid-cols-[1fr_auto]"}`}>
      {hasSemis && (
        <Column title={semifinalRound?.name ?? "Semifinal"} dense={dense}>
          {semifinal.length ? semifinal.map((s) => <Slot key={s.team.id} slot={s} dense={dense} f={f} />) : <Pending n={4} />}
        </Column>
      )}
      <Column title={finalRound?.name ?? "Final"} dense={dense}>
        {final.length ? final.map((s) => <Slot key={s.team.id} slot={s} dense={dense} f={f} winner={champion?.id === s.team.id} />) : <Pending n={2} />}
      </Column>
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <span
          className={`grid ${dense ? "size-16" : "size-24"} place-items-center rounded-tl-3xl rounded-br-3xl`}
          style={{ background: "var(--tv-accent, var(--color-accent))", color: "var(--tv-bg, var(--color-accent-content))" }}
        >
          <Crown size={dense ? 30 : 44} />
        </span>
        <p className="font-mono text-[11px] font-bold tracking-[0.2em] opacity-60">CAMPEÃ</p>
        <p className={`${dense ? "text-lg" : "text-3xl"} max-w-[14ch] font-black leading-tight`}>{champion ? champion.name : "?"}</p>
      </div>
    </div>
  );
}

function Column({ title, children, dense }: { title: string; children: React.ReactNode; dense: boolean }) {
  return (
    <div>
      <p className={`mb-3 font-mono font-bold tracking-[0.2em] opacity-60 ${dense ? "text-[10px]" : "text-xs"}`}>{title.toUpperCase()}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Slot({ slot, dense, winner, f }: { slot: PlayoffSlot; dense: boolean; winner?: boolean; f: ScoreFormat }) {
  const scored = slot.points !== undefined;
  return (
    <div
      className={`flex items-center gap-3 rounded-tl-xl rounded-br-xl border ${dense ? "px-3 py-2" : "px-5 py-4"} ${
        winner ? "border-transparent" : "border-current/15"
      }`}
      style={
        winner
          ? { background: "var(--tv-accent, var(--color-accent))", color: "var(--tv-bg, var(--color-accent-content))" }
          : { background: "color-mix(in oklab, currentColor 6%, transparent)" }
      }
    >
      <span className="font-mono text-xs font-bold opacity-60">#{slot.seed}</span>
      <span className={`flex-1 truncate font-bold ${dense ? "text-sm" : "text-xl"}`}>{slot.team.name}</span>
      <span className={`font-mono font-bold tabular-nums ${dense ? "text-base" : "text-2xl"}`}>
        {!scored ? "—" : slot.points === null ? <Lock size={16} className="inline opacity-60" /> : formatValue(slot.points as number, f)}
      </span>
    </div>
  );
}

function Pending({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-tl-xl rounded-br-xl border border-dashed border-current/20 px-5 py-4 text-sm opacity-50">
          A definir
        </div>
      ))}
    </>
  );
}
