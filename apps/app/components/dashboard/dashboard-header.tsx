import {
  IconDeviceLaptop,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react"
import type { DashboardNavItem } from "./dashboard-nav"

type DashboardHeaderProps = {
  activeItem: DashboardNavItem
  isMobileSidebarOpen: boolean
  isSidebarCollapsed: boolean
  chatTitle?: string | null
  onToggleSidebar: () => void
  onOpenComputer: () => void
}

const BREADCRUMB_TITLE_WORDS = 5

function getBreadcrumbTitle(title: string) {
  const words = title.trim().split(/\s+/)
  if (words.length <= BREADCRUMB_TITLE_WORDS) return title
  return `… ${words.slice(0, BREADCRUMB_TITLE_WORDS).join(" ")}`
}

export function DashboardHeader({
  activeItem,
  isMobileSidebarOpen,
  isSidebarCollapsed,
  chatTitle,
  onToggleSidebar,
  onOpenComputer,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.08] px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={
            isMobileSidebarOpen
              ? "Close sidebar"
              : isSidebarCollapsed
                ? "Open sidebar"
                : "Toggle sidebar"
          }
          aria-controls="cloudberry-sidebar"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="hidden lg:inline-flex">
            {isSidebarCollapsed ? (
              <IconLayoutSidebarLeftExpand size={18} stroke={2} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={18} stroke={2} />
            )}
          </span>
          <span className="inline-flex lg:hidden">
            {isMobileSidebarOpen ? (
              <IconLayoutSidebarLeftCollapse size={18} stroke={2} />
            ) : (
              <IconLayoutSidebarLeftExpand size={18} stroke={2} />
            )}
          </span>
        </button>
        <h1 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold tracking-[-0.02em] text-zinc-100">
          <span className="shrink-0">{activeItem.headerLabel}</span>
          {chatTitle ? (
            <>
              <span aria-hidden="true" className="shrink-0 text-zinc-600">
                /
              </span>
              <span
                className="min-w-0 truncate text-sm font-semibold text-zinc-100"
                title={chatTitle}
              >
                {getBreadcrumbTitle(chatTitle)}
              </span>
            </>
          ) : null}
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
        <IconDeviceLaptop size={21} stroke={2} />
      </button>
    </header>
  )
}
