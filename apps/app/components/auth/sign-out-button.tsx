"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserSupabaseClient } from "@/lib/supabase/supabase"

type SignOutButtonProps = {
  className?: string
}

const defaultButtonClassName =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"

export function SignOutButton({
  className = defaultButtonClassName,
}: SignOutButtonProps) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    setError("")

    const { error: signOutError } =
      await createBrowserSupabaseClient().auth.signOut()

    if (signOutError) {
      setError(signOutError.message)
      setIsSigningOut(false)
      return
    }

    router.replace("/signup")
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className={className}
      >
        {isSigningOut ? "Signing out..." : "Sign out"}
      </button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
