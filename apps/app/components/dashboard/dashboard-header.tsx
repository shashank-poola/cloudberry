import {
  LaptopMinimalIcon,
  SidebarLeft01Icon,
  SidebarRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { DashboardNavItem } from "./dashboard-nav"

type DashboardHeaderProps = {
  activeItem: DashboardNavItem
  isMobileSidebarOpen: boolean
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenComputer: () => void
}

export function DashboardHeader({
  activeItem,
  isMobileSidebarOpen,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenComputer,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          aria-controls="cloudberry-sidebar"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="hidden lg:inline-flex">
            <HugeiconsIcon
              icon={isSidebarCollapsed ? SidebarRight01Icon : SidebarLeft01Icon}
              size={18}
              color="currentColor"
              strokeWidth={1.5}
            />
          </span>
          <span className="inline-flex lg:hidden">
            <HugeiconsIcon
              icon={
                isMobileSidebarOpen ? SidebarLeft01Icon : SidebarRight01Icon
              }
              size={18}
              color="currentColor"
              strokeWidth={1.5}
            />
          </span>
        </button>
        <h1 className="truncate text-sm font-semibold tracking-[-0.02em] text-zinc-100">
          {activeItem.headerLabel}
        </h1>
      </div>

      <button
        type="button"
        onClick={onOpenComputer}
        aria-label="Open Computer"
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          activeItem.id === "computer"
            ? "bg-white/[0.1] text-zinc-100"
            : "text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200"
        }`}
      >
        <HugeiconsIcon
          icon={LaptopMinimalIcon}
          size={21}
          color="currentColor"
          strokeWidth={1.5}
        />
      </button>
    </header>
  )
}
