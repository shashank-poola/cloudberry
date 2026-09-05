import { z } from "zod"

export const authorizationHeaderSchema = z
  .string()
  .regex(/^Bearer\s+\S+$/i, "Invalid authorization header")
