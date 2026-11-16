import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Só o hub de administração exige conta RoboStage. Telão (/e), mesa (/mesa,
 * que valida o próprio cookie) e o stream ao vivo são acessados por código.
 */
const isHub = createRouteMatcher(["/hub(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isHub(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
