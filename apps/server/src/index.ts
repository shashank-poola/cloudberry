import cors from "cors"
import "dotenv/config"
import express from "express"
import http from "http"
import routes from "./routes"

const app = express()
const server = http.createServer(app)

app.use(express.json({ limit: "64kb" }))

const PORT = process.env.PORT || 8000
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: false,
  })
)

app.use("/api/v1", routes)

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: "INVALID_JSON",
      })
    }

    return res.status(500).json({
      success: false,
      data: null,
      error: "INTERNAL_SERVER_ERROR",
    })
  }
)

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
