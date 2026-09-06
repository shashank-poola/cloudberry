"use client"

import { useDashboardProfile } from "@/components/dashboard/dashboard-profile-context"
import { ProfileSettingsView } from "./profile-settings-view"

export function ProfileSettingsRouteView() {
  const { displayName, email, avatarUrl, authProvider } = useDashboardProfile()
  return (
    <ProfileSettingsView
      displayName={displayName}
      email={email}
      avatarUrl={avatarUrl}
      authProvider={authProvider}
    />
  )
}
