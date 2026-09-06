import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express"
import { getSupabaseAdminClient } from "../database/admin"
import { authMiddleware } from "../auth"
import { organizationContextMiddleware } from "../organizations/context"
import { getApplicationUrl } from "./composio"
import { createLazyCodexRuntime } from "./codex"
import {
  IntegrationService,
  IntegrationServiceError,
  type IntegrationServiceDependencies,
  type IntegrationServiceLike,
} from "./service"
import type {
  CodexConnectionStatusResult,
  ConnectionStartResult,
} from "./types"
import {
  parseConnectionCallback,
  parseIntegrationProvider,
  IntegrationRequestValidationError,
  parseConnectionAttemptId,
} from "./validation"
import type { IntegrationProvider } from "./types"

export type IntegrationRouterOptions = {
  service?: IntegrationServiceLike
  auth?: RequestHandler
  organizationContext?: RequestHandler
  dependencies?: IntegrationServiceDependencies
}

const success = (data: unknown) => ({
  success: true,
  data,
  error: null,
})

const failure = (error: string) => ({
  success: false,
  data: null,
  error,
})

const createService = (dependencies?: IntegrationServiceDependencies) =>
  new IntegrationService(
    dependencies ?? {
      database: getSupabaseAdminClient(),
      codexRuntime: createLazyCodexRuntime(),
    }
  )

const getOrganizationId = (req: Request, res: Response) => {
  if (!req.organization?.id) {
    res.status(403).json(failure("ORGANIZATION_REQUIRED"))
    return null
  }

  return req.organization.id
}

const getUserId = (req: Request, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json(failure("UNAUTHORIZED"))
    return null
  }

  return req.user.id
}

const requireOwner = (req: Request, res: Response) => {
  if (req.organization?.role !== "owner") {
    res.status(403).json(failure("INTEGRATION_OWNER_REQUIRED"))
    return false
  }

  return true
}

const sendError = (res: Response, error: unknown) => {
  if (error instanceof IntegrationRequestValidationError) {
    return res.status(400).json(failure("INVALID_REQUEST"))
  }

  if (error instanceof IntegrationServiceError) {
    return res.status(error.status).json(failure(error.code))
  }

  if (error instanceof Error && error.message.includes("must be set")) {
    return res.status(503).json(failure("INTEGRATION_NOT_CONFIGURED"))
  }

  return res.status(500).json(failure("INTERNAL_SERVER_ERROR"))
}

const callbackRedirect = (
  provider: IntegrationProvider | null,
  status: "success" | "error",
  reason?: string | null
) => {
  const url = new URL("/integrations", getApplicationUrl())
  if (provider) url.searchParams.set("integration", provider)
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason)
  return url.toString()
}

const queryString = (value: unknown) =>
  typeof value === "string" ? value : undefined

export const createIntegrationRouter = (
  options: IntegrationRouterOptions = {}
): Router => {
  const router = Router()
  let service = options.service
  const getService = () => {
    if (!service) service = createService(options.dependencies)
    return service
  }

  // OAuth callback and Composio webhook routes are intentionally public. The
  // callback is protected by a one-time state record; the webhook is protected
  // by Composio's signed raw payload.
  router.get("/composio/callback", async (req, res) => {
    let provider: IntegrationProvider | null = null

    try {
      const state = queryString(req.query.state)
      const status = queryString(req.query.status)
      const connectedAccountId = queryString(req.query.connected_account_id)
      const callback = parseConnectionCallback({
        state,
        status,
        ...(connectedAccountId
          ? { connected_account_id: connectedAccountId }
          : {}),
      })

      const result = await getService().completeConnection(
        callback.state,
        callback.status,
        callback.connected_account_id
      )
      provider = result.provider

      return res.redirect(
        303,
        callbackRedirect(
          provider,
          result.success ? "success" : "error",
          result.reason
        )
      )
    } catch (error) {
      const reason =
        error instanceof IntegrationServiceError
          ? error.code
          : "INTEGRATION_CALLBACK_INVALID"
      return res.redirect(303, callbackRedirect(provider, "error", reason))
    }
  })

  router.post("/webhooks/composio", async (req, res) => {
    try {
      const result = await getService().handleWebhook(req.body, req.headers)
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  const secured: RequestHandler[] = [
    options.auth ?? authMiddleware,
    options.organizationContext ?? organizationContextMiddleware,
  ]
  router.use(...secured)

  router.get("/", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId) return

    try {
      return res
        .status(200)
        .json(success(await getService().list(organizationId)))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.get("/codex/connect/:attemptId", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId) return

    try {
      const result: CodexConnectionStatusResult =
        await getService().getCodexConnectionStatus(
          organizationId,
          parseConnectionAttemptId(req.params.attemptId)
        )
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/codex/connect/:attemptId/cancel", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId || !requireOwner(req, res)) return

    try {
      const result: CodexConnectionStatusResult =
        await getService().cancelCodexConnection(
          organizationId,
          parseConnectionAttemptId(req.params.attemptId)
        )
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/:provider/connect", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    const userId = getUserId(req, res)
    if (!organizationId || !userId || !requireOwner(req, res)) return

    try {
      const provider = parseIntegrationProvider(req.params.provider)
      const result: ConnectionStartResult = await getService().startConnection(
        organizationId,
        userId,
        provider
      )
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/:provider/reconnect", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    const userId = getUserId(req, res)
    if (!organizationId || !userId || !requireOwner(req, res)) return

    try {
      const provider = parseIntegrationProvider(req.params.provider)
      const result = await getService().reconnect(
        organizationId,
        userId,
        provider
      )
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/:provider/retry", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId || !requireOwner(req, res)) return

    try {
      const provider = parseIntegrationProvider(req.params.provider)
      return res
        .status(200)
        .json(success(await getService().retry(organizationId, provider)))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/:provider/disconnect", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId || !requireOwner(req, res)) return

    try {
      const provider = parseIntegrationProvider(req.params.provider)
      return res
        .status(200)
        .json(success(await getService().disconnect(organizationId, provider)))
    } catch (error) {
      return sendError(res, error)
    }
  })

  return router
}

export default createIntegrationRouter()
