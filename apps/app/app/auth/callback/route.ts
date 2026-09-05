import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/supabase_server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(
      new URL("/signup?error=auth_callback_failed", requestUrl.origin)
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL("/signup?error=auth_callback_failed", requestUrl.origin)
    )
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin))
}
