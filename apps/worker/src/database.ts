import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { DatabaseConfig } from "./config"

export const createWorkerDatabase = (
  config: DatabaseConfig
): SupabaseClient =>
  createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
