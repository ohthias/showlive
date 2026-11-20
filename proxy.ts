import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Só o hub de administração exige conta RoboStage. Telão (/e), mesa (/mesa,
 * que valida o próprio cookie) e o stream ao vivo são acessados por código.
 */
const isHub = createRouteMatcher(["/hub(.*)"]);

/**
 * Navegação client-side (<Link>, router.push) e prefetch do Next buscam o
 * payload RSC via fetch. Um redirect para outro domínio (www.robostage.com.br)
 * nesse fetch é bloqueado por CORS. Além disso, o handshake do Clerk entre
 * subdomínios só acontece em requisições de documento, então um fetch RSC
 * pode chegar "deslogado" mesmo com sessão válida no domínio principal.
 */
const isRscRequest = (req: NextRequest) =>
  req.headers.get("rsc") === "1" ||
  req.headers.has("next-router-prefetch") ||
  req.nextUrl.searchParams.has("_rsc");

/** URL atual sem o parâmetro interno _rsc, para o retorno pós-login. */
const cleanReturnUrl = (req: NextRequest) => {
  const url = new URL(req.nextUrl.href);
  url.searchParams.delete("_rsc");
  return url.toString();
};

export default clerkMiddleware(
  async (auth, req) => {
    if (!isHub(req)) return;

    const { userId, redirectToSignIn } = await auth();
    if (userId) return;

    // Resposta não-RSC → o Next faz navegação completa (documento), que volta
    // aqui, executa o handshake do Clerk e só então redireciona se necessário.
    if (isRscRequest(req)) {
      return new NextResponse(null, { status: 401 });
    }

    // Usa NEXT_PUBLIC_CLERK_SIGN_IN_URL (https://www.robostage.com.br/sign-in)
    return redirectToSignIn({ returnBackUrl: cleanReturnUrl(req) });
  },
  {
    authorizedParties: [
      "https://showlive.robostage.com.br",
      "https://www.robostage.com.br",
      "https://robostage.com.br",
    ],
  },
);

export const config = {
  matcher: [
    // Ignora internos do Next.js e arquivos estáticos (por extensão).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Sempre roda para rotas de API.
    "/(api|trpc)(.*)",
  ],
};