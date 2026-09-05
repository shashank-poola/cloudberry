import type { User } from "@supabase/supabase-js"

export type AuthUser = User

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      accessToken?: string
      organization?: {
        id: string
        name: string
        role: "owner" | "member"
      }
    }
  }
}

export {}
