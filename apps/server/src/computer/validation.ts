import { z } from "zod"

const boxNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)

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

export type ProvisionRequest = z.infer<typeof provisionRequestSchema>

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
