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
import {
  CHAT_LIST_CHANGED_EVENT,
  getChat,
} from "@/api/chat/client"

type DashboardShellProps = DashboardProfile & {
  children: React.ReactNode
}

function getChatIdFromPathname(pathname: string) {
  if (!pathname.startsWith("/c/")) return null

  const value = pathname.slice(3).split("/")[0]
  if (!value) return null

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
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
  const [chatTitle, setChatTitle] = useState<string | null>(null)
  const activeSection = getDashboardSectionForPathname(pathname)
  const activeItem = getDashboardNavItem(activeSection)

  useEffect(() => {
    const chatId = getChatIdFromPathname(pathname)
    if (!chatId) {
      const frame = window.requestAnimationFrame(() => setChatTitle(null))
      return () => window.cancelAnimationFrame(frame)
    }

    const controller = new AbortController()
    let requestVersion = 0

    const loadChatTitle = () => {
      const version = ++requestVersion
      setChatTitle(null)

      void getChat(chatId, controller.signal)
        .then((detail) => {
          if (!controller.signal.aborted && version === requestVersion) {
            setChatTitle(detail.chat.title)
          }
        })
        .catch(() => {
          if (!controller.signal.aborted && version === requestVersion) {
            setChatTitle(null)
          }
        })
    }

    const frame = window.requestAnimationFrame(loadChatTitle)
    window.addEventListener(CHAT_LIST_CHANGED_EVENT, loadChatTitle)

    return () => {
      window.cancelAnimationFrame(frame)
      controller.abort()
      window.removeEventListener(CHAT_LIST_CHANGED_EVENT, loadChatTitle)
    }
  }, [pathname])

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
      <div className="dashboard-root flex h-dvh min-h-0 overflow-hidden bg-[#0b0b0b] text-zinc-100">
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
            chatTitle={activeSection === "new-chat" ? chatTitle : null}
            isMobileSidebarOpen={isMobileSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={toggleSidebar}
            onOpenComputer={() => selectSection("computer")}
          />
          <main
            className={`dashboard-scrollbar min-h-0 flex-1 ${
              activeSection === "new-chat"
                ? "overflow-hidden"
                : "overflow-y-auto"
            }`}
          >
            {children}
          </main>
        </div>

        <SearchCommand
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
        />
      </div>
    </DashboardProfileProvider>
  )
}
