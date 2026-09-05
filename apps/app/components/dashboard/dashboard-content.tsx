import { ChatView } from "./chat/chat-view"
import { CloudpediaView } from "./cloudpedia/cloudpedia-view"
import { ComputerView } from "./computer/computer-view"
import { PluginsView } from "./plugins/plugins-view"
import { ProfileSettingsView } from "./profile/profile-settings-view"
import type { DashboardSection } from "./dashboard-nav"

type DashboardContentProps = {
  activeSection: DashboardSection
  displayName: string
  email: string | null
  avatarUrl: string | null
  authProvider: string | null
}

export function DashboardContent({
  activeSection,
  displayName,
  email,
  avatarUrl,
  authProvider,
}: DashboardContentProps) {
  switch (activeSection) {
    case "new-chat":
      return <ChatView displayName={displayName} />
    case "cloudpedia":
      return <CloudpediaView />
    case "integrations":
      return <PluginsView />
    case "computer":
      return <ComputerView />
    case "settings":
      return (
        <ProfileSettingsView
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          authProvider={authProvider}
        />
      )
    case "search":
      return null
  }
}
