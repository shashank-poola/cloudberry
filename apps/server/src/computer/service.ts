import type { SupabaseClient } from "@supabase/supabase-js"

import {
  PrizedClient,
  PrizedClientError,
  type PrizedBox,
  type PrizedInterruptResponse,
  type PrizedPromptEvent,
  type PrizedPromptRun,
  type PrizedPromptStarted,
} from "../prized/client"
import { formatKnowledgeContext, buildCodexPrompt } from "./context"
import { KnowledgeClient, KNOWLEDGE_QUERY_MAX_LENGTH } from "./knowledge"
import type { CodexSessionRequest, ProvisionRequest } from "./validation"

const COMPUTER_TABLE = "organization_computers"
const CODEX_SESSION_TABLE = "codex_sessions"
const MAX_PUBLIC_EVENT_TEXT_LENGTH = 16_000

const BOX_METADATA_FIELDS = [
  "hostname",
  "tier",
  "desiredState",
  "observedState",
  "region",
  "createdAt",
  "updatedAt",
] as const

type DatabaseRow = Record<string, unknown>
export type SafeMetadata = Record<string, string | number | boolean | null>
export type CodexSessionState =
  "queued" | "running" | "succeeded" | "failed" | "cancelled"

type ComputerRecord = {
  id: string | null
  organizationId: string
  boxId: string
  edgeUrl: string
  status: string
  metadata: SafeMetadata
  createdAt: string | null
  updatedAt: string | null
  raw: DatabaseRow
}

type SessionRecord = {
  id: string
  organizationId: string
  computerId: string | null
  runId: string | null
  status: CodexSessionState
  cwd: string | null
  metadata: SafeMetadata
  lastEventSequence: number
  lastError: string | null
  createdAt: string | null
  updatedAt: string | null
  raw: DatabaseRow
}

export type PublicComputer = {
  id: string | null
  organization_id: string
  provider: "prized"
  box_id: string
  status: string
  metadata: SafeMetadata
  created_at: string | null
  updated_at: string | null
}

export type PublicBox = {
  id: string
  hostname?: string
  tier?: string
  desiredState?: string
  observedState?: string
  region?: string
}

export type PublicSession = {
  id: string
  organization_id: string
  computer_id: string | null
  provider: "codex"
  run_id: string | null
  status: CodexSessionState
  cwd: string | null
  error: string | null
  metadata: SafeMetadata
  created_at: string | null
  updated_at: string | null
}

export type PublicRun = {
  id: string
  provider?: string
  model?: string | null
  reasoningEffort?: string | null
  auto?: boolean
  status?: string
  exitCode?: number | null
  pid?: number | null
  cwd?: string
  startedAt?: string | null
  finishedAt?: string | null
  sessionId?: string | null
  resumedFrom?: string | null
  parent?: string | null
  eventCount?: number
}

export type PublicPromptEvent = {
  seq: number
  at: string
  type: string
  text?: string
  tool?: { name?: string } | null
}

export type PublicInterrupt = {
  id: string
  wasRunning?: boolean
  signal?: string
}

export type ComputerStatus = {
  computer: PublicComputer | null
  box: PublicBox | null
}

export type ProvisionResult = {
  computer: PublicComputer
  box: PublicBox
}

export type CodexSessionResult = {
  session: PublicSession
  run: PublicRun | null
  queued: boolean
  active: PublicRun | null
}

export type CodexSessionStatusResult = {
  session: PublicSession
  run: PublicRun | null
}

export type CodexSessionEventsResult = {
  session: PublicSession
  run: PublicRun | null
  events: PublicPromptEvent[]
  next: number
  finished: boolean
}

export type CodexInterruptResult = {
  session: PublicSession
  interrupt: PublicInterrupt
}

export class ComputerServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code)
    this.name = "ComputerServiceError"
  }
}

export type ComputerServiceDependencies = {
  database: SupabaseClient
  prized: PrizedClient
  knowledge: KnowledgeClient
}

export type ComputerServiceLike = {
  getStatus(organizationId: string): Promise<ComputerStatus>
  provisionOrWake(
    organizationId: string,
    request: ProvisionRequest
  ): Promise<ProvisionResult>
  createCodexSession(
    organizationId: string,
    request: CodexSessionRequest
  ): Promise<CodexSessionResult>
  getCodexSession(
    organizationId: string,
    sessionId: string
  ): Promise<CodexSessionStatusResult>
  getCodexSessionEvents(
    organizationId: string,
    sessionId: string,
    after?: number
  ): Promise<CodexSessionEventsResult>
  interruptCodexSession(
    organizationId: string,
    sessionId: string
  ): Promise<CodexInterruptResult>
}

const asRecord = (value: unknown): DatabaseRow => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
  }

  return value as DatabaseRow
}

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const numberValue = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null

const safeErrorCode = (value: unknown): string | null => {
  const error = stringValue(value)
  return error && /^[A-Z0-9_]{1,128}$/.test(error) ? error : null
}

const safeMetadata = (value: unknown): SafeMetadata => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  const metadata: SafeMetadata = {}
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
    ) {
      metadata[key] = entry
    }
  }

  return metadata
}

const summarizeBox = (box: PrizedBox): PublicBox => {
  const summary: PublicBox = { id: box.id }
  for (const field of [
    "hostname",
    "tier",
    "desiredState",
    "observedState",
    "region",
  ] as const) {
    const value = box[field]
    if (typeof value === "string") summary[field] = value
  }

  return summary
}

const summarizeBoxMetadata = (box: PrizedBox): SafeMetadata => {
  const metadata: SafeMetadata = {}
  for (const field of BOX_METADATA_FIELDS) {
    const value = box[field]
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      metadata[field] = value
    }
  }

  return metadata
}

const summarizeRun = (run: PrizedPromptRun | undefined): PublicRun | null => {
  if (!run) return null

  const summary: PublicRun = { id: run.id }
  for (const field of [
    "provider",
    "model",
    "reasoningEffort",
    "auto",
    "status",
    "exitCode",
    "pid",
    "cwd",
    "startedAt",
    "finishedAt",
    "sessionId",
    "resumedFrom",
    "parent",
    "eventCount",
  ] as const) {
    const value = run[field]
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      ;(summary as Record<string, unknown>)[field] = value
    }
  }

  return summary
}

const eventText = (value: unknown, depth = 0): string | null => {
  if (depth > 4) return null
  if (typeof value === "string" && value.trim()) return value

  if (Array.isArray(value)) {
    const text = value
      .map((part) => eventText(part, depth + 1))
      .filter((part): part is string => Boolean(part))
      .join("")
    return text || null
  }

  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  for (const key of ["text", "delta", "output_text", "content", "value"]) {
    const text = eventText(record[key], depth + 1)
    if (text) return text
  }

  return null
}

const summarizeEvent = (event: PrizedPromptEvent): PublicPromptEvent => {
  const summary: PublicPromptEvent = {
    seq: event.seq,
    at: event.at,
    type: event.type,
  }
  const text = eventText(event.text ?? event.raw)
  if (text) summary.text = text.slice(0, MAX_PUBLIC_EVENT_TEXT_LENGTH)

  if (event.tool && typeof event.tool.name === "string") {
    summary.tool = { name: event.tool.name.slice(0, 128) }
  }

  return summary
}

const stateOfBox = (box: PrizedBox) =>
  stringValue(box.observedState) ||
  stringValue(box.desiredState) ||
  stringValue(box.observed_state) ||
  stringValue(box.desired_state) ||
  "unknown"

const normalizedBoxState = (box: PrizedBox) =>
  stateOfBox(box)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

const shouldWake = (box: PrizedBox) =>
  ![
    "running",
    "ready",
    "active",
    "available",
    "online",
    "connected",
    "requested",
    "provisioning",
    "bootstrapping",
    "waking",
    "resizing",
    "migrating",
  ].includes(normalizedBoxState(box))

const isNotFound = (error: unknown) =>
  error instanceof PrizedClientError && error.status === 404

const publicComputer = (computer: ComputerRecord): PublicComputer => ({
  id: computer.id,
  organization_id: computer.organizationId,
  provider: "prized",
  box_id: computer.boxId,
  status: computer.status,
  metadata: computer.metadata,
  created_at: computer.createdAt,
  updated_at: computer.updatedAt,
})

const publicSession = (session: SessionRecord): PublicSession => ({
  id: session.id,
  organization_id: session.organizationId,
  computer_id: session.computerId,
  provider: "codex",
  run_id: session.runId,
  status: session.status,
  cwd: session.cwd,
  error: session.lastError,
  metadata: session.metadata,
  created_at: session.createdAt,
  updated_at: session.updatedAt,
})

const terminalStatus = (status: CodexSessionState) =>
  status === "succeeded" || status === "failed" || status === "cancelled"

export const normalizeCodexStatus = (
  status: string | undefined,
  fallback: CodexSessionState = "queued"
): CodexSessionState => {
  switch (status?.toLowerCase().replace(/[\s-]+/g, "_")) {
    case "running":
    case "active":
    case "started":
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
    case "stopped":
      return "cancelled"
    case "queued":
    case "pending":
    case "created":
    case "accepted":
      return "queued"
    default:
      return fallback
  }
}

const sessionError = (status: CodexSessionState) => {
  if (status === "failed") return "CODEX_RUN_FAILED"
  if (status === "cancelled") return "CODEX_RUN_CANCELLED"
  return null
}

const sessionStatus = (
  run: PrizedPromptRun | undefined,
  fallback: CodexSessionState
) => normalizeCodexStatus(stringValue(run?.status) ?? undefined, fallback)

const interruptMetadata = (
  interrupt: PrizedInterruptResponse
): SafeMetadata => {
  const metadata: SafeMetadata = {}
  if (typeof interrupt.wasRunning === "boolean") {
    metadata.was_running = interrupt.wasRunning
  }
  if (typeof interrupt.signal === "string") {
    metadata.signal = interrupt.signal.slice(0, 64)
  }
  return metadata
}

const publicInterrupt = (
  interrupt: PrizedInterruptResponse
): PublicInterrupt => {
  const result: PublicInterrupt = { id: interrupt.id }
  if (typeof interrupt.wasRunning === "boolean") {
    result.wasRunning = interrupt.wasRunning
  }
  if (typeof interrupt.signal === "string") {
    result.signal = interrupt.signal.slice(0, 64)
  }
  return result
}

const runMetadata = (run: PrizedPromptRun): SafeMetadata => {
  const metadata: SafeMetadata = {}
  const status = stringValue(run.status)
  if (status) metadata.provider_status = status.slice(0, 64)
  if (
    typeof run.eventCount === "number" &&
    Number.isSafeInteger(run.eventCount)
  ) {
    metadata.event_count = run.eventCount
  }
  return metadata
}

const sanitizeActiveRun = (active: unknown): PublicRun | null => {
  if (typeof active !== "object" || active === null || Array.isArray(active)) {
    return null
  }

  const record = active as Record<string, unknown>
  const id = stringValue(record.id ?? record.run_id)
  return id ? summarizeRun({ ...record, id } as PrizedPromptRun) : null
}

const defaultBoxName = (organizationId: string) =>
  `cloudberry-${organizationId
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 20)
    .toLowerCase()}`

const boxRequest = (organizationId: string, request: ProvisionRequest) => {
  const body: Record<string, unknown> = {
    name: request.name || defaultBoxName(organizationId),
  }
  if (request.tier !== undefined) body.tier = request.tier
  if (request.ttlMinutes !== undefined) body.ttlMinutes = request.ttlMinutes
  if (request.autoPauseMin !== undefined)
    body.autoPauseMin = request.autoPauseMin
  return body
}

export class ComputerService {
  constructor(private readonly dependencies: ComputerServiceDependencies) {}

  async getStatus(organizationId: string): Promise<ComputerStatus> {
    const computer = await this.findComputer(organizationId)
    if (!computer) return { computer: null, box: null }

    try {
      const detail = await this.dependencies.prized.getBox(computer.boxId)
      const updated = await this.saveComputer(
        organizationId,
        computer,
        computer.edgeUrl,
        detail.box
      )

      return {
        computer: publicComputer(updated),
        box: summarizeBox(detail.box),
      }
    } catch (error) {
      if (!isNotFound(error)) throw error

      return {
        computer: publicComputer({
          ...computer,
          status: "error",
          metadata: { ...computer.metadata, error_code: "COMPUTER_NOT_FOUND" },
        }),
        box: null,
      }
    }
  }

  async provisionOrWake(
    organizationId: string,
    request: ProvisionRequest
  ): Promise<ProvisionResult> {
    let computer = await this.findComputer(organizationId)
    const me = await this.dependencies.prized.getMe()
    let box: PrizedBox

    if (!computer) {
      box = (
        await this.dependencies.prized.createBox(
          boxRequest(organizationId, request)
        )
      ).box
    } else {
      try {
        box = (await this.dependencies.prized.getBox(computer.boxId)).box
        if (shouldWake(box)) {
          box = (await this.dependencies.prized.wakeBox(computer.boxId)).box
        }
      } catch (error) {
        if (!isNotFound(error)) throw error
        box = (
          await this.dependencies.prized.createBox(
            boxRequest(organizationId, request)
          )
        ).box
      }
    }

    computer = await this.saveComputer(
      organizationId,
      computer,
      me.edge.url,
      box
    )

    return { computer: publicComputer(computer), box: summarizeBox(box) }
  }

  async createCodexSession(
    organizationId: string,
    request: CodexSessionRequest
  ): Promise<CodexSessionResult> {
    const computer = await this.ensureComputer(organizationId)
    const me = await this.dependencies.prized.getMe()
    const searchQuery = request.prompt.slice(0, KNOWLEDGE_QUERY_MAX_LENGTH)
    const knowledge = await this.dependencies.knowledge.search(
      organizationId,
      searchQuery
    )
    const referenceContext = formatKnowledgeContext(knowledge.results)
    const prompt = buildCodexPrompt(request.prompt, referenceContext)
    let started: PrizedPromptStarted
    try {
      started = await this.dependencies.prized.postCodexPrompt(
        me.edge.url,
        computer.boxId,
        {
          prompt,
          cwd: request.cwd,
          continue: request.continue,
          queue: false,
        }
      )
    } catch (error) {
      if (
        error instanceof PrizedClientError &&
        error.providerCode === "provider_not_signed_in"
      ) {
        try {
          await this.setCodexConnection(organizationId, computer, false)
        } catch {
          // Preserve the provider authentication error when state persistence fails.
        }
      }
      throw error
    }
    const runId = started.run?.id

    if (!runId) {
      throw new ComputerServiceError(
        started.queued ? "CODEX_BUSY" : "CODEX_START_FAILED",
        started.queued ? 409 : 502
      )
    }

    const initialStatus = sessionStatus(
      started.run,
      started.queued ? "queued" : "running"
    )
    const sessionValues = {
      runId,
      status: initialStatus,
      cwd: request.cwd || null,
      metadata: {
        queued: started.queued === true,
        ...runMetadata(started.run as PrizedPromptRun),
      },
    }

    let session: SessionRecord
    try {
      session = await this.insertSession(
        organizationId,
        computer,
        sessionValues
      )
    } catch (error) {
      await this.interruptRemoteRun(me.edge.url, computer.boxId, runId)
      throw error
    }

    try {
      await this.setCodexConnection(organizationId, computer, true)
    } catch {
      // A successful session remains usable if the optional UI state cannot persist.
    }

    return {
      session: publicSession(session),
      run: summarizeRun(started.run),
      queued: started.queued === true,
      active: sanitizeActiveRun(started.active),
    }
  }

  async getCodexSession(
    organizationId: string,
    sessionId: string
  ): Promise<CodexSessionStatusResult> {
    const session = await this.requireSession(organizationId, sessionId)
    if (!session.runId) return { session: publicSession(session), run: null }

    const computer = await this.requireComputer(
      organizationId,
      session.computerId
    )
    const me = await this.dependencies.prized.getMe()

    try {
      const status = await this.dependencies.prized.getPromptStatus(
        me.edge.url,
        computer.boxId,
        session.runId
      )
      const nextStatus = sessionStatus(status.run, session.status)
      const updated = await this.updateSession(organizationId, session, {
        status: nextStatus,
        metadata: { ...session.metadata, ...runMetadata(status.run) },
        lastError: sessionError(nextStatus),
      })

      return { session: publicSession(updated), run: summarizeRun(status.run) }
    } catch (error) {
      if (!isNotFound(error)) throw error

      const updated = await this.updateSession(organizationId, session, {
        status: "failed",
        metadata: { ...session.metadata, error_code: "CODEX_RUN_NOT_FOUND" },
        lastError: "CODEX_RUN_NOT_FOUND",
      })
      return { session: publicSession(updated), run: null }
    }
  }

  async getCodexSessionEvents(
    organizationId: string,
    sessionId: string,
    after?: number
  ): Promise<CodexSessionEventsResult> {
    const session = await this.requireSession(organizationId, sessionId)
    const cursor = after ?? session.lastEventSequence
    if (!session.runId) {
      return {
        session: publicSession(session),
        run: null,
        events: [],
        next: cursor,
        finished: terminalStatus(session.status),
      }
    }

    const computer = await this.requireComputer(
      organizationId,
      session.computerId
    )
    const me = await this.dependencies.prized.getMe()

    try {
      const events = await this.dependencies.prized.getPromptEvents(
        me.edge.url,
        computer.boxId,
        session.runId,
        cursor
      )
      const providerStatus = stringValue(events.run?.status)
      const nextStatus =
        events.finished && !providerStatus
          ? "succeeded"
          : sessionStatus(events.run, session.status)
      const updated = await this.updateSession(organizationId, session, {
        status: nextStatus,
        metadata: events.run
          ? { ...session.metadata, ...runMetadata(events.run) }
          : session.metadata,
        lastEventSequence: Math.max(session.lastEventSequence, events.next),
        lastError: sessionError(nextStatus),
      })

      return {
        session: publicSession(updated),
        run: summarizeRun(events.run),
        events: events.events.map(summarizeEvent),
        next: events.next,
        finished: events.finished || terminalStatus(nextStatus),
      }
    } catch (error) {
      if (!isNotFound(error)) throw error

      const updated = await this.updateSession(organizationId, session, {
        status: "failed",
        metadata: { ...session.metadata, error_code: "CODEX_RUN_NOT_FOUND" },
        lastError: "CODEX_RUN_NOT_FOUND",
      })
      return {
        session: publicSession(updated),
        run: null,
        events: [],
        next: cursor,
        finished: true,
      }
    }
  }

  async interruptCodexSession(
    organizationId: string,
    sessionId: string
  ): Promise<CodexInterruptResult> {
    const session = await this.requireSession(organizationId, sessionId)
    if (!session.runId) {
      throw new ComputerServiceError("SESSION_NOT_STARTED", 409)
    }
    if (terminalStatus(session.status)) {
      throw new ComputerServiceError("SESSION_NOT_RUNNING", 409)
    }

    const computer = await this.requireComputer(
      organizationId,
      session.computerId
    )
    const me = await this.dependencies.prized.getMe()
    const interrupt = await this.dependencies.prized.interruptPrompt(
      me.edge.url,
      computer.boxId,
      session.runId
    )
    const updated = await this.updateSession(organizationId, session, {
      status: "cancelled",
      metadata: { ...session.metadata, ...interruptMetadata(interrupt) },
      lastError: "CODEX_RUN_CANCELLED",
    })

    return {
      session: publicSession(updated),
      interrupt: publicInterrupt(interrupt),
    }
  }

  private async ensureComputer(
    organizationId: string
  ): Promise<ComputerRecord> {
    const computer = await this.requireComputer(organizationId)

    try {
      const detail = await this.dependencies.prized.getBox(computer.boxId)
      if (!shouldWake(detail.box)) return computer

      const me = await this.dependencies.prized.getMe()
      const box = (await this.dependencies.prized.wakeBox(computer.boxId)).box
      return this.saveComputer(organizationId, computer, me.edge.url, box)
    } catch (error) {
      if (isNotFound(error)) {
        throw new ComputerServiceError("COMPUTER_NOT_PROVISIONED", 409)
      }
      throw error
    }
  }

  private async interruptRemoteRun(
    edgeUrl: string,
    boxId: string,
    runId: string
  ) {
    try {
      await this.dependencies.prized.interruptPrompt(edgeUrl, boxId, runId)
    } catch {
      // The database failure is the actionable error. Avoid masking it with a
      // best-effort cleanup failure and never log provider response contents.
    }
  }

  private async findComputer(
    organizationId: string
  ): Promise<ComputerRecord | null> {
    try {
      const query = this.dependencies.database
        .from(COMPUTER_TABLE)
        .select("*")
        .eq("organization_id", organizationId)
        .limit(1)
      const { data, error } = await query.maybeSingle()

      if (error) throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
      if (!data) return null
      return parseComputer(data, organizationId)
    } catch (error) {
      if (error instanceof ComputerServiceError) throw error
      throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
    }
  }

  private async requireComputer(
    organizationId: string,
    computerId?: string | null
  ): Promise<ComputerRecord> {
    const computer = await this.findComputer(organizationId)
    if (
      !computer ||
      (computerId && computer.id && computer.id !== computerId)
    ) {
      throw new ComputerServiceError("COMPUTER_NOT_PROVISIONED", 409)
    }
    return computer
  }

  private async saveComputer(
    organizationId: string,
    existing: ComputerRecord | null,
    edgeUrl: string,
    box: PrizedBox
  ): Promise<ComputerRecord> {
    const values: DatabaseRow = {
      organization_id: organizationId,
      provider: "prized",
      external_box_id: box.id,
      edge_url: edgeUrl,
      status: normalizedBoxState(box),
      metadata: { ...existing?.metadata, ...summarizeBoxMetadata(box) },
    }

    try {
      let query
      if (existing?.id) {
        query = this.dependencies.database
          .from(COMPUTER_TABLE)
          .update(values)
          .eq("id", existing.id)
          .eq("organization_id", organizationId)
      } else {
        query = this.dependencies.database.from(COMPUTER_TABLE).insert(values)
      }

      const { data, error } = await query.select("*").single()
      if (error || !data) {
        throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
      }
      return parseComputer(data, organizationId)
    } catch (error) {
      if (error instanceof ComputerServiceError) throw error
      throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
    }
  }

  private async setCodexConnection(
    organizationId: string,
    computer: ComputerRecord,
    connected: boolean
  ) {
    if (!computer.id) return

    try {
      const { error } = await this.dependencies.database
        .from(COMPUTER_TABLE)
        .update({
          metadata: { ...computer.metadata, codex_connected: connected },
        })
        .eq("id", computer.id)
        .eq("organization_id", organizationId)

      if (error) {
        throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
      }
    } catch (error) {
      if (error instanceof ComputerServiceError) throw error
      throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
    }
  }

  private async insertSession(
    organizationId: string,
    computer: ComputerRecord,
    values: {
      runId: string
      status: CodexSessionState
      cwd: string | null
      metadata: SafeMetadata
    }
  ): Promise<SessionRecord> {
    const row: DatabaseRow = {
      organization_id: organizationId,
      computer_id: computer.id,
      provider: "codex",
      external_run_id: values.runId,
      status: values.status,
      cwd: values.cwd,
      metadata: values.metadata,
    }

    try {
      const { data, error } = await this.dependencies.database
        .from(CODEX_SESSION_TABLE)
        .insert(row)
        .select("*")
        .single()

      if (error || !data) {
        throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
      }
      return parseSession(data, organizationId)
    } catch (error) {
      if (error instanceof ComputerServiceError) throw error
      throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
    }
  }

  private async requireSession(
    organizationId: string,
    sessionId: string
  ): Promise<SessionRecord> {
    try {
      const query = this.dependencies.database
        .from(CODEX_SESSION_TABLE)
        .select("*")
        .eq("id", sessionId)
        .eq("organization_id", organizationId)
        .limit(1)
      const { data, error } = await query.maybeSingle()

      if (error) throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
      if (!data) throw new ComputerServiceError("SESSION_NOT_FOUND", 404)
      return parseSession(data, organizationId)
    } catch (error) {
      if (error instanceof ComputerServiceError) throw error
      throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
    }
  }

  private async updateSession(
    organizationId: string,
    existing: SessionRecord,
    values: {
      status: CodexSessionState
      metadata: SafeMetadata
      lastEventSequence?: number
      lastError?: string | null
    }
  ): Promise<SessionRecord> {
    try {
      const { data, error } = await this.dependencies.database
        .from(CODEX_SESSION_TABLE)
        .update({
          status: values.status,
          metadata: values.metadata,
          ...(values.lastEventSequence === undefined
            ? {}
            : { last_event_sequence: values.lastEventSequence }),
          ...(values.lastError === undefined
            ? {}
            : { last_error: values.lastError }),
        })
        .eq("id", existing.id)
        .eq("organization_id", organizationId)
        .select("*")
        .single()

      if (error || !data) {
        throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
      }
      return parseSession(data, organizationId)
    } catch (error) {
      if (error instanceof ComputerServiceError) throw error
      throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
    }
  }
}

const parseComputer = (
  value: unknown,
  organizationId: string
): ComputerRecord => {
  const raw = asRecord(value)
  const storedOrganizationId =
    stringValue(raw.organization_id) || organizationId
  if (storedOrganizationId !== organizationId) {
    throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
  }

  const metadata = safeMetadata(raw.metadata)
  const boxId =
    stringValue(raw.external_box_id) ||
    stringValue(raw.box_id) ||
    stringValue(raw.prized_box_id) ||
    stringValue(metadata.box_id)
  const edgeUrl = stringValue(raw.edge_url) || stringValue(metadata.edge_url)

  if (!boxId || !edgeUrl) {
    throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
  }

  return {
    id: stringValue(raw.id),
    organizationId: storedOrganizationId,
    boxId,
    edgeUrl,
    status: stringValue(raw.status) || "unknown",
    metadata,
    createdAt: stringValue(raw.created_at),
    updatedAt: stringValue(raw.updated_at),
    raw,
  }
}

const parseSession = (
  value: unknown,
  organizationId: string
): SessionRecord => {
  const raw = asRecord(value)
  const storedOrganizationId =
    stringValue(raw.organization_id) || organizationId
  if (storedOrganizationId !== organizationId) {
    throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
  }

  const metadata = safeMetadata(raw.metadata)
  const id = stringValue(raw.id)
  if (!id) throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)

  const runId =
    stringValue(raw.external_run_id) ||
    stringValue(raw.run_id) ||
    stringValue(raw.prized_run_id) ||
    stringValue(metadata.run_id)
  const status = normalizeCodexStatus(stringValue(raw.status) ?? undefined)
  const lastEventSequence = numberValue(raw.last_event_sequence) ?? 0

  return {
    id,
    organizationId: storedOrganizationId,
    computerId:
      stringValue(raw.computer_id) || stringValue(raw.organization_computer_id),
    runId,
    status,
    cwd: stringValue(raw.cwd),
    metadata,
    lastEventSequence,
    lastError: safeErrorCode(raw.last_error),
    createdAt: stringValue(raw.created_at),
    updatedAt: stringValue(raw.updated_at),
    raw,
  }
}
