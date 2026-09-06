import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { spawn as nodeSpawn } from "node:child_process"
import { tmpdir } from "node:os"
import { isAbsolute, join } from "node:path"
import type { CodexCredentialSet } from "./types"

type JsonRpcId = number | string

type JsonRpcMessage = {
  id?: JsonRpcId
  method?: string
  params?: unknown
  result?: unknown
  error?: unknown
}

type RuntimeStream = {
  on(event: "data", listener: (chunk: unknown) => void): unknown
}

type RuntimeStdin = {
  write(chunk: string): boolean
  end(): void
  destroyed?: boolean
}

type RuntimeProcess = {
  stdin: RuntimeStdin
  stdout: RuntimeStream
  stderr: RuntimeStream
  once(event: "error", listener: (error: unknown) => void): unknown
  once(
    event: "exit",
    listener: (code: number | null, signal: string | null) => void
  ): unknown
  kill(signal?: string): boolean
}

type RuntimeSpawnOptions = {
  cwd: string
  env: Record<string, string>
  stdio: ["pipe", "pipe", "pipe"]
  windowsHide?: boolean
  shell?: boolean
}

export type CodexSpawnLike = (
  command: string,
  args: readonly string[],
  options: RuntimeSpawnOptions
) => RuntimeProcess

const spawnProcess: CodexSpawnLike = (command, args, options) =>
  nodeSpawn(command, [...args], options) as unknown as RuntimeProcess

export type CodexModel = {
  id: string
  name: string
  reasoning_effort: "high"
  input_modalities: string[]
}

export type CodexChatCompletionRequest = {
  model: string
  effort: "high"
  input: string
}

export type CodexChatCompletion = {
  id: string
  model: string
  content: string
  thread_id: string
  turn_id: string
}

export type CodexRuntimeErrorKind =
  | "configuration"
  | "unavailable"
  | "timeout"
  | "invalid_response"
  | "auth"
  | "model"

export class CodexRuntimeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null = null,
    readonly kind: CodexRuntimeErrorKind = "unavailable"
  ) {
    super(code)
    this.name = "CodexRuntimeError"
  }
}

export type CodexRuntimeLike = {
  connect(
    organizationId: string,
    credentials: CodexCredentialSet
  ): Promise<void>
  disconnect(organizationId: string): Promise<void>
  isConnected(organizationId: string): boolean
  listModels(organizationId: string): Promise<CodexModel[]>
  createChatCompletion(
    organizationId: string,
    request: CodexChatCompletionRequest
  ): Promise<CodexChatCompletion>
}

export type CodexRuntimeOptions = {
  cliPath?: string
  homeRoot?: string
  workspaceRoot?: string
  rpcTimeoutMs?: number
  chatTimeoutMs?: number
  spawn?: CodexSpawnLike
  refreshCredentials?: (
    credentials: CodexCredentialSet
  ) => Promise<CodexCredentialSet>
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

type ActiveTurn = {
  threadId: string
  turnId: string | null
  output: string
  completed: boolean
  resolve: (value: CodexChatCompletion) => void
  reject: (error: unknown) => void
  timer: ReturnType<typeof setTimeout> | null
}

type RuntimeSession = {
  organizationId: string
  homeDir: string
  workspaceDir: string
  process: RuntimeProcess
  credentials: CodexCredentialSet
  pending: Map<number, PendingRequest>
  activeTurn: ActiveTurn | null
  models: CodexModel[]
  modelsFetchedAt: number
  refreshingCredentials: Promise<CodexCredentialSet> | null
  queue: Promise<void>
  closed: boolean
  outputBuffer: string
  decoder: TextDecoder
}

const DEFAULT_RPC_TIMEOUT_MS = 15_000
const DEFAULT_CHAT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 300_000
const MAX_PROMPT_LENGTH = 64_000
const MAX_MODEL_LIST = 100
const MODEL_CACHE_TTL_MS = 60_000
const MAX_MODEL_ID_LENGTH = 128
const MAX_MODEL_NAME_LENGTH = 160
const MAX_RESPONSE_LENGTH = 100_000
const SAFE_MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const stringValue = (value: unknown, maximum = 2_048): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maximum) : null
}

const requiredString = (value: unknown, maximum = 2_048) => {
  const result = stringValue(value, maximum)
  if (!result) throw invalidRuntimeResponse()
  return result
}

const invalidRuntimeResponse = () =>
  new CodexRuntimeError(
    "CODEX_RUNTIME_INVALID_RESPONSE",
    502,
    "invalid_response"
  )

const runtimeUnavailable = () =>
  new CodexRuntimeError("CODEX_RUNTIME_UNAVAILABLE", 503, "unavailable")

const runtimeNotConfigured = () =>
  new CodexRuntimeError("CODEX_RUNTIME_NOT_CONFIGURED", 503, "configuration")

const modelUnavailable = () =>
  new CodexRuntimeError("CODEX_MODEL_UNAVAILABLE", 409, "model")

const chatTimeout = () =>
  new CodexRuntimeError("CODEX_CHAT_TIMEOUT", 504, "timeout")

const chatUnavailable = () =>
  new CodexRuntimeError("CODEX_CHAT_UNAVAILABLE", 502, "unavailable")

const authUnavailable = () =>
  new CodexRuntimeError("CODEX_AUTH_NOT_AUTHORIZED", 409, "auth")

const normalizeTimeout = (value: number | undefined, fallback: number) => {
  const timeout = value ?? fallback
  if (
    !Number.isSafeInteger(timeout) ||
    timeout <= 0 ||
    timeout > MAX_TIMEOUT_MS
  ) {
    throw runtimeNotConfigured()
  }
  return timeout
}

const isWindowsShellScript = (command: string) =>
  process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command)

const WINDOWS_SHELL_METACHARACTERS = /[\u0000\r\n&|<>^()"'`;%!*?$]/

const normalizeCommand = (value: string | undefined) => {
  const command =
    value?.trim() || (process.platform === "win32" ? "codex.cmd" : "codex")
  if (!command || command.length > 2_048 || /[\u0000\r\n]/.test(command)) {
    throw runtimeNotConfigured()
  }
  if (
    isWindowsShellScript(command) &&
    WINDOWS_SHELL_METACHARACTERS.test(command)
  ) {
    throw runtimeNotConfigured()
  }
  return command
}

const normalizeRoot = (value: string | undefined, fallback: string) => {
  const root = value?.trim() || fallback
  if (
    !root ||
    root.length > 2_048 ||
    /[\u0000\r\n]/.test(root) ||
    !isAbsolute(root)
  ) {
    throw runtimeNotConfigured()
  }
  return root
}

const runtimeEnabled = () => {
  const value = process.env.CODEX_RUNTIME_ENABLED?.trim().toLowerCase()
  return value !== "false" && value !== "0" && value !== "no"
}

const hashOrganizationId = (organizationId: string) =>
  createHash("sha256").update(organizationId).digest("hex").slice(0, 32)

const safeEnvironment = (homeDir: string): Record<string, string> => {
  const environment: Record<string, string> = {}
  const inheritedKeys = [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "HOME",
    "USERPROFILE",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "TERM",
  ]

  for (const key of inheritedKeys) {
    const value = process.env[key]
    if (value) environment[key] = value
  }

  environment.CODEX_HOME = homeDir
  environment.NO_COLOR = "1"
  return environment
}

const rpcErrorCode = (error: unknown) => {
  const record = asRecord(error)
  return typeof record?.code === "number" ? record.code : null
}

const rpcErrorMessage = (error: unknown) => {
  const record = asRecord(error)
  return stringValue(record?.message, 512)?.toLowerCase() ?? ""
}

const runtimeRpcError = (error: unknown) => {
  const message = rpcErrorMessage(error)
  const code = rpcErrorCode(error)
  if (
    message.includes("unauthorized") ||
    message.includes("not authenticated") ||
    message.includes("authentication") ||
    code === 401
  ) {
    return authUnavailable()
  }
  return new CodexRuntimeError("CODEX_RUNTIME_UNAVAILABLE", 502, "unavailable")
}

const turnError = (value: unknown) => {
  const record = asRecord(value)
  const error = asRecord(record?.error)
  const info = error?.codexErrorInfo
  const infoText = typeof info === "string" ? info : JSON.stringify(info ?? "")
  const message =
    `${stringValue(error?.message, 512) ?? ""} ${infoText}`.toLowerCase()
  if (message.includes("unauthorized") || message.includes("authentication")) {
    return authUnavailable()
  }
  return chatUnavailable()
}

const notificationThreadId = (params: Record<string, unknown>) =>
  stringValue(params.threadId, 256) ||
  stringValue(asRecord(params.thread)?.id, 256) ||
  stringValue(asRecord(params.turn)?.threadId, 256)

const notificationTurnId = (params: Record<string, unknown>) =>
  stringValue(params.turnId, 256) || stringValue(asRecord(params.turn)?.id, 256)

const notificationMatches = (
  session: RuntimeSession,
  params: Record<string, unknown>
) => {
  const active = session.activeTurn
  if (!active) return false
  const threadId = notificationThreadId(params)
  if (threadId && threadId !== active.threadId) return false
  const turnId = notificationTurnId(params)
  if (active.turnId && turnId && turnId !== active.turnId) return false
  return true
}

const parseModelEfforts = (value: unknown) => {
  if (!Array.isArray(value)) return null
  const efforts: string[] = []
  for (const entry of value) {
    if (typeof entry === "string") efforts.push(entry)
    else {
      const record = asRecord(entry)
      const effort = stringValue(record?.reasoningEffort, 32)
      if (effort) efforts.push(effort)
    }
  }
  return efforts
}

const parseModel = (value: unknown): CodexModel | null => {
  const record = asRecord(value)
  if (!record || record.hidden === true) return null
  const id = stringValue(record.id ?? record.model, MAX_MODEL_ID_LENGTH)
  if (!id || !SAFE_MODEL_ID.test(id)) return null

  const efforts = parseModelEfforts(record.supportedReasoningEfforts)
  if (efforts && !efforts.includes("high")) return null

  const name =
    stringValue(
      record.displayName ?? record.name ?? record.model,
      MAX_MODEL_NAME_LENGTH
    ) || id
  const modalities = Array.isArray(record.inputModalities)
    ? record.inputModalities.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.length > 0
      )
    : ["text", "image"]

  return {
    id,
    name,
    reasoning_effort: "high",
    input_modalities: modalities.slice(0, 8),
  }
}

export class CodexRuntime implements CodexRuntimeLike {
  private readonly cliPath: string
  private readonly homeRoot: string
  private readonly workspaceRoot: string
  private readonly rpcTimeoutMs: number
  private readonly chatTimeoutMs: number
  private readonly spawn: CodexSpawnLike
  private readonly refreshCredentialsCallback:
    ((credentials: CodexCredentialSet) => Promise<CodexCredentialSet>) | null
  private readonly sessions = new Map<string, RuntimeSession>()
  private readonly connecting = new Map<string, Promise<void>>()
  private nextRequestId = 1

  constructor(options: CodexRuntimeOptions = {}) {
    if (!runtimeEnabled()) throw runtimeNotConfigured()

    const homeRoot = normalizeRoot(
      options.homeRoot ?? process.env.CODEX_HOME_ROOT,
      join(tmpdir(), "cloudberry-codex")
    )
    this.cliPath = normalizeCommand(
      options.cliPath ?? process.env.CODEX_CLI_PATH
    )
    this.homeRoot = homeRoot
    this.workspaceRoot = normalizeRoot(
      options.workspaceRoot ?? process.env.CODEX_RUNTIME_WORKSPACE_ROOT,
      join(homeRoot, "workspaces")
    )
    this.rpcTimeoutMs = normalizeTimeout(
      options.rpcTimeoutMs ??
        (process.env.CODEX_RUNTIME_TIMEOUT_MS
          ? Number(process.env.CODEX_RUNTIME_TIMEOUT_MS)
          : undefined),
      DEFAULT_RPC_TIMEOUT_MS
    )
    this.chatTimeoutMs = normalizeTimeout(
      options.chatTimeoutMs ??
        (process.env.CODEX_CHAT_TIMEOUT_MS
          ? Number(process.env.CODEX_CHAT_TIMEOUT_MS)
          : undefined),
      DEFAULT_CHAT_TIMEOUT_MS
    )
    this.spawn = options.spawn ?? spawnProcess
    this.refreshCredentialsCallback = options.refreshCredentials ?? null
  }

  isConnected(organizationId: string) {
    const session = this.sessions.get(organizationId)
    return Boolean(session && !session.closed)
  }

  async connect(
    organizationId: string,
    credentials: CodexCredentialSet
  ): Promise<void> {
    if (
      !organizationId ||
      !credentials.access_token ||
      !credentials.account_id
    ) {
      throw runtimeNotConfigured()
    }

    const existingConnection = this.connecting.get(organizationId)
    if (existingConnection) await existingConnection

    const connection = this.openConnection(organizationId, credentials)
    this.connecting.set(organizationId, connection)
    try {
      await connection
    } finally {
      if (this.connecting.get(organizationId) === connection) {
        this.connecting.delete(organizationId)
      }
    }
  }

  async disconnect(organizationId: string): Promise<void> {
    const session = this.sessions.get(organizationId)
    if (!session) return
    this.sessions.delete(organizationId)
    this.closeSession(session, runtimeUnavailable())
  }

  async listModels(organizationId: string): Promise<CodexModel[]> {
    const session = this.requireSession(organizationId)
    return this.enqueue(session, async () => {
      const models = await this.refreshModels(session)
      return models.map((model) => ({
        ...model,
        input_modalities: [...model.input_modalities],
      }))
    })
  }

  async createChatCompletion(
    organizationId: string,
    request: CodexChatCompletionRequest
  ): Promise<CodexChatCompletion> {
    if (
      !request ||
      typeof request.input !== "string" ||
      request.input.trim().length === 0 ||
      request.input.length > MAX_PROMPT_LENGTH ||
      request.effort !== "high" ||
      typeof request.model !== "string" ||
      !SAFE_MODEL_ID.test(request.model)
    ) {
      throw chatUnavailable()
    }

    const session = this.requireSession(organizationId)
    return this.enqueue(session, async () => {
      const models =
        Date.now() - session.modelsFetchedAt <= MODEL_CACHE_TTL_MS
          ? session.models
          : await this.refreshModels(session)
      if (!models.some((model) => model.id === request.model)) {
        throw modelUnavailable()
      }

      const threadId = await this.startThread(session, request.model)
      try {
        return await this.startTurn(session, threadId, request)
      } finally {
        await this.deleteThread(session, threadId)
      }
    })
  }

  private async openConnection(
    organizationId: string,
    credentials: CodexCredentialSet
  ) {
    const previous = this.sessions.get(organizationId)
    if (previous) {
      this.sessions.delete(organizationId)
      this.closeSession(previous, runtimeUnavailable())
    }

    const hash = hashOrganizationId(organizationId)
    const homeDir = join(this.homeRoot, `organization-${hash}`)
    const workspaceDir = join(this.workspaceRoot, `organization-${hash}`)
    await mkdir(this.homeRoot, { recursive: true, mode: 0o700 })
    await mkdir(this.workspaceRoot, { recursive: true, mode: 0o700 })
    await mkdir(homeDir, { recursive: true, mode: 0o700 })
    await mkdir(workspaceDir, { recursive: true, mode: 0o700 })

    let process: RuntimeProcess
    try {
      process = this.spawn(
        this.cliPath,
        ["app-server", "--listen", "stdio://"],
        {
          cwd: workspaceDir,
          env: safeEnvironment(homeDir),
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
          shell: isWindowsShellScript(this.cliPath),
        }
      )
    } catch {
      throw runtimeUnavailable()
    }

    const session: RuntimeSession = {
      organizationId,
      homeDir,
      workspaceDir,
      process,
      credentials,
      pending: new Map(),
      activeTurn: null,
      models: [],
      modelsFetchedAt: 0,
      refreshingCredentials: null,
      queue: Promise.resolve(),
      closed: false,
      outputBuffer: "",
      decoder: new TextDecoder(),
    }
    this.sessions.set(organizationId, session)
    this.attachProcessHandlers(session)

    try {
      const initialized = asRecord(
        await this.request(session, "initialize", {
          clientInfo: {
            name: "cloudberry",
            title: "Cloudberry",
            version: "0.1.0",
          },
          capabilities: {
            experimentalApi: true,
            requestAttestation: false,
          },
        })
      )
      if (!initialized) throw invalidRuntimeResponse()

      this.notify(session, "initialized", {})
      const login = asRecord(
        await this.request(session, "account/login/start", {
          type: "chatgptAuthTokens",
          accessToken: credentials.access_token,
          chatgptAccountId: credentials.account_id,
          ...(credentials.plan_type
            ? { chatgptPlanType: credentials.plan_type }
            : {}),
        })
      )
      if (login?.type !== "chatgptAuthTokens") {
        throw invalidRuntimeResponse()
      }

      await this.refreshModels(session)
    } catch (error) {
      const failure = this.normalizeError(error)
      this.sessions.delete(organizationId)
      this.closeSession(session, failure)
      throw failure
    }
  }

  private attachProcessHandlers(session: RuntimeSession) {
    session.process.stdout.on("data", (chunk) => {
      if (session.closed) return
      const text =
        typeof chunk === "string"
          ? chunk
          : session.decoder.decode(chunk as Uint8Array, { stream: true })
      this.consumeOutput(session, text)
    })
    session.process.stderr.on("data", () => {
      // Codex diagnostics are intentionally not forwarded or logged. They can
      // contain provider/account details that are not safe for request logs.
    })
    session.process.once("error", () => {
      this.closeSession(session, runtimeUnavailable())
    })
    session.process.once("exit", () => {
      this.closeSession(session, runtimeUnavailable())
    })
  }

  private consumeOutput(session: RuntimeSession, chunk: string) {
    session.outputBuffer += chunk
    while (true) {
      const newline = session.outputBuffer.indexOf("\n")
      if (newline < 0) break
      const line = session.outputBuffer.slice(0, newline).replace(/\r$/, "")
      session.outputBuffer = session.outputBuffer.slice(newline + 1)
      if (!line.trim()) continue

      let message: JsonRpcMessage
      try {
        const parsed: unknown = JSON.parse(line)
        const record = asRecord(parsed)
        if (!record) throw new Error("not an object")
        message = record as JsonRpcMessage
      } catch {
        this.closeSession(session, invalidRuntimeResponse())
        return
      }
      this.handleMessage(session, message)
    }
  }

  private handleMessage(session: RuntimeSession, message: JsonRpcMessage) {
    if (message.id !== undefined && message.method === undefined) {
      if (typeof message.id !== "number" || !Number.isSafeInteger(message.id)) {
        return
      }
      const pending = session.pending.get(message.id)
      if (!pending) return
      session.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error !== undefined)
        pending.reject(runtimeRpcError(message.error))
      else pending.resolve(message.result)
      return
    }

    if (!message.method) return
    if (message.id !== undefined) {
      void this.handleServerRequest(session, message)
      return
    }
    this.handleNotification(
      session,
      message.method,
      asRecord(message.params) ?? {}
    )
  }

  private handleNotification(
    session: RuntimeSession,
    method: string,
    params: Record<string, unknown>
  ) {
    const active = session.activeTurn
    if (!active) return

    if (method === "turn/started") {
      if (!notificationMatches(session, params)) return
      const turnId = notificationTurnId(params)
      if (turnId) active.turnId = turnId
      return
    }

    if (method === "item/agentMessage/delta") {
      if (!notificationMatches(session, params)) return
      const delta = stringValue(params.delta, MAX_RESPONSE_LENGTH)
      if (delta) active.output = `${active.output}${delta}`
      return
    }

    if (method === "item/completed") {
      if (!notificationMatches(session, params)) return
      const item = asRecord(params.item)
      if (item?.type !== "agentMessage") return
      const text = stringValue(item.text, MAX_RESPONSE_LENGTH)
      if (text) active.output = text
      return
    }

    if (method === "turn/completed") {
      if (!notificationMatches(session, params)) return
      const turn = asRecord(params.turn) ?? params
      const turnId = stringValue(turn.id, 256) || active.turnId
      if (turnId) active.turnId = turnId
      const status = stringValue(turn.status, 64)
      if (status !== "completed") {
        this.finishTurn(session, turnError(turn))
        return
      }

      const content = active.output.trim().slice(0, MAX_RESPONSE_LENGTH)
      if (!content) {
        this.finishTurn(
          session,
          new CodexRuntimeError(
            "CODEX_CHAT_EMPTY_RESPONSE",
            502,
            "invalid_response"
          )
        )
        return
      }
      if (!active.turnId) {
        this.finishTurn(session, invalidRuntimeResponse())
        return
      }
      this.finishTurn(session, null, {
        id: active.turnId,
        model: "",
        content,
        thread_id: active.threadId,
        turn_id: active.turnId,
      })
      return
    }

    if (method === "error") {
      if (notificationMatches(session, params)) {
        this.finishTurn(session, turnError(params))
      }
    }
  }

  private async handleServerRequest(
    session: RuntimeSession,
    message: JsonRpcMessage
  ) {
    if (message.id === undefined) return

    if (message.method === "account/chatgptAuthTokens/refresh") {
      if (!this.refreshCredentialsCallback) {
        this.respondError(
          session,
          message.id,
          "Authentication refresh unavailable"
        )
        return
      }

      try {
        const refresh =
          session.refreshingCredentials ??
          (session.refreshingCredentials = this.refreshCredentialsCallback(
            session.credentials
          ))
        const credentials = await refresh
        if (credentials.account_id !== session.credentials.account_id) {
          throw authUnavailable()
        }
        session.credentials = credentials
        if (session.refreshingCredentials === refresh) {
          session.refreshingCredentials = null
        }
        this.respond(session, message.id, {
          accessToken: credentials.access_token,
          chatgptAccountId: credentials.account_id,
          ...(credentials.plan_type
            ? { chatgptPlanType: credentials.plan_type }
            : {}),
        })
      } catch {
        session.refreshingCredentials = null
        this.respondError(session, message.id, "Authentication refresh failed")
      }
      return
    }

    if (
      message.method === "item/commandExecution/requestApproval" ||
      message.method === "item/fileChange/requestApproval"
    ) {
      this.respond(session, message.id, { decision: "decline" })
      return
    }

    if (
      message.method === "execCommandApproval" ||
      message.method === "applyPatchApproval"
    ) {
      this.respond(session, message.id, {
        decision: {
          denied: {
            rejection:
              "Cloudberry does not permit Codex command or file changes",
          },
        },
      })
      return
    }

    if (message.method === "item/permissions/requestApproval") {
      this.respond(session, message.id, {
        permissions: {},
        scope: "turn",
      })
      return
    }

    if (message.method === "item/tool/requestUserInput") {
      this.respond(session, message.id, { answers: {} })
      return
    }

    if (message.method === "item/tool/call") {
      this.respond(session, message.id, { contentItems: [], success: false })
      return
    }

    if (message.method === "mcpServer/elicitation/request") {
      this.respond(session, message.id, {
        action: "decline",
        content: null,
        _meta: null,
      })
      return
    }

    if (message.method === "currentTime/read") {
      this.respond(session, message.id, {
        currentTimeAt: Math.floor(Date.now() / 1_000),
      })
      return
    }

    this.respondError(
      session,
      message.id,
      "This Codex operation is unavailable"
    )
  }

  private finishTurn(
    session: RuntimeSession,
    error: unknown,
    result?: CodexChatCompletion
  ) {
    const active = session.activeTurn
    if (!active || active.completed) return
    active.completed = true
    if (active.timer) clearTimeout(active.timer)
    if (error) active.reject(error)
    else if (result) active.resolve(result)
    else active.reject(chatUnavailable())
  }

  private async startThread(session: RuntimeSession, model: string) {
    const result = asRecord(
      await this.request(session, "thread/start", {
        model,
        cwd: session.workspaceDir,
        runtimeWorkspaceRoots: [session.workspaceDir],
        approvalPolicy: "never",
        sandbox: "read-only",
        ephemeral: true,
        serviceName: "cloudberry",
      })
    )
    const thread = asRecord(result?.thread)
    return requiredString(thread?.id, 256)
  }

  private async startTurn(
    session: RuntimeSession,
    threadId: string,
    request: CodexChatCompletionRequest
  ): Promise<CodexChatCompletion> {
    let resolveTurn: (value: CodexChatCompletion) => void = () => {}
    let rejectTurn: (error: unknown) => void = () => {}
    const completion = new Promise<CodexChatCompletion>((resolve, reject) => {
      resolveTurn = resolve
      rejectTurn = reject
    })
    const active: ActiveTurn = {
      threadId,
      turnId: null,
      output: "",
      completed: false,
      resolve: resolveTurn,
      reject: rejectTurn,
      timer: null,
    }
    session.activeTurn = active

    try {
      const response = asRecord(
        await this.request(
          session,
          "turn/start",
          {
            threadId,
            input: [{ type: "text", text: request.input, text_elements: [] }],
            cwd: session.workspaceDir,
            runtimeWorkspaceRoots: [session.workspaceDir],
            approvalPolicy: "never",
            sandboxPolicy: { type: "readOnly", networkAccess: false },
            model: request.model,
            effort: request.effort,
          },
          this.chatTimeoutMs
        )
      )
      const turn = asRecord(response?.turn)
      const turnId = stringValue(turn?.id, 256)
      if (!turnId) throw invalidRuntimeResponse()
      active.turnId = turnId
      active.timer = setTimeout(() => {
        this.finishTurn(session, chatTimeout())
      }, this.chatTimeoutMs)

      const result = await completion
      return { ...result, model: request.model }
    } catch (error) {
      if (error instanceof CodexRuntimeError) throw error
      throw this.normalizeError(error)
    } finally {
      if (active.timer) clearTimeout(active.timer)
      if (session.activeTurn === active) session.activeTurn = null
    }
  }

  private async deleteThread(session: RuntimeSession, threadId: string) {
    if (session.closed) return
    try {
      await this.request(
        session,
        "thread/delete",
        { threadId },
        this.rpcTimeoutMs
      )
    } catch {
      // Thread cleanup is best effort. Cloudberry remains the source of chat
      // history, while the app-server workspace stays isolated per account.
    }
  }

  private async refreshModels(session: RuntimeSession): Promise<CodexModel[]> {
    const result = asRecord(
      await this.request(session, "model/list", {
        limit: MAX_MODEL_LIST,
        includeHidden: false,
      })
    )
    const values = result?.data
    if (!Array.isArray(values)) throw invalidRuntimeResponse()
    const models = values
      .map(parseModel)
      .filter((model): model is CodexModel => Boolean(model))
    if (!models.length) throw modelUnavailable()
    session.models = models
    session.modelsFetchedAt = Date.now()
    return models
  }

  private requireSession(organizationId: string) {
    const session = this.sessions.get(organizationId)
    if (!session || session.closed) throw runtimeUnavailable()
    return session
  }

  private enqueue<T>(
    session: RuntimeSession,
    operation: () => Promise<T>
  ): Promise<T> {
    const next = session.queue.then(operation, operation)
    session.queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  private request(
    session: RuntimeSession,
    method: string,
    params: unknown,
    timeoutMs = this.rpcTimeoutMs
  ): Promise<unknown> {
    if (session.closed) return Promise.reject(runtimeUnavailable())
    const id = this.nextRequestId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        session.pending.delete(id)
        reject(new CodexRuntimeError("CODEX_RUNTIME_TIMEOUT", 504, "timeout"))
      }, timeoutMs)
      session.pending.set(id, { resolve, reject, timer })
      try {
        this.respond(session, id, undefined, method, params)
      } catch {
        session.pending.delete(id)
        clearTimeout(timer)
        reject(runtimeUnavailable())
      }
    })
  }

  private notify(session: RuntimeSession, method: string, params: unknown) {
    this.respond(session, undefined, undefined, method, params)
  }

  private respond(
    session: RuntimeSession,
    id: JsonRpcId | undefined,
    result: unknown,
    method?: string,
    params?: unknown
  ) {
    if (session.closed || session.process.stdin.destroyed) {
      throw runtimeUnavailable()
    }
    const message: Record<string, unknown> = {}
    if (method) message.method = method
    if (id !== undefined) message.id = id
    if (result !== undefined && id !== undefined) message.result = result
    if (params !== undefined) message.params = params
    session.process.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private respondError(
    session: RuntimeSession,
    id: JsonRpcId,
    message: string
  ) {
    if (session.closed) return
    try {
      session.process.stdin.write(
        `${JSON.stringify({ id, error: { code: -32000, message } })}\n`
      )
    } catch {
      this.closeSession(session, runtimeUnavailable())
    }
  }

  private normalizeError(error: unknown) {
    if (error instanceof CodexRuntimeError) return error
    return runtimeUnavailable()
  }

  private closeSession(session: RuntimeSession, error: CodexRuntimeError) {
    if (session.closed) return
    session.closed = true
    for (const pending of session.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    session.pending.clear()
    if (session.activeTurn && !session.activeTurn.completed) {
      this.finishTurn(session, error)
    }
    try {
      session.process.stdin.end()
    } catch {}
    try {
      session.process.kill()
    } catch {}
    if (this.sessions.get(session.organizationId) === session) {
      this.sessions.delete(session.organizationId)
    }
  }
}
