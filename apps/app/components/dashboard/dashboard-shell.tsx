"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { DashboardHeader } from "./dashboard-header"
import {
  getDashboardNavItem,
  getDashboardSectionForPathname,
  type DashboardSection,
} from "./dashboard-nav"
import {
  DashboardProfileProvider,
  type DashboardProfile,
} from "./dashboard-profile-context"
import { SearchCommand } from "./search/search-command"
import { DashboardSidebar } from "./dashboard-sidebar"

type DashboardShellProps = DashboardProfile & {
  children: React.ReactNode
}

export function DashboardShell({
  displayName,
  email,
  avatarUrl,
  authProvider,
  children,
}: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const activeSection = getDashboardSectionForPathname(pathname)
  const activeItem = getDashboardNavItem(activeSection)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsSearchOpen(true)
        setIsMobileSidebarOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [])

  function selectSection(section: DashboardSection) {
    if (section === "search") {
      setIsSearchOpen(true)
      return
    }

    const target = getDashboardNavItem(section).href
    if (target) {
      setIsSearchOpen(false)
      setIsMobileSidebarOpen(false)
      router.push(target)
    }
  }

  function toggleSidebar() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setIsSidebarCollapsed((collapsed) => !collapsed)
      return
    }

    setIsMobileSidebarOpen((open) => !open)
  }

  return (
    <DashboardProfileProvider
      profile={{ displayName, email, avatarUrl, authProvider }}
    >
      <div className="flex h-dvh min-h-0 overflow-hidden bg-[#0b0b0b] text-zinc-100">
        <DashboardSidebar
          activeSection={isSearchOpen ? "search" : activeSection}
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          isMobileOpen={isMobileSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onExpandSidebar={() => setIsSidebarCollapsed(false)}
          onOpenDocs={() => selectSection("cloudpedia")}
          onOpenSettings={() => selectSection("settings")}
          onSectionChange={selectSection}
        />

        {isMobileSidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardHeader
            activeItem={activeItem}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            onOpenComputer={() => selectSection("computer")}
          />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>

        <SearchCommand
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>
    </DashboardProfileProvider>
  )
}
