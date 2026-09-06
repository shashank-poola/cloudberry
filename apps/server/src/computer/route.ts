import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express"
import { authMiddleware } from "../auth"
import { organizationContextMiddleware } from "../organizations/context"
import { getSupabaseAdminClient } from "../database/admin"
import { PrizedClientError, createPrizedClient } from "../prized/client"
import {
  ComputerService,
  ComputerServiceError,
  type ComputerServiceDependencies,
  type ComputerServiceLike,
  type ComputerStatus,
  type ProvisionResult,
} from "./service"
import { parseProvisionRequest, RequestValidationError } from "./validation"

export type { ComputerServiceLike } from "./service"

export type ComputerRouterOptions = {
  service?: ComputerServiceLike
  auth?: RequestHandler
  organizationContext?: RequestHandler
  dependencies?: ComputerServiceDependencies
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

const createService = (dependencies?: ComputerServiceDependencies) =>
  new ComputerService(
    dependencies ?? {
      database: getSupabaseAdminClient(),
      prized: createPrizedClient(),
    }
  )

const sendError = (res: Response, error: unknown) => {
  if (error instanceof RequestValidationError) {
    return res.status(400).json(failure("INVALID_REQUEST"))
  }

  if (error instanceof ComputerServiceError) {
    return res.status(error.status).json(failure(error.code))
  }

  if (error instanceof PrizedClientError) {
    if (error.kind === "configuration") {
      return res.status(503).json(failure("PRIZED_NOT_CONFIGURED"))
    }
    if (error.kind === "timeout") {
      return res.status(504).json(failure("PRIZED_TIMEOUT"))
    }
    if (error.kind === "invalid_response") {
      return res.status(502).json(failure("PRIZED_INVALID_RESPONSE"))
    }
    if (error.status === 409) {
      return res.status(409).json(failure("PRIZED_CONFLICT"))
    }
    return res.status(502).json(failure("PRIZED_UNAVAILABLE"))
  }

  if (error instanceof Error && error.message.includes("must be set")) {
    return res.status(503).json(failure("SERVER_NOT_CONFIGURED"))
  }

  return res.status(500).json(failure("INTERNAL_SERVER_ERROR"))
}

const getOrganizationId = (req: Request, res: Response) => {
  if (!req.organization?.id) {
    res.status(403).json(failure("ORGANIZATION_REQUIRED"))
    return null
  }

  return req.organization.id
}

export const createComputerRouter = (
  options: ComputerRouterOptions = {}
): Router => {
  const router = Router()
  let service = options.service

  const getService = () => {
    if (!service) service = createService(options.dependencies)
    return service
  }

  const secured: RequestHandler[] = [
    options.auth ?? authMiddleware,
    options.organizationContext ?? organizationContextMiddleware,
  ]
  router.use(...secured)

  router.get("/", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId) return

    try {
      const result: ComputerStatus =
        await getService().getStatus(organizationId)
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/provision", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId) return

    try {
      const result: ProvisionResult = await getService().provisionOrWake(
        organizationId,
        parseProvisionRequest(req.body)
      )
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  return router
}
