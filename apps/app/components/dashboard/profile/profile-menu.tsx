import { useState } from "react"
import {
  BookOpen01Icon,
  FlipVerticalIcon,
  Logout01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
              <HugeiconsIcon
                icon={Settings01Icon}
                size={17}
                color="currentColor"
                strokeWidth={1.5}
                className="text-zinc-500"
              />
              Settings
            </button>
            <button
              type="button"
              onClick={openDocs}
              className="flex h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
            >
              <HugeiconsIcon
                icon={BookOpen01Icon}
                size={17}
                color="currentColor"
                strokeWidth={1.5}
                className="text-zinc-500"
              />
              Docs
            </button>
          </div>
          <div className="relative mt-1.5 border-t border-white/[0.08] pt-1.5">
            <HugeiconsIcon
              icon={Logout01Icon}
              size={17}
              color="currentColor"
              strokeWidth={1.5}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
            />
            <div className="[&_button]:flex [&_button]:h-9 [&_button]:w-full [&_button]:items-center [&_button]:justify-start [&_button]:rounded-xl [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-3 [&_button]:py-1.5 [&_button]:pl-9 [&_button]:text-[13px] [&_button]:font-semibold [&_button]:text-zinc-100 [&_button]:shadow-none [&_button]:transition-colors [&_button]:hover:bg-white/[0.08] [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-1 [&_button]:focus-visible:outline-white">
              <SignOutButton />
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
        <HugeiconsIcon
          icon={FlipVerticalIcon}
          size={15}
          color="currentColor"
          strokeWidth={1.5}
          className="shrink-0 text-zinc-500"
        />
      </button>
    </div>
  )
}
