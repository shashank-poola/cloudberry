import { useState } from "react"
import {
  IconBook2,
  IconCaretUpDown,
  IconLogout,
  IconSettings,
} from "@tabler/icons-react"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { DashboardAvatar } from "./dashboard-avatar"

type ProfileMenuProps = {
  displayName: string
  email: string | null
  avatarUrl: string | null
  isCollapsed: boolean
  onExpandSidebar: () => void
  onOpenDocs: () => void
  onOpenSettings: () => void
}

export function ProfileMenu({
  displayName,
  email,
  avatarUrl,
  isCollapsed,
  onExpandSidebar,
  onOpenDocs,
  onOpenSettings,
}: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  function openDocs() {
    setIsOpen(false)
    onOpenDocs()
  }

  function openSettings() {
    setIsOpen(false)
    onOpenSettings()
  }

  if (isCollapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t border-white/[0.08] p-2">
        <button
          type="button"
          onClick={onExpandSidebar}
          aria-label={`Open profile for ${displayName}`}
          title={displayName}
          className="group relative flex size-9 items-center justify-center rounded-2xl text-zinc-100 transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          <DashboardAvatar
            displayName={displayName}
            avatarUrl={avatarUrl}
            size="size-8"
          />
          <span className="pointer-events-none invisible absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-lg border border-white/[0.1] bg-[#1a1a1a] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-zinc-100 opacity-0 shadow-xl shadow-black/30 transition-opacity group-hover:visible group-hover:opacity-100">
            Profile
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-t border-white/[0.08] p-3">
      {isOpen ? (
        <div
          id="profile-actions"
          className="mb-3 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#151515] p-1.5 shadow-2xl shadow-black/30"
        >
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={openSettings}
              className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            >
              <IconSettings
                size={17}
                stroke={2}
                aria-hidden="true"
                className="text-zinc-500"
              />
              Settings
            </button>
            <button
              type="button"
              onClick={openDocs}
              className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            >
              <IconBook2
                size={17}
                stroke={2}
                aria-hidden="true"
                className="text-zinc-500"
              />
              Docs
            </button>
          </div>
          <div className="mt-1.5 rounded-xl transition-colors hover:bg-white/[0.08]">
            <div className="flex items-start gap-3 px-3">
              <IconLogout
                size={17}
                stroke={2}
                aria-hidden="true"
                className="mt-2 shrink-0 text-zinc-500"
              />
              <div className="min-w-0 flex-1">
                <SignOutButton
                  className="flex h-9 w-full items-center justify-start rounded-xl border-0 bg-transparent px-0 py-1.5 text-[13px] font-semibold text-zinc-100 shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="profile-actions"
        className={`flex h-11 w-full items-center gap-3 rounded-2xl border bg-[#111111] px-3 text-left shadow-lg shadow-black/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white ${
          isOpen
            ? "border-white/[0.12] bg-white/[0.1]"
            : "border-white/[0.08] bg-[#111111] hover:border-white/[0.16] hover:bg-white/[0.06]"
        }`}
      >
        <DashboardAvatar
          displayName={displayName}
          avatarUrl={avatarUrl}
          size="size-7"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-4 font-semibold text-zinc-100">
            {displayName}
          </span>
          <span className="block truncate text-[11px] leading-[14px] text-zinc-500">
            {email ?? "Cloudberry account"}
          </span>
        </span>
        <IconCaretUpDown
          size={15}
          stroke={2}
          aria-hidden="true"
          className="shrink-0 text-zinc-500"
        />
      </button>
    </div>
  )
}
