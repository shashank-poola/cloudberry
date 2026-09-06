"use client"

import { createContext, useContext } from "react"

export type DashboardProfile = {
  displayName: string
  email: string | null
  avatarUrl: string | null
  authProvider: string | null
}

const DashboardProfileContext = createContext<DashboardProfile | null>(null)

export function DashboardProfileProvider({
  profile,
  children,
}: {
  profile: DashboardProfile
  children: React.ReactNode
}) {
  return (
    <DashboardProfileContext.Provider value={profile}>
      {children}
    </DashboardProfileContext.Provider>
  )
}

export function useDashboardProfile() {
  const profile = useContext(DashboardProfileContext)
  if (!profile) {
    throw new Error("DashboardProfileProvider is required")
  }

  return profile
}
