"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, ClipboardCheck, Tv } from "lucide-react";
import { joinMesa, lookupCode, type CodeLookup } from "@/app/actions/access";
import { cornerBtn } from "@/components/ui/brand";

/**
 * Um campo só para os dois tipos de código:
 *  - código do evento → abre o telão;
 *  - código da mesa   → pede o nome do voluntário e abre a mesa.
 */
export function EnterCodeForm({ initialCode = "", compact = false }: { initialCode?: string; compact?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState("");
  const [found, setFound] = useState<CodeLookup | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await lookupCode(code);
      if (!res.ok) return setError(res.error);
      if (res.data.kind === "public") return router.push(`/e/${res.data.eventCode}`);
      setFound(res.data);
    });
  };

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await joinMesa(code, name);
      if (res && !res.ok) setError(res.error);
    });
  };

  if (found?.kind === "referee") {
    return (
      <form onSubmit={submitName} className="space-y-4">
        <div className="flex items-start gap-3 rounded-tl-xl rounded-br-xl border border-secondary/30 bg-secondary/10 p-4">
          <ClipboardCheck className="mt-0.5 shrink-0 text-secondary" size={20} />
          <div className="text-sm">
            <p className="font-bold">
              {found.label} · {found.eventName}
            </p>
            <p className="text-base-content/65">Código de mesa de arbitragem. Como você se chama?</p>
          </div>
        </div>
        <input
          autoFocus
          className="input input-lg input-bordered w-full"
          placeholder="Seu nome (aparece no histórico das notas)"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <ErrorLine text={error} />}
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-lg" onClick={() => setFound(null)}>
            Voltar
          </button>
          <button className={`btn btn-secondary btn-lg flex-1 ${cornerBtn}`} disabled={pending || name.trim().length < 2}>
            {pending ? <span className="loading loading-spinner" /> : <>Abrir a mesa <ArrowRight size={18} /></>}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-2">
    <form onSubmit={submitCode} className={compact ? "flex gap-2" : "space-y-4"}>
      <label className="sr-only" htmlFor="code">
        Código do evento ou da mesa
      </label>
      <input
        id="code"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="ABC123"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
        className={`input input-bordered w-full text-center font-mono font-bold tracking-[0.35em] uppercase ${
          compact ? "input-lg text-xl" : "h-16 text-3xl"
        } ${error ? "input-error" : ""}`}
      />
      {!compact && error && <ErrorLine text={error} />}
      <button
        className={`btn btn-primary ${compact ? "btn-lg" : "btn-lg w-full"} ${cornerBtn} shadow-[4px_4px_0_0_var(--color-base-content)] transition-all hover:-translate-y-0.5`}
        disabled={pending || code.length < 6}
      >
        {pending ? <span className="loading loading-spinner" /> : compact ? <ArrowRight size={20} /> : <>Entrar <ArrowRight size={18} /></>}
      </button>
      {!compact && (
        <p className="flex items-center justify-center gap-2 text-xs text-base-content/50">
          <Tv size={13} /> Código do evento abre o telão · código da mesa abre a arbitragem
        </p>
      )}
    </form>
    {compact && error && <ErrorLine text={error} />}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-error" role="alert">
      <AlertCircle size={16} /> {text}
    </p>
  );
}
