import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import { PreferencesForm } from "@/components/hub/PreferencesForm";
import { loadPrefs } from "@/lib/hub-data";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const { userId } = await auth();
  const prefs = await loadPrefs(userId!);
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/hub" className="inline-flex items-center gap-1 text-xs text-base-content/55 hover:text-base-content">
        <ArrowLeft size={13} /> Meus eventos
      </Link>
      <p className="kicker mt-3">/ SUA CONTA</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Preferências</h1>
      <p className="mb-6 mt-2 max-w-xl text-base-content/65">
        Valem para os eventos que você criar daqui para frente e para a mesa quando você mesmo arbitra. Eventos existentes não mudam.
      </p>
      <PreferencesForm initial={prefs} />
    </main>
  );
}
