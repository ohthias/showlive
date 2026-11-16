import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AnimatedBackground, cornerBtn, Logo } from "@/components/ui/brand";

export default function NotFound() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-6 text-center">
      <AnimatedBackground />
      <div>
        <Logo size="text-2xl" />
        <p className="mt-10 font-mono text-xs tracking-[0.2em] text-base-content/50">/ 404</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Evento{" "}
          <span className="inline-block -rotate-1 bg-accent px-2 italic text-accent-content">fora do ar.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base-content/65">
          Os códigos só funcionam com o evento ao vivo e mudam a cada ativação. Confira com a organização e tente de novo.
        </p>
        <Link href="/entrar" className={`btn btn-primary btn-lg mt-8 ${cornerBtn}`}>
          <KeyRound size={18} /> Digitar código
        </Link>
      </div>
    </main>
  );
}
