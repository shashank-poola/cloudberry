"use client"

import Image from "next/image"
import { useState } from "react"
import { createBrowserSupabaseClient } from "@/lib/supabase/supabase"

type OAuthProvider = "google" | "github"

type SignInProps = {
  errorMessage?: string
}

type Provider = {
  id: OAuthProvider
  name: string
  icon: string
}

const providers: Provider[] = [
  { id: "google", name: "Google", icon: "/google.webp" },
  { id: "github", name: "GitHub", icon: "/github.png" },
]

export function SignIn({ errorMessage }: SignInProps) {
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(
    null
  )
  const [error, setError] = useState(errorMessage ?? "")

  async function handleSignIn(provider: OAuthProvider) {
    setLoadingProvider(provider)
    setError("")

    const supabase = createBrowserSupabaseClient()
    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    })

    if (signInError || !data.url) {
      setError(signInError?.message ?? "Unable to start sign in")
      setLoadingProvider(null)
      return
    }

    window.location.assign(data.url)
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {error ? (
        <p
          className="rounded-[10px] border border-red-400/25 bg-red-400/10 px-4 py-3 text-left text-sm leading-5 text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {providers.map(({ id, name, icon }) => {
          const isLoading = loadingProvider === id

          const isGithub = id === "github"

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSignIn(id)}
              disabled={loadingProvider !== null}
              aria-busy={isLoading}
              className={`flex h-11 w-full items-center justify-center rounded-full border px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60 ${
                isGithub
                  ? "border-zinc-700 bg-transparent text-white hover:bg-white/10"
                  : "border-white bg-white text-zinc-950 hover:bg-zinc-100"
              }`}
            >
              <span className="flex items-center justify-center gap-2.5">
                <Image
                  src={icon}
                  alt=""
                  width={20}
                  height={20}
                  className={`size-5 object-contain ${
                    isGithub ? "brightness-0 invert" : ""
                  }`}
                />
                <span>
                  {isLoading ? "Redirecting..." : `Continue with ${name}`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
