import { createClient } from "@supabase/supabase-js"

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set")
  }

  return { publishableKey, url }
}

export const createAuthenticatedSupabaseClient = (accessToken: string) => {
  const { publishableKey, url } = getSupabaseConfig()

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
