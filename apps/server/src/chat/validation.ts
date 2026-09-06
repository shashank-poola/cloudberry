import { z } from "zod"
import { isHostedModelId, type HostedModelId } from "../models/llm/catalog"

export const DEFAULT_HOSTED_MODEL: HostedModelId = "gpt-oss-120b"
export const MAX_CHAT_TITLE_LENGTH = 200
export const MAX_CHAT_MESSAGE_LENGTH = 16_000
export const MAX_CHAT_SEARCH_QUERY_LENGTH = 256
export const MAX_CODEX_MODEL_ID_LENGTH = 128

export type ChatProvider = "hosted" | "codex"

export const isCodexModelId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= MAX_CODEX_MODEL_ID_LENGTH &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)

const chatIdSchema = z.string().uuid()
const modelSchema = z
  .string()
  .refine(isHostedModelId)
  .transform((value) => value as HostedModelId)
const codexModelSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CODEX_MODEL_ID_LENGTH)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

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

const searchQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_CHAT_SEARCH_QUERY_LENGTH)
  .refine((value) => !value.includes("\u0000"))

const hostedChatRequestSchema = z
  .object({
    provider: z.literal("hosted").optional(),
    model: modelSchema.optional().default(DEFAULT_HOSTED_MODEL),
    title: titleSchema.optional(),
  })
  .strict()

const codexChatRequestSchema = z
  .object({
    provider: z.literal("codex"),
    model: codexModelSchema,
    reasoning_effort: z.literal("high").optional().default("high"),
    title: titleSchema.optional(),
  })
  .strict()

export const createChatRequestSchema = z.union([
  hostedChatRequestSchema,
  codexChatRequestSchema,
])

export const createChatMessageRequestSchema = z
  .object({
    client_message_id: z.string().uuid(),
    content: contentSchema,
  })
  .strict()

const chatSearchRequestSchema = z
  .object({
    q: searchQuerySchema,
  })
  .strict()

export type CreateChatRequest = z.infer<typeof createChatRequestSchema>
export type CreateChatMessageRequest = z.infer<
  typeof createChatMessageRequestSchema
>
export type ChatSearchRequest = z.infer<typeof chatSearchRequestSchema>

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

export const parseChatId = (value: unknown) =>
  parse(chatIdSchema.safeParse(value))

export const parseChatSearchRequest = (value: unknown): ChatSearchRequest =>
  parse(chatSearchRequestSchema.safeParse(value))
