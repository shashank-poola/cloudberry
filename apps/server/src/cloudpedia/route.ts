import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express"
import { authMiddleware } from "../auth"
import { getSupabaseAdminClient } from "../database/admin"
import { organizationContextMiddleware } from "../organizations/context"
import {
  CloudpediaService,
  CloudpediaServiceError,
  type CloudpediaServiceLike,
} from "./service"

export type { CloudpediaServiceLike } from "./service"

export type CloudpediaRouterOptions = {
  service?: CloudpediaServiceLike
  auth?: RequestHandler
  organizationContext?: RequestHandler
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

const getOrganizationId = (req: Request, res: Response) => {
  if (!req.organization?.id) {
    res.status(403).json(failure("ORGANIZATION_REQUIRED"))
    return null
  }

  return req.organization.id
}

const sendError = (res: Response, error: unknown) => {
  if (error instanceof CloudpediaServiceError) {
    return res.status(error.status).json(failure(error.code))
  }

  if (error instanceof Error && error.message.includes("must be set")) {
    return res.status(503).json(failure("SERVER_NOT_CONFIGURED"))
  }

  return res.status(500).json(failure("INTERNAL_SERVER_ERROR"))
}

export const createCloudpediaRouter = (
  options: CloudpediaRouterOptions = {}
): Router => {
  const router = Router()
  let service = options.service
  const getService = () => {
    if (!service) service = new CloudpediaService(getSupabaseAdminClient())
    return service
  }

  router.use(
    options.auth ?? authMiddleware,
    options.organizationContext ?? organizationContextMiddleware
  )

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

  return router
}

export default createCloudpediaRouter()
