import cors from "cors"
import "dotenv/config"
import http from "http"
import express from "express"
import routes from "./routes"

const app = express()
const server = http.createServer(app)

app.use(express.json())

const PORT = process.env.PORT || 8000

const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS || "http://localhost:3000"
).split(",")

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
)

app.use("/api/v1", routes)

server.listen(PORT, () => {
  console.log(`Server is running port : ${PORT}`)
})
