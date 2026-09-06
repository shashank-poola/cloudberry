import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { createServerSupabaseClient } from "@/lib/supabase/supabase_server"

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signup?error=auth_required")

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  const displayName =
    profile?.display_name ??
    user.user_metadata.full_name ??
    user.user_metadata.name ??
    user.email?.split("@")[0] ??
    "Cloudberry user"

  return (
    <DashboardShell
      displayName={displayName}
      email={user.email ?? null}
      avatarUrl={profile?.avatar_url ?? user.user_metadata.avatar_url ?? null}
      authProvider={user.app_metadata.provider ?? null}
    >
      {children}
    </DashboardShell>
  )
}
