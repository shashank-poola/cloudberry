import { Router } from "express"
import { authMiddleware, getCurrentUser } from "./index"

const authRouter = Router()

authRouter.get("/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    data: null,
    error: null,
  })
})

authRouter.get("/me", authMiddleware, getCurrentUser)

export default authRouter
