import { SignIn } from "@clerk/nextjs";
import { AnimatedBackground, Logo } from "@/components/ui/brand";

/**
 * Em produção o login acontece no RoboStage (NEXT_PUBLIC_CLERK_SIGN_IN_URL).
 * Esta página existe para desenvolvimento local e como alternativa: é a
 * mesma instância do Clerk, então a conta continua sendo a do RoboStage.
 */
export default function Page() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center gap-8 px-6 py-12">
      <AnimatedBackground />
      <div className="flex flex-col items-center gap-6">
        <Logo size="text-2xl" />
        <SignIn />
      </div>
    </main>
  );
}
