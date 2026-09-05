import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { NextFunction, Request, Response } from "express"
import { authorizationHeaderSchema } from "./schema"

let supabaseClient: SupabaseClient | null = null

const getSupabaseClient = () => {
  if (supabaseClient) {
    return supabaseClient
  }

  const url = process.env.SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set")
  }

  supabaseClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseClient
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authorization = req.get("authorization")
  const result = authorizationHeaderSchema.safeParse(authorization)

  if (!result.success) {
    res.status(401).json({
      success: false,
      data: null,
      error: "UNAUTHORIZED",
    })
    return
  }

  const accessToken = result.data.replace(/^Bearer\s+/i, "")

  try {
    const {
      data: { user },
      error,
    } = await getSupabaseClient().auth.getUser(accessToken)

    if (error || !user) {
      res.status(401).json({
        success: false,
        data: null,
        error: "UNAUTHORIZED",
      })
      return
    }

    req.user = user
    req.accessToken = accessToken
    next()
  } catch (error) {
    console.log("authMiddleware error", error)
    res.status(401).json({
      success: false,
      data: null,
      error: "UNAUTHORIZED",
    })
    return
  }
}

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const user = req.user

    if (!user) {
      res.status(401).json({
        success: false,
        data: null,
        error: "UNAUTHORIZED",
      })
      return
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email ?? null,
        role: user.role,
      },
      error: null,
    })
  } catch (error) {
    console.log("getCurrentUser error", error)
    res.status(500).json({
      success: false,
      data: null,
      error: "INTERNAL_SERVER_ERROR",
    })
    return
  }
}
