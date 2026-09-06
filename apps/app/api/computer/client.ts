import { apiRequest, BrowserApiError } from "../client"

const computerPath = "/computer"
const provisionComputerPath = "/computer/provision"
const codexSessionsPath = "/computer/codex/sessions"

const computerPollIntervalMs = 1_000
const computerPollLimit = 90
const sessionPollIntervalMs = 750
const sessionTimeoutMs = 5 * 60 * 1_000

export type PrizedComputer = {
  id: string | null
  status: string
  provider: string | null
  boxId: string | null
}

export type CodexSessionStatus =
  "queued" | "running" | "succeeded" | "failed" | "cancelled"

export type CodexSession = {
  id: string
  status: CodexSessionStatus
  error: string | null
}

export type CodexEvent = {
  sequence: number
  at: string
  type: string
  text: string | null
  toolName: string | null
}

type CodexEvents = {
  events: CodexEvent[]
  nextSequence: number
  finished: boolean
}

type PollCodexSessionOptions = {
  signal?: AbortSignal
  onStatus?: (session: CodexSession) => void
  onAssistantText?: (text: string, mode: "append" | "replace") => void
  onEvent?: (label: string) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstString(
  value: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) {
      return value[key].trim()
    }
  }

  return null
}

function firstNumber(
  value: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === "number" && Number.isSafeInteger(candidate)) {
      return candidate
    }
  }

  return null
}

function unwrapResource(value: unknown, keys: string[]): unknown {
  let current = value

  for (let depth = 0; depth < 4; depth += 1) {
    if (!isRecord(current)) return current

    const record = current
    const nestedKey = keys.find((key) => key in record)
    if (nestedKey) {
      current = record[nestedKey]
      continue
    }

    if ("data" in current) {
      current = current.data
      continue
    }

    return current
  }

  return current
}

function normaliseComputer(value: unknown): PrizedComputer | null {
  const resource = unwrapResource(value, [
    "computer",
    "organization_computer",
    "organizationComputer",
  ])
  if (!isRecord(resource)) return null

  return {
    id: firstString(resource, ["id", "computer_id", "computerId"]),
    provider: firstString(resource, ["provider"]),
    status: firstString(resource, ["status", "state"]) ?? "unknown",
    boxId: firstString(resource, ["box_id", "boxId", "external_box_id"]),
  }
}

export function normaliseCodexSessionStatus(
  value: string | null
): CodexSessionStatus {
  switch (value?.toLowerCase().replace(/[-\s]/g, "_")) {
    case "running":
    case "active":
    case "in_progress":
    case "processing":
      return "running"
    case "succeeded":
    case "success":
    case "complete":
    case "completed":
    case "done":
      return "succeeded"
    case "failed":
    case "failure":
    case "error":
      return "failed"
    case "cancelled":
    case "canceled":
    case "interrupted":
      return "cancelled"
    case "queued":
    case "pending":
    case "created":
    case "accepted":
    default:
      return "queued"
  }
}

function normaliseSession(value: unknown): CodexSession | null {
  const resource = unwrapResource(value, [
    "session",
    "codex_session",
    "codexSession",
  ])
  if (!isRecord(resource)) return null

  const id = firstString(resource, ["id", "session_id", "sessionId"])
  if (!id) return null

  return {
    id,
    status: normaliseCodexSessionStatus(
      firstString(resource, ["status", "state"])
    ),
    error: firstString(resource, ["error", "last_error", "lastError"]),
  }
}

function parseEvent(value: unknown): CodexEvent | null {
  if (!isRecord(value)) return null

  const sequence = firstNumber(value, ["seq", "sequence", "event_sequence"])
  const at = firstString(value, ["at", "created_at"]) ?? ""
  const type =
    firstString(value, ["type", "event_type", "eventType"]) ?? "event"
  if (sequence === null) return null

  const tool = isRecord(value.tool) ? firstString(value.tool, ["name"]) : null
  return {
    sequence,
    at,
    type: type.toLowerCase(),
    text: firstString(value, ["text"]),
    toolName: tool,
  }
}

function parseEvents(value: unknown): CodexEvents {
  const resource = unwrapResource(value, ["data"])
  if (!isRecord(resource))
    return { events: [], nextSequence: 0, finished: false }

  const events = Array.isArray(resource.events)
    ? resource.events
        .map(parseEvent)
        .filter((event): event is CodexEvent => Boolean(event))
    : []
  const nextSequence = firstNumber(resource, ["next"]) ?? 0
  const finished = resource.finished === true

  return { events, nextSequence, finished }
}

function isAssistantEvent(event: CodexEvent) {
  const type = event.type
  if (
    type.includes("command") ||
    type.includes("tool") ||
    type.includes("reason") ||
    type.includes("think") ||
    type.includes("file") ||
    type.includes("patch") ||
    type.includes("system")
  ) {
    return false
  }

  return Boolean(
    event.text &&
    (type.includes("assistant") ||
      type.includes("agent") ||
      type.includes("message") ||
      type.includes("output") ||
      type.includes("delta") ||
      type === "event")
  )
}

function isDeltaEvent(event: CodexEvent) {
  return (
    event.type.includes("delta") ||
    event.type.includes("chunk") ||
    event.type.includes("token")
  )
}

function eventLabel(event: CodexEvent) {
  const type = event.type
  if (type.includes("command") || type.includes("tool")) {
    return "Codex is working in the computer…"
  }
  if (type.includes("reason") || type.includes("think")) {
    return "Codex is thinking…"
  }
  if (type.includes("file") || type.includes("patch")) {
    return "Codex is updating files…"
  }
  return null
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("The request was aborted.", "AbortError")
  }
}

function wait(milliseconds: number, signal?: AbortSignal) {
  throwIfAborted(signal)

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(done, milliseconds)

    function done() {
      signal?.removeEventListener("abort", abort)
      resolve()
    }

    function abort() {
      clearTimeout(timeout)
      signal?.removeEventListener("abort", abort)
      reject(new DOMException("The request was aborted.", "AbortError"))
    }

    signal?.addEventListener("abort", abort, { once: true })
  })
}

export function isPrizedComputerReady(computer: PrizedComputer) {
  return [
    "active",
    "available",
    "connected",
    "online",
    "ready",
    "running",
  ].includes(computer.status.toLowerCase())
}

function isComputerUnavailable(computer: PrizedComputer) {
  return [
    "disabled",
    "error",
    "failed",
    "paused",
    "sleeping",
    "stopped",
    "unavailable",
  ].includes(computer.status.toLowerCase())
}

export async function getPrizedComputer(signal?: AbortSignal) {
  const value = await apiRequest<unknown>(computerPath, { signal })
  return normaliseComputer(value)
}

export async function provisionPrizedComputer(signal?: AbortSignal) {
  const value = await apiRequest<unknown>(provisionComputerPath, {
    method: "POST",
    signal,
  })
  const computer = normaliseComputer(value)

  if (!computer) {
    throw new BrowserApiError(
      "Cloudberry did not return a computer.",
      502,
      "COMPUTER_INVALID_RESPONSE"
    )
  }

  return computer
}

export async function ensurePrizedComputer(signal?: AbortSignal) {
  let computer = await getPrizedComputer(signal)

  if (!computer || isComputerUnavailable(computer)) {
    computer = await provisionPrizedComputer(signal)
  }

  if (isPrizedComputerReady(computer)) return computer

  for (let attempt = 0; attempt < computerPollLimit; attempt += 1) {
    await wait(computerPollIntervalMs, signal)
    computer = await getPrizedComputer(signal)

    if (computer && isPrizedComputerReady(computer)) return computer
    if (computer && isComputerUnavailable(computer)) {
      throw new BrowserApiError(
        "Cloudberry's computer could not be made ready.",
        409,
        "COMPUTER_UNAVAILABLE"
      )
    }
  }

  throw new BrowserApiError(
    "Cloudberry's computer is still starting. Please try again in a moment.",
    408,
    "COMPUTER_TIMEOUT"
  )
}

export async function startCodexSession(
  prompt: string,
  signal?: AbortSignal
): Promise<CodexSession> {
  const cleanPrompt = prompt.trim()
  if (!cleanPrompt) throw new Error("A prompt is required.")

  const value = await apiRequest<unknown>(codexSessionsPath, {
    body: { prompt: cleanPrompt },
    method: "POST",
    signal,
  })
  const session = normaliseSession(value)

  if (!session) {
    throw new BrowserApiError(
      "Codex did not return a session.",
      502,
      "CODEX_INVALID_SESSION"
    )
  }

  return session
}

export async function getCodexSession(
  sessionId: string,
  signal?: AbortSignal
): Promise<CodexSession> {
  const value = await apiRequest<unknown>(
    `${codexSessionsPath}/${encodeURIComponent(sessionId)}`,
    { signal }
  )
  const session = normaliseSession(value)

  if (!session) {
    throw new BrowserApiError(
      "Codex returned an invalid session status.",
      502,
      "CODEX_INVALID_SESSION"
    )
  }

  return session
}

export async function getCodexSessionEvents(
  sessionId: string,
  afterSequence = 0,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({ after: String(afterSequence) })
  const value = await apiRequest<unknown>(
    `${codexSessionsPath}/${encodeURIComponent(sessionId)}/events?${query.toString()}`,
    { signal }
  )
  return parseEvents(value)
}

export async function interruptCodexSession(
  sessionId: string,
  signal?: AbortSignal
) {
  await apiRequest<unknown>(
    `${codexSessionsPath}/${encodeURIComponent(sessionId)}/interrupt`,
    { method: "POST", signal }
  )
}

export async function waitForCodexSession(
  sessionId: string,
  options: PollCodexSessionOptions = {}
): Promise<CodexSession> {
  const startedAt = Date.now()
  const seenEvents = new Set<number>()
  let afterSequence = 0

  while (true) {
    throwIfAborted(options.signal)

    const { events, nextSequence, finished } = await getCodexSessionEvents(
      sessionId,
      afterSequence,
      options.signal
    )

    for (const event of events) {
      if (seenEvents.has(event.sequence)) continue
      seenEvents.add(event.sequence)
      const label = eventLabel(event)
      if (label) options.onEvent?.(label)

      if (isAssistantEvent(event) && event.text) {
        options.onAssistantText?.(
          event.text,
          isDeltaEvent(event) ? "append" : "replace"
        )
      }
    }

    afterSequence = Math.max(afterSequence, nextSequence)
    const session = await getCodexSession(sessionId, options.signal)
    options.onStatus?.(session)

    if (
      finished ||
      session.status === "succeeded" ||
      session.status === "failed" ||
      session.status === "cancelled"
    ) {
      return session
    }

    if (Date.now() - startedAt >= sessionTimeoutMs) {
      throw new BrowserApiError(
        "Codex took too long to respond. You can retry the prompt.",
        408,
        "CODEX_TIMEOUT"
      )
    }

    await wait(sessionPollIntervalMs, options.signal)
  }
}
