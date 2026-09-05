import Image from "next/image"
import { useState, type FormEvent } from "react"

import { DashboardAvatar } from "./dashboard-avatar"

type ProfileSettingsViewProps = {
  displayName: string
  email: string | null
  avatarUrl: string | null
  authProvider: string | null
}

type ProviderRowProps = {
  name: string
  logo: string
  connected: boolean
}

function ProviderRow({ name, logo, connected }: ProviderRowProps) {
  return (
    <div className="flex items-center gap-4 py-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.04]">
        <Image
          src={logo}
          alt=""
          width={24}
          height={24}
          className={`size-6 object-contain ${
            name === "GitHub" ? "brightness-0 invert" : ""
          }`}
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-200">{name}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {connected ? "Connected" : "Not connected"}
        </p>
      </div>
      {connected ? (
        <span className="text-xs font-medium text-zinc-600">Disconnect</span>
      ) : (
        <button
          type="button"
          className="rounded-lg border border-white/[0.14] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Connect
        </button>
      )}
    </div>
  )
}

export function ProfileSettingsView({
  displayName,
  email,
  avatarUrl,
  authProvider,
}: ProfileSettingsViewProps) {
  const [name, setName] = useState(displayName)
  const [isSaved, setIsSaved] = useState(false)
  const connectedProvider = authProvider?.toLowerCase()

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaved(true)
  }

  return (
    <section className="min-h-[calc(100dvh-3.5rem)] flex-1">
      <div className="mx-auto w-full max-w-235 px-6 py-8 sm:px-10 lg:px-12">
        <h2 className="text-2xl font-semibold tracking-[-0.045em] text-zinc-100">
          Settings
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          Your account: who you sign in as, which providers can sign you in, and
          where you&apos;re signed in right now.
        </p>

        <div className="mt-10">
          <h3 className="text-sm font-semibold text-zinc-200">Profile</h3>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <DashboardAvatar
              displayName={name || displayName}
              avatarUrl={avatarUrl}
              size="size-14"
            />
            <div className="min-w-0 flex-1">
              <form onSubmit={saveName} className="max-w-lg">
                <label
                  htmlFor="profile-name"
                  className="text-xs font-medium text-zinc-500"
                >
                  name
                </label>
                <div className="mt-1.5 flex max-w-md gap-2">
                  <input
                    id="profile-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value)
                      setIsSaved(false)
                    }}
                    className="h-9 min-w-0 flex-1 rounded-lg border border-white/[0.12] bg-transparent px-3 text-sm font-medium text-zinc-100 transition-colors outline-none placeholder:text-zinc-600 focus:border-white/[0.3]"
                  />
                  <button
                    type="submit"
                    className="h-9 rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 text-xs font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {isSaved ? "Saved" : "Save"}
                  </button>
                </div>
              </form>

              <div className="mt-5">
                <p className="text-xs font-medium text-zinc-500">email</p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {email ?? "No email provided"}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Comes from your sign-in provider and can&apos;t be edited
                  here.
                </p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-xs text-zinc-600">
            The photo follows your sign-in provider profile and refreshes on
            your next sign-in.
          </p>
        </div>

        <div className="mt-10 border-t border-white/[0.08] pt-8">
          <h3 className="text-sm font-semibold text-zinc-200">
            Sign-in methods
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Providers that can sign you in to this account. Connecting another
            provider links it to the same account by its verified email.
          </p>
          <div className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            <ProviderRow
              name="Google"
              logo="/google.webp"
              connected={connectedProvider === "google"}
            />
            <ProviderRow
              name="GitHub"
              logo="/github.png"
              connected={connectedProvider === "github"}
            />
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.08] pt-8">
          <h3 className="text-sm font-semibold text-zinc-200">Sessions</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Everywhere this account is signed in. Signing out a session takes
            effect on that device&apos;s next request.
          </p>
          <div className="mt-5 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                Current browser
                <span className="ml-1.5 text-xs font-normal text-zinc-500">
                  · this device
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">Active now</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              Active
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
