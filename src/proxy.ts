import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

/** Protège toute l'app par mot de passe. Le cron et les routes internes Workflow ont leur propre secret. */
export async function proxy(request: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    // En production, pas de mot de passe = pas d'accès. En local, l'application reste ouverte.
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "APP_PASSWORD manquant" }, { status: 503 });
    return NextResponse.next();
  }
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await sessionToken(expected))) return NextResponse.next();
  // Scripts et intégrations : le secret du cron donne accès aux routes API.
  const cronSecret = process.env.CRON_SECRET;
  if (request.nextUrl.pathname.startsWith("/api/") && cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`) {
    return NextResponse.next();
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/cron|_next/static|_next/image|favicon.ico|\\.well-known/workflow/).*)"],
};
