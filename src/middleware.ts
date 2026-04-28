import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/auth";

/**
 * Protege /admin/* — redireciona pra /admin/login se token inválido.
 * NÃO protege /admin/login nem /api/admin/login (senão deadlock).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // públicas
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifyToken(token)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
