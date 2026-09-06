import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let supabaseAdminClient: SupabaseClient | null = null

const getServiceRoleKey = () =>
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const createAdminClient = () => {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = getServiceRoleKey()

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY must be set"
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * The admin client is intentionally server-only. Its key is read at request
 * time and is never included in a response or sent to a browser client.
 */
export const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseAdminClient) {
    supabaseAdminClient = createAdminClient()
  }

  return supabaseAdminClient
}
