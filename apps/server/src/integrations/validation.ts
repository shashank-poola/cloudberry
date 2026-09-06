import { z } from "zod"
import {
  SUPPORTED_INTEGRATION_PROVIDERS,
  type IntegrationProvider,
} from "./types"

export class IntegrationRequestValidationError extends Error {
  constructor() {
    super("INVALID_REQUEST")
    this.name = "IntegrationRequestValidationError"
  }
}

const providerSchema = z.enum(SUPPORTED_INTEGRATION_PROVIDERS)

export const connectionAttemptIdSchema = z
  .string()
  .trim()
  .min(16)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/)

const callbackSchema = z
  .object({
    state: z.string().trim().min(16).max(256),
    status: z.enum(["success", "failed"]),
    connected_account_id: z.string().trim().min(1).max(512).optional(),
  })
  .strict()

export type ConnectionCallback = z.infer<typeof callbackSchema>

export const parseConnectionAttemptId = (value: unknown) => {
  const result = connectionAttemptIdSchema.safeParse(value)
  if (!result.success) throw new IntegrationRequestValidationError()
  return result.data
}

export const parseIntegrationProvider = (
  value: unknown
): IntegrationProvider => {
  const result = providerSchema.safeParse(value)
  if (!result.success) throw new IntegrationRequestValidationError()
  return result.data
}

export const parseConnectionCallback = (value: unknown): ConnectionCallback => {
  const result = callbackSchema.safeParse(value)
  if (!result.success) throw new IntegrationRequestValidationError()
  return result.data
}
