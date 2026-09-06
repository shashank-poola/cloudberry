import { apiRequest, BrowserApiError } from "../client"

const computerPath = "/computer"
const provisionComputerPath = "/computer/provision"

const computerPollIntervalMs = 1_000
const computerPollLimit = 90

export type PrizedComputer = {
  id: string | null
  status: string
  provider: string | null
  boxId: string | null
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
