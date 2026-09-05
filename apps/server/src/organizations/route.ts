import { Router } from "express"
import { authMiddleware } from "../auth"
import { organizationContextMiddleware } from "./context"

const organizationsRouter = Router()

organizationsRouter.get(
  "/current",
  authMiddleware,
  organizationContextMiddleware,
  (req, res) => {
    return res.status(200).json({
      success: true,
      data: req.organization,
      error: null,
    })
  }
)

export default organizationsRouter
