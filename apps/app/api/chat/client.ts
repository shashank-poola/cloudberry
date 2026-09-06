import { apiRequest, BrowserApiError } from "../client"

export const HOSTED_MODELS = ["gpt-oss-120b", "minimax-m2.7"] as const
export type HostedModelId = (typeof HOSTED_MODELS)[number]
export type ChatProvider = "hosted" | "codex"
export type CodexModelId = string

export type ChatModelSelection =
  | { provider: "hosted"; model: HostedModelId }
  | { provider: "codex"; model: CodexModelId; reasoningEffort: "high" }

export type ChatCitation = {
  sourceEventId: string
  resultId: string
  type: string
}

export type ChatConversation = {
  id: string
  title: string
  provider: ChatProvider
  model: string
  reasoningEffort: "high" | null
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

export type ChatListResult = {
  chats: ChatConversation[]
}

export type ChatSearchResult = {
  chatId: string
  title: string
  status: "active" | "archived"
  messageId: string | null
  matchType: "title" | "message"
  snippet: string
  lastMessageAt: string | null
}

export type ChatSearchResponse = {
  results: ChatSearchResult[]
}

export const CHAT_LIST_CHANGED_EVENT = "cloudberry:chat-list-changed"

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
  typeof value === "string" &&
  (HOSTED_MODELS as readonly string[]).includes(value)

const isCodexModelId = (value: unknown): value is CodexModelId =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 128 &&
  /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)

const normaliseConversation = (value: unknown): ChatConversation | null => {
  if (!isRecord(value)) return null
  const id = stringValue(value.id)
  const title = stringValue(value.title)
  const provider = value.provider ?? "hosted"
  const model = value.model
  const reasoningEffort = value.reasoning_effort
  const status = value.status
  const validProvider = provider === "hosted" || provider === "codex"
  const validModel =
    validProvider &&
    (provider === "hosted"
      ? isHostedModelId(model)
      : isCodexModelId(model) && reasoningEffort === "high")
  if (
    !id ||
    !title ||
    !validModel ||
    (status !== "active" && status !== "archived")
  ) {
    return null
  }

  return {
    id,
    title,
    provider: provider as ChatProvider,
    model: model as string,
    reasoningEffort: provider === "codex" ? "high" : null,
    status,
    createdAt: stringValue(value.created_at),
    updatedAt: stringValue(value.updated_at),
  }
}

const normaliseSearchResult = (value: unknown): ChatSearchResult | null => {
  if (!isRecord(value)) return null
  const chatId = stringValue(value.chat_id)
  const title = stringValue(value.title)
  const status = value.status
  const messageId =
    value.message_id === null ? null : stringValue(value.message_id)
  const matchType = value.match_type
  const snippet = stringValue(value.snippet)
  const lastMessageAt =
    value.last_message_at === null ? null : stringValue(value.last_message_at)

  if (
    !chatId ||
    !title ||
    (status !== "active" && status !== "archived") ||
    (value.message_id !== null && !messageId) ||
    (matchType !== "title" && matchType !== "message") ||
    !snippet ||
    (value.last_message_at !== null && !lastMessageAt)
  ) {
    return null
  }

  return {
    chatId,
    title,
    status,
    messageId,
    matchType,
    snippet,
    lastMessageAt,
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
  selection: ChatModelSelection,
  signal?: AbortSignal
): Promise<ChatConversation>
export async function createChat(
  model: HostedModelId,
  signal?: AbortSignal
): Promise<ChatConversation>
export async function createChat(
  selectionOrModel: ChatModelSelection | HostedModelId,
  signal?: AbortSignal
): Promise<ChatConversation> {
  const selection: ChatModelSelection =
    typeof selectionOrModel === "string"
      ? { provider: "hosted", model: selectionOrModel }
      : selectionOrModel
  const body =
    selection.provider === "codex"
      ? {
          provider: selection.provider,
          model: selection.model,
          reasoning_effort: selection.reasoningEffort,
        }
      : { model: selection.model }
  const value = await apiRequest<unknown>(chatPath, {
    body,
    method: "POST",
    signal,
  })
  const resource = isRecord(value) ? normaliseConversation(value.chat) : null
  return resource ?? invalidResponse("chat")
}

export async function listChats(signal?: AbortSignal): Promise<ChatListResult> {
  const value = await apiRequest<unknown>(chatPath, { signal })
  if (!isRecord(value) || !Array.isArray(value.chats)) {
    return invalidResponse("chat list")
  }

  const chats = value.chats
    .map(normaliseConversation)
    .filter((chat): chat is ChatConversation => Boolean(chat))
  if (chats.length !== value.chats.length) return invalidResponse("chat list")
  return { chats }
}

export async function searchChats(
  query: string,
  signal?: AbortSignal
): Promise<ChatSearchResponse> {
  const value = await apiRequest<unknown>(
    `${chatPath}/search?q=${encodeURIComponent(query.trim())}`,
    { signal }
  )
  if (!isRecord(value) || !Array.isArray(value.results)) {
    return invalidResponse("chat search")
  }

  const results = value.results
    .map(normaliseSearchResult)
    .filter((result): result is ChatSearchResult => Boolean(result))
  if (results.length !== value.results.length)
    return invalidResponse("chat search")
  return { results }
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

export function notifyChatListChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHAT_LIST_CHANGED_EVENT))
  }
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
