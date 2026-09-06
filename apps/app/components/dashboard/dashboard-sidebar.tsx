import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChatHistory } from "./chat/chat-history"
import { ProfileMenu } from "./profile/profile-menu"
import { dashboardNavItems, type DashboardSection } from "./dashboard-nav"

type DashboardSidebarProps = {
  activeSection: DashboardSection
  displayName: string
  email: string | null
  avatarUrl: string | null
  isMobileOpen: boolean
  isCollapsed: boolean
  onCloseMobile: () => void
  onExpandSidebar: () => void
  onOpenDocs: () => void
  onOpenSettings: () => void
  onSectionChange: (section: DashboardSection) => void
}

export function DashboardSidebar({
  activeSection,
  displayName,
  email,
  avatarUrl,
  isMobileOpen,
  isCollapsed,
  onCloseMobile,
  onExpandSidebar,
  onOpenDocs,
  onOpenSettings,
  onSectionChange,
}: DashboardSidebarProps) {
  return (
    <aside
      id="cloudberry-sidebar"
      aria-label="Cloudberry navigation"
      className={`fixed inset-y-0 left-0 z-40 h-dvh w-63.5 -translate-x-full overflow-visible border-r border-white/8 bg-[#0c0c0c] transition-[width,transform] duration-200 ease-out lg:relative lg:block lg:translate-x-0 ${
        isMobileOpen ? "translate-x-0" : ""
      } ${isCollapsed ? "lg:w-16" : "lg:w-63.5"}`}
    >
      <div className="flex h-full min-h-0 flex-col overflow-visible">
        <div
          className={`flex h-14 shrink-0 items-center ${
            isCollapsed ? "justify-center px-0" : "px-5"
          }`}
        >
          {isCollapsed ? (
            <Image
              src="/white_cloudberry_logo.png"
              alt="Cloudberry"
              width={32}
              height={32}
              className="size-8 object-contain"
              priority
            />
          ) : (
            <div className="flex items-center gap-2.5 text-zinc-100">
              <Image
                src="/white_cloudberry_logo.png"
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain"
                priority
              />
              <span className="text-[19px] font-semibold tracking-[-0.04em]">
                cloudberry
              </span>
            </div>
          )}
        </div>

        <nav
          className={`flex min-h-0 flex-1 flex-col gap-1 py-5 ${
            isCollapsed ? "px-2" : "px-3"
          }`}
        >
          {dashboardNavItems
            .filter((item) => item.visibleInSidebar)
            .map((item) => {
              const isActive = item.id === activeSection

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSectionChange(item.id)
                    onCloseMobile()
                  }}
                  aria-label={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold tracking-[-0.02em] transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
                    isActive
                      ? "bg-white/11 text-zinc-100"
                      : "text-zinc-100 hover:bg-white/6"
                  } ${
                    isCollapsed ? "justify-center gap-0 px-0 lg:size-9" : ""
                  }`}
                >
                  <HugeiconsIcon
                    icon={item.icon}
                    size={17}
                    color="currentColor"
                    strokeWidth={1.5}
                    className={`shrink-0 transition-colors ${
                      isActive
                        ? "text-zinc-100"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  />
                  <span className={isCollapsed ? "hidden" : undefined}>
                    {item.label}
                  </span>
                  {isCollapsed ? (
                    <span className="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-2 block -translate-y-1/2 rounded-lg border border-white/10 bg-[#1a1a1a] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-zinc-100 opacity-0 shadow-xl shadow-black/30 transition-opacity group-hover:visible group-hover:opacity-100">
                      {item.label}
                    </span>
                  ) : null}
                </button>
              )
            })}

          <ChatHistory
            isCollapsed={isCollapsed}
            onCloseMobile={onCloseMobile}
          />
        </nav>

        <ProfileMenu
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          isCollapsed={isCollapsed}
          onExpandSidebar={onExpandSidebar}
          onOpenDocs={() => {
            onOpenDocs()
            onCloseMobile()
          }}
          onOpenSettings={() => {
            onOpenSettings()
            onCloseMobile()
          }}
        />
      </div>
    </aside>
  )
}
