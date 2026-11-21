import { StatusBadge, type Status } from "@/components/stage";

const MAP: Record<"draft" | "live" | "finished", { status: Status; label: string }> = {
  draft: { status: "draft", label: "Preparação" },
  live: { status: "live", label: "Ao vivo" },
  finished: { status: "done", label: "Encerrado" },
};

/** Estado do evento com o StatusBadge da Stage UI. */
export function StatusPill({ status }: { status: keyof typeof MAP }) {
  const s = MAP[status];
  return <StatusBadge status={s.status}>{s.label}</StatusBadge>;
}
