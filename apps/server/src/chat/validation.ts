import { z } from "zod"
import {
  isHostedModelId,
  type HostedModelId,
} from "../models/llm/catalog"

export const DEFAULT_HOSTED_MODEL: HostedModelId = "gpt-oss-120b"
export const MAX_CHAT_TITLE_LENGTH = 200
export const MAX_CHAT_MESSAGE_LENGTH = 16_000

const chatIdSchema = z.string().uuid()
const modelSchema = z
  .string()
  .refine(isHostedModelId)
  .transform((value) => value as HostedModelId)

const titleSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CHAT_TITLE_LENGTH)
  .refine((value) => !/[\u0000\r\n]/.test(value))

const contentSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CHAT_MESSAGE_LENGTH)
  .refine((value) => !value.includes("\u0000"))

export const createChatRequestSchema = z
  .object({
    model: modelSchema.optional().default(DEFAULT_HOSTED_MODEL),
    title: titleSchema.optional(),
  })
  .strict()

export const createChatMessageRequestSchema = z
  .object({
    client_message_id: z.string().uuid(),
    content: contentSchema,
  })
  .strict()

export type CreateChatRequest = z.infer<typeof createChatRequestSchema>
export type CreateChatMessageRequest = z.infer<
  typeof createChatMessageRequestSchema
>

export class RequestValidationError extends Error {
  constructor() {
    super("INVALID_REQUEST")
    this.name = "RequestValidationError"
  }
}

const parse = <T>(result: { success: boolean; data?: T }): T => {
  if (!result.success || result.data === undefined) {
    throw new RequestValidationError()
  }

  return result.data
}

export const parseCreateChatRequest = (value: unknown): CreateChatRequest =>
  parse(createChatRequestSchema.safeParse(value ?? {}))

export const parseCreateChatMessageRequest = (
  value: unknown
): CreateChatMessageRequest =>
  parse(createChatMessageRequestSchema.safeParse(value))

export const parseChatId = (value: unknown) => parse(chatIdSchema.safeParse(value))
