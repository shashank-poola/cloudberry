import { apiRequest, BrowserApiError } from "../client"

export const HOSTED_MODELS = ["gpt-oss-120b", "minimax-m2.7"] as const
export type HostedModelId = (typeof HOSTED_MODELS)[number]

export type ChatCitation = {
  sourceEventId: string
  resultId: string
  type: string
}

export type ChatConversation = {
  id: string
  title: string
  model: HostedModelId
  status: "active" | "archived"
  createdAt: string | null
  updatedAt: string | null
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  error: string | null
  citations: ChatCitation[]
  createdAt: string | null
}

export type ChatDetail = {
  chat: ChatConversation
  messages: ChatMessage[]
}

type CreateMessageResult = {
  chat: ChatConversation
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}

const chatPath = "/chats"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : null

const isHostedModelId = (value: unknown): value is HostedModelId =>
  typeof value === "string" && (HOSTED_MODELS as readonly string[]).includes(value)

const normaliseConversation = (value: unknown): ChatConversation | null => {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  const title = stringValue(value.title)
  const model = value.model
  const status = value.status
  if (
    !id ||
    !title ||
    !isHostedModelId(model) ||
    (status !== "active" && status !== "archived")
  ) {
    return null
  }

  return {
    id,
    title,
    model,
    status,
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  }
}

const normaliseCitation = (value: unknown): ChatCitation | null => {
  if (!isRecord(value)) return null
  const sourceEventId = stringValue(value.source_event_id)
  const resultId = stringValue(value.result_id)
  const type = stringValue(value.type)
  if (!sourceEventId || !resultId || !type) return null
  return { sourceEventId, resultId, type }
}

const normaliseMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  const role = value.role
  const status = value.status
  if (
    !id ||
    (role !== "user" && role !== "assistant") ||
    (status !== "queued" &&
      status !== "running" &&
      status !== "succeeded" &&
      status !== "failed" &&
      status !== "cancelled") ||
    typeof value.content !== "string"
  ) {
    return null
  }

  return {
    id,
    role,
    content: value.content,
    status,
    error: stringValue(value.error),
    citations: Array.isArray(value.citations)
      ? value.citations
          .map(normaliseCitation)
          .filter((citation): citation is ChatCitation => Boolean(citation))
      : [],
    createdAt: stringValue(value.created_at),
  }
}

const invalidResponse = (resource: string): never => {
  throw new BrowserApiError(
    `Cloudberry returned an invalid ${resource}.`,
    502,
    "CHAT_INVALID_RESPONSE"
  )
}

export async function createChat(
  model: HostedModelId,
  signal?: AbortSignal
): Promise<ChatConversation> {
  const value = await apiRequest<unknown>(chatPath, {
    body: { model },
    method: "POST",
    signal,
  })
  const resource = isRecord(value) ? normaliseConversation(value.chat) : null
  return resource ?? invalidResponse("chat")
}

export async function getChat(
  chatId: string,
  signal?: AbortSignal
): Promise<ChatDetail> {
  const value = await apiRequest<unknown>(
    `${chatPath}/${encodeURIComponent(chatId)}`,
    { signal }
  )
  if (!isRecord(value)) return invalidResponse("chat")

  const chat = normaliseConversation(value.chat)
  if (!chat || !Array.isArray(value.messages)) return invalidResponse("chat")
  const messages = value.messages
    .map(normaliseMessage)
    .filter((message): message is ChatMessage => Boolean(message))

  if (messages.length !== value.messages.length) return invalidResponse("chat")
  return { chat, messages }
}

export async function createChatMessage(
  chatId: string,
  content: string,
  clientMessageId: string,
  signal?: AbortSignal
): Promise<CreateMessageResult> {
  const value = await apiRequest<unknown>(
    `${chatPath}/${encodeURIComponent(chatId)}/messages`,
    {
      body: { client_message_id: clientMessageId, content },
      method: "POST",
      signal,
    }
  )
  if (!isRecord(value)) return invalidResponse("chat message")

  const chat = normaliseConversation(value.chat)
  const userMessage = normaliseMessage(value.user_message)
  const assistantMessage = normaliseMessage(value.assistant_message)
  if (!chat || !userMessage || !assistantMessage) {
    return invalidResponse("chat message")
  }

  return { chat, userMessage, assistantMessage }
}
