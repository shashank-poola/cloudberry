import { Router } from "express"
import authRouter from "../auth/route"
import { createChatRouter } from "../chat/route"
import { createComputerRouter } from "../computer/route"
import createIntegrationRouter from "../integrations/route"
import organizationsRouter from "../organizations/route"

const mainRouter = Router()

mainRouter.use("/auth", authRouter)
mainRouter.use("/organizations", organizationsRouter)
mainRouter.use("/chats", createChatRouter())
mainRouter.use("/computer", createComputerRouter())
mainRouter.use("/integrations", createIntegrationRouter)

export default mainRouter
