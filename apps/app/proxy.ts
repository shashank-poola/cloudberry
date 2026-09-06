import { NextResponse, type NextRequest } from "next/server"
import { updateSupabaseSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request)

  const pathname = request.nextUrl.pathname
  const requiresDashboardAuth =
    pathname === "/" ||
    pathname.startsWith("/c/") ||
    pathname === "/computer" ||
    pathname === "/cloudpedia" ||
    pathname === "/integrations" ||
    pathname === "/settings"

  if (!user && requiresDashboardAuth) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/signup"
    redirectUrl.search = ""
    redirectUrl.searchParams.set("error", "auth_required")

    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
