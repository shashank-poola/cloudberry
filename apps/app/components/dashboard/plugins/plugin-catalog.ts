import type {
  Integration,
  IntegrationProvider,
} from "@/api/integrations/client"

export type Plugin = {
  provider?: IntegrationProvider
  name: string
  description: string
  logo?: string
  available: boolean
}

export type IntegrationNotice = {
  message: string
  tone: "success" | "error"
}

export const plugins: Plugin[] = [
  {
    provider: "codex",
    name: "Codex",
    description: "Connect your OpenAI Codex account to this workspace.",
    logo: "/plugins/codex.png",
    available: true,
  },
  {
    provider: "github",
    name: "GitHub",
    description: "Give Cloudberry context from your repositories and issues.",
    logo: "/plugins/github.png",
    available: true,
  },
  {
    provider: "slack",
    name: "Slack",
    description: "Bring team conversations and channels into your workspace.",
    logo: "/plugins/slack.webp",
    available: true,
  },
  {
    provider: "linear",
    name: "Linear",
    description: "Keep project updates and engineering work in context.",
    logo: "/plugins/linear.webp",
    available: true,
  },
  {
    name: "Granola",
    description: "Make meeting notes available to your company brain.",
    logo: "/plugins/granola.webp",
    available: false,
  },
  {
    name: "Notion",
    description: "Connect your docs and workspace knowledge.",
    logo: "/plugins/notion.png",
    available: false,
  },
  {
    name: "Gmail",
    description: "Find and act on the inbox context you care about.",
    logo: "/plugins/gmail.webp",
    available: false,
  },
]

export const providerNames: Record<IntegrationProvider, string> = {
  codex: "Codex",
  github: "GitHub",
  slack: "Slack",
  linear: "Linear",
}

export function statusLabel(integration: Integration | undefined) {
  if (!integration || integration.status === "not_connected") {
    return "Not connected"
  }

  if (integration.status === "disabled") return "Disconnected"
  if (integration.status === "reauthorization_required") {
    return "Authorization required"
  }
  if (integration.status === "error") return "Needs attention"
  if (integration.provider === "codex") return "Connected"
  if (integration.trigger_status === "active") return "Connected"
  if (integration.trigger_status === "error") {
    return "Connected · events paused"
  }
  if (integration.trigger_status === "not_configured") {
    return "Connected · events not configured"
  }
  return "Connected · events pending"
}

export function statusClass(integration: Integration | undefined) {
  if (!integration || integration.status === "not_connected") {
    return "bg-zinc-600"
  }
  if (
    integration.status === "active" &&
    (integration.provider === "codex" ||
      integration.trigger_status === "active")
  ) {
    return "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]"
  }
  if (integration.status === "disabled") return "bg-zinc-500"
  return "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]"
}
