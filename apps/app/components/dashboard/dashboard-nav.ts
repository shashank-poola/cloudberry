import {
  AiSearch02Icon,
  ChatEdit01Icon,
  GitbookIcon,
  HierarchySquare10Icon,
  LaptopMinimalIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export type DashboardSection =
  | "new-chat"
  | "search"
  | "cloudpedia"
  | "integrations"
  | "computer"
  | "settings"

export type DashboardNavItem = {
  id: DashboardSection
  label: string
  headerLabel: string
  description: string
  icon: IconSvgElement
  visibleInSidebar: boolean
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    id: "new-chat",
    label: "New Chat",
    headerLabel: "Chat",
    description: "Start a new conversation with Cloudberry.",
    icon: ChatEdit01Icon,
    visibleInSidebar: true,
  },
  {
    id: "search",
    label: "Search",
    headerLabel: "Search",
    description: "Find answers across your conversations and connected tools.",
    icon: AiSearch02Icon,
    visibleInSidebar: true,
  },
  {
    id: "cloudpedia",
    label: "Cloudpedia",
    headerLabel: "Cloudpedia",
    description: "Keep your team's living company knowledge in one place.",
    icon: GitbookIcon,
    visibleInSidebar: true,
  },
  {
    id: "integrations",
    label: "Plugins",
    headerLabel: "Plugins",
    description: "Connect the tools Cloudberry uses with your context.",
    icon: HierarchySquare10Icon,
    visibleInSidebar: true,
  },
  {
    id: "computer",
    label: "Computer",
    headerLabel: "Computer",
    description: "Use Cloudberry's always-on cloud computer.",
    icon: LaptopMinimalIcon,
    visibleInSidebar: true,
  },
  {
    id: "settings",
    label: "Settings",
    headerLabel: "Settings",
    description: "Manage your Cloudberry account.",
    icon: Settings01Icon,
    visibleInSidebar: false,
  },
]

export function getDashboardNavItem(
  section: DashboardSection
): DashboardNavItem {
  const item = dashboardNavItems.find((navItem) => navItem.id === section)

  return item ?? dashboardNavItems[0]
}
