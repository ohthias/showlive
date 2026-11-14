"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, Lock, Search } from "lucide-react";
import { EmptyState } from "@/components/ui/brand";
import type { JudgingSessionStatus } from "@/lib/rubric-types";
import { LocalTime, SessionStatusPill } from "./shared";

type Session = {
  id: string;
  teamName: string;
  teamNumber: string | null;
  teamOrg: string | null;
  startsAt: string | null;
  durationMin: number;
  status: JudgingSessionStatus;
  sent: number;
};

/** Fila da sala: próxima equipe em destaque, depois a lista completa. */
export function BancaHome({ roomName, locked, rubrics, sessions }: { roomName: string; locked: boolean; rubrics: { id: string; name: string }[]; sessions: Session[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  // Outros avaliadores podem estar enviando fichas: atualiza a fila a cada 30 s.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  const next = sessions.find((s) => s.status === "in_progress") ?? sessions.find((s) => s.status === "scheduled");
  const term = q.trim().toLowerCase();
  const list = term ? sessions.filter((s) => `${s.teamNumber ?? ""} ${s.teamName} ${s.teamOrg ?? ""}`.toLowerCase().includes(term)) : sessions;
  const done = sessions.filter((s) => s.status === "done").length;

  return (
    <div className="space-y-5 pb-16">
      {locked && (
        <div className="flex items-center gap-2 rounded-tl-xl rounded-br-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <Lock size={16} /> A organização travou as avaliações. Você ainda pode consultar as fichas.
        </div>
      )}

      <div>
        <p className="kicker">/ {roomName.toUpperCase()}</p>
        <h1 className="text-2xl font-bold tracking-tight">Equipes desta sala</h1>
        <p className="mt-1 text-sm text-base-content/60">
          {done} de {sessions.length} concluída(s) · rubricas: {rubrics.map((r) => r.name).join(", ") || "nenhuma configurada"}
        </p>
      </div>

      {next && (
        <Link
          href={`/banca/${next.id}`}
          className="group flex items-center gap-4 rounded-tl-3xl rounded-br-3xl border-2 border-base-content bg-base-100 p-5 shadow-[6px_6px_0_0_var(--color-primary)] transition hover:-translate-y-0.5"
        >
          <div className="min-w-0 flex-1">
            <p className="kicker">{next.status === "in_progress" ? "/ EM AVALIAÇÃO" : "/ PRÓXIMA EQUIPE"}</p>
            <p className="truncate text-2xl font-bold">
              {next.teamNumber && <span className="mr-2 font-mono text-base-content/50">#{next.teamNumber}</span>}
              {next.teamName}
            </p>
            <p className="text-sm text-base-content/60">
              <LocalTime iso={next.startsAt} fallback="sem horário" /> · {next.durationMin} min · {next.sent}/{rubrics.length} fichas
            </p>
          </div>
          <ArrowRight size={28} className="shrink-0 transition group-hover:translate-x-1" />
        </Link>
      )}

      {sessions.length === 0 ? (
        <EmptyState icon={<CalendarClock size={22} />} title="Nenhuma equipe agendada nesta sala" text="Peça à organização para gerar o cronograma." />
      ) : (
        <>
          <label className="input input-bordered flex items-center gap-2">
            <Search size={16} className="text-base-content/50" />
            <input className="grow" placeholder="Buscar equipe" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="divide-y divide-base-300 rounded-tl-2xl rounded-br-2xl border border-base-300 bg-base-100">
            {list.map((s) => (
              <li key={s.id}>
                <Link href={`/banca/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-base-200/60">
                  <span className="w-14 shrink-0 font-mono text-sm font-bold">
                    <LocalTime iso={s.startsAt} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {s.teamNumber && <span className="mr-1.5 font-mono text-xs text-base-content/50">#{s.teamNumber}</span>}
                      {s.teamName}
                    </span>
                    {s.teamOrg && <span className="block truncate text-xs text-base-content/55">{s.teamOrg}</span>}
                  </span>
                  <span className="font-mono text-xs text-base-content/55">
                    {s.sent}/{rubrics.length}
                  </span>
                  <SessionStatusPill status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
