import type { SupabaseClient } from "@supabase/supabase-js"

import {
  PrizedClientError,
  type PrizedBox,
  type PrizedClient,
} from "../prized/client"
import type { ProvisionRequest } from "./validation"

const COMPUTER_TABLE = "organization_computers"

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

type ComputerRecord = {
  id: string | null
  organizationId: string
  boxId: string
  edgeUrl: string
  status: string
  metadata: SafeMetadata
  createdAt: string | null
  updatedAt: string | null
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

export type ComputerStatus = {
  computer: PublicComputer | null
  box: PublicBox | null
}

export type ProvisionResult = {
  computer: PublicComputer
  box: PublicBox
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
}

export type ComputerServiceLike = {
  getStatus(organizationId: string): Promise<ComputerStatus>
  provisionOrWake(
    organizationId: string,
    request: ProvisionRequest
  ): Promise<ProvisionResult>
}

const asRecord = (value: unknown): DatabaseRow => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ComputerServiceError("COMPUTER_STORAGE_FAILED", 503)
  }

  return value as DatabaseRow
}

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

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

  private async saveComputer(
    organizationId: string,
    existing: ComputerRecord | null,
    edgeUrl: string,
    box: PrizedBox
  ): Promise<ComputerRecord> {
    const metadata = {
      ...existing?.metadata,
      ...summarizeBoxMetadata(box),
    }
    delete metadata.codex_connected

    const values: DatabaseRow = {
      organization_id: organizationId,
      provider: "prized",
      external_box_id: box.id,
      edge_url: edgeUrl,
      status: normalizedBoxState(box),
      metadata,
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
  delete metadata.codex_connected
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
  }
}
