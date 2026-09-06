import {
  Router,
  type Request,
  type RequestHandler,
  type Response,
} from "express"
import { authMiddleware } from "../auth"
import { getSupabaseAdminClient } from "../database/admin"
import { createKnowledgeClient } from "../computer/knowledge"
import { createGeneralComputeClient } from "../models/llm/client"
import { organizationContextMiddleware } from "../organizations/context"
import {
  ChatService,
  ChatServiceError,
  type ChatServiceDependencies,
  type ChatServiceLike,
} from "./service"
import {
  parseChatId,
  parseCreateChatMessageRequest,
  parseCreateChatRequest,
  RequestValidationError,
} from "./validation"

export type { ChatServiceLike } from "./service"

export type ChatRouterOptions = {
  service?: ChatServiceLike
  auth?: RequestHandler
  organizationContext?: RequestHandler
  dependencies?: ChatServiceDependencies
}

const success = (data: unknown) => ({ success: true, data, error: null })
const failure = (error: string) => ({ success: false, data: null, error })

const createService = (dependencies?: ChatServiceDependencies) =>
  new ChatService(
    dependencies ?? {
      database: getSupabaseAdminClient(),
      generalCompute: createGeneralComputeClient(),
      knowledge: createKnowledgeClient(),
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

const sendError = (res: Response, error: unknown) => {
  if (error instanceof RequestValidationError) {
    return res.status(400).json(failure("INVALID_REQUEST"))
  }
  if (error instanceof ChatServiceError) {
    return res.status(error.status).json(failure(error.code))
  }
  if (error instanceof Error && error.message.includes("must be set")) {
    return res.status(503).json(failure("SERVER_NOT_CONFIGURED"))
  }

  return res.status(500).json(failure("INTERNAL_SERVER_ERROR"))
}

export const createChatRouter = (options: ChatRouterOptions = {}): Router => {
  const router = Router()
  let service = options.service
  const getService = () => {
    if (!service) service = createService(options.dependencies)
    return service
  }

  router.use(
    options.auth ?? authMiddleware,
    options.organizationContext ?? organizationContextMiddleware
  )

  router.post("/", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    const userId = getUserId(req, res)
    if (!organizationId || !userId) return

    try {
      const result = await getService().createChat(
        organizationId,
        userId,
        parseCreateChatRequest(req.body)
      )
      return res.status(201).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.get("/:chatId", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    if (!organizationId) return

    try {
      const result = await getService().getChat(
        organizationId,
        parseChatId(req.params.chatId)
      )
      return res.status(200).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  router.post("/:chatId/messages", async (req, res) => {
    const organizationId = getOrganizationId(req, res)
    const userId = getUserId(req, res)
    if (!organizationId || !userId) return

    try {
      const result = await getService().createMessage(
        organizationId,
        userId,
        parseChatId(req.params.chatId),
        parseCreateChatMessageRequest(req.body)
      )
      return res.status(201).json(success(result))
    } catch (error) {
      return sendError(res, error)
    }
  })

  return router
}
