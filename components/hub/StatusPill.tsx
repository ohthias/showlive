const MAP = {
  draft: { label: "Preparação", cls: "border-base-content/20 text-base-content/60" },
  live: { label: "Ao vivo", cls: "border-primary bg-primary/10 text-primary" },
  finished: { label: "Encerrado", cls: "border-success/40 bg-success/10 text-success" },
} as const;

export function StatusPill({ status }: { status: keyof typeof MAP }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-tl-md rounded-br-md border px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] ${s.cls}`}>
      {status === "live" && <span className="live-dot" />}
      {s.label.toUpperCase()}
    </span>
  );
}
