import { Router } from "express"
import authRouter from "../auth/route"
import organizationsRouter from "../organizations/route"

const mainRouter = Router()

mainRouter.use("/auth", authRouter)
mainRouter.use("/organizations", organizationsRouter)

export default mainRouter
