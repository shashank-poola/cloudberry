import {
  IconBook2,
  IconDeviceLaptop,
  IconMessagePlus,
  IconPlugConnected,
  IconSearch,
  IconSettings,
  type TablerIcon,
} from "@tabler/icons-react"

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
  href: string | null
  icon: TablerIcon
  visibleInSidebar: boolean
}

export const dashboardNavItems: DashboardNavItem[] = [
  {
    id: "new-chat",
    label: "New Chat",
    headerLabel: "Chat",
    description: "Start a new conversation with Cloudberry.",
    href: "/",
    icon: IconMessagePlus,
    visibleInSidebar: true,
  },
  {
    id: "search",
    label: "Search",
    headerLabel: "Search",
    description: "Find answers across your conversations and connected tools.",
    href: null,
    icon: IconSearch,
    visibleInSidebar: true,
  },
  {
    id: "cloudpedia",
    label: "Cloudpedia",
    headerLabel: "Cloudpedia",
    description: "Keep your team's living company knowledge in one place.",
    href: "/cloudpedia",
    icon: IconBook2,
    visibleInSidebar: true,
  },
  {
    id: "integrations",
    label: "Plugins",
    headerLabel: "Plugins",
    description: "Connect the tools Cloudberry uses with your context.",
    href: "/integrations",
    icon: IconPlugConnected,
    visibleInSidebar: true,
  },
  {
    id: "computer",
    label: "Computer",
    headerLabel: "Computer",
    description: "Use Cloudberry's always-on cloud computer.",
    href: "/computer",
    icon: IconDeviceLaptop,
    visibleInSidebar: true,
  },
  {
    id: "settings",
    label: "Settings",
    headerLabel: "Settings",
    description: "Manage your Cloudberry account.",
    href: "/settings",
    icon: IconSettings,
    visibleInSidebar: false,
  },
]

export function getDashboardNavItem(
  section: DashboardSection
): DashboardNavItem {
  const item = dashboardNavItems.find((navItem) => navItem.id === section)

  return item ?? dashboardNavItems[0]
}

export function getDashboardSectionForPathname(pathname: string): DashboardSection {
  if (pathname === "/" || pathname.startsWith("/c/")) return "new-chat"
  if (pathname === "/computer") return "computer"
  if (pathname === "/cloudpedia") return "cloudpedia"
  if (pathname === "/integrations") return "integrations"
  if (pathname === "/settings") return "settings"
  return "new-chat"
}
