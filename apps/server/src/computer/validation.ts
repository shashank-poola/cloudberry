import { z } from "zod"

export const MAX_USER_PROMPT_LENGTH = 16_000
export const MAX_CWD_LENGTH = 1_024
export const MAX_EVENT_AFTER = Number.MAX_SAFE_INTEGER

const boxNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)

const cwdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CWD_LENGTH)
  .refine((value) => !/[\u0000\r\n]/.test(value))

const promptSchema = z
  .string()
  .max(MAX_USER_PROMPT_LENGTH)
  .refine((value) => value.trim().length > 0)
  .transform((value) => value.trim())

export const provisionRequestSchema = z
  .object({
    name: boxNameSchema.optional(),
    tier: z
      .enum(["nano", "micro", "lite", "flow", "pro", "max", "ultra"])
      .optional(),
    ttlMinutes: z.number().int().min(5).max(43_200).optional(),
    autoPauseMin: z.number().int().min(30).max(10_080).nullable().optional(),
  })
  .strict()

export const codexSessionRequestSchema = z
  .object({
    prompt: promptSchema,
    cwd: cwdSchema.optional(),
    continue: z.boolean().optional(),
  })
  .strict()

export const sessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[^/]+$/)

export const afterQuerySchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value))
  .refine((value) => Number.isSafeInteger(value) && value <= MAX_EVENT_AFTER)

export type ProvisionRequest = z.infer<typeof provisionRequestSchema>
export type CodexSessionRequest = z.infer<typeof codexSessionRequestSchema>

export class RequestValidationError extends Error {
  constructor() {
    super("INVALID_REQUEST")
    this.name = "RequestValidationError"
  }
}

export const parseProvisionRequest = (value: unknown): ProvisionRequest => {
  const result = provisionRequestSchema.safeParse(value ?? {})
  if (!result.success) {
    throw new RequestValidationError()
  }

  return result.data
}

export const parseCodexSessionRequest = (
  value: unknown
): CodexSessionRequest => {
  const result = codexSessionRequestSchema.safeParse(value)
  if (!result.success) {
    throw new RequestValidationError()
  }

  return result.data
}

export const parseSessionId = (value: unknown) => {
  const result = sessionIdSchema.safeParse(value)
  if (!result.success) {
    throw new RequestValidationError()
  }

  return result.data
}

export const parseAfter = (value: unknown) => {
  if (value === undefined) {
    return undefined
  }

  const result = afterQuerySchema.safeParse(value)
  if (!result.success) {
    throw new RequestValidationError()
  }

  return result.data
}
