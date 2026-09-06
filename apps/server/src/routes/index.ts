import { Router } from "express"
import authRouter from "../auth/route"
import { createComputerRouter } from "../computer/route"
import organizationsRouter from "../organizations/route"

const mainRouter = Router()

mainRouter.use("/auth", authRouter)
mainRouter.use("/organizations", organizationsRouter)
mainRouter.use("/computer", createComputerRouter())

export default mainRouter
