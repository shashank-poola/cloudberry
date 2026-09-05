import type { NextFunction, Request, Response } from "express"
import { createAuthenticatedSupabaseClient } from "../database/client"

export const organizationContextMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.accessToken) {
    return res.status(401).json({
      success: false,
      data: null,
      error: "UNAUTHORIZED",
    })
  }

  try {
    const supabase = createAuthenticatedSupabaseClient(req.accessToken)
    // V0 creates one personal workspace per user. Keep this lookup simple until
    // the product has an explicit active-organization selection mechanism.
    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", req.user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    if (!membership) {
      return res.status(403).json({
        success: false,
        data: null,
        error: "ORGANIZATION_REQUIRED",
      })
    }

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", membership.organization_id)
      .maybeSingle()

    if (organizationError) {
      throw organizationError
    }

    if (!organization) {
      return res.status(403).json({
        success: false,
        data: null,
        error: "ORGANIZATION_REQUIRED",
      })
    }

    req.organization = {
      id: organization.id,
      name: organization.name,
      role: membership.role === "owner" ? "owner" : "member",
    }
    next()
  } catch (error) {
    console.error("organizationContextMiddleware error", error)
    return res.status(500).json({
      success: false,
      data: null,
      error: "ORGANIZATION_CONTEXT_FAILED",
    })
  }
}
