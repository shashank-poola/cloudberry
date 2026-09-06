export const HOSTED_MODEL_CATALOG = Object.freeze([
  Object.freeze({ id: "gpt-oss-120b" }),
  Object.freeze({ id: "minimax-m2.7" }),
] as const)

export type HostedModel = (typeof HOSTED_MODEL_CATALOG)[number]
export type HostedModelId = HostedModel["id"]

export const HOSTED_MODEL_IDS = Object.freeze(
  HOSTED_MODEL_CATALOG.map((model) => model.id)
) as readonly HostedModelId[]

const hostedModelIdSet: ReadonlySet<string> = new Set(HOSTED_MODEL_IDS)

export class HostedModelValidationError extends Error {
  constructor() {
    super("UNSUPPORTED_HOSTED_MODEL")
    this.name = "HostedModelValidationError"
  }
}

export const isHostedModelId = (value: unknown): value is HostedModelId =>
  typeof value === "string" && hostedModelIdSet.has(value)

export const getHostedModel = (value: unknown): HostedModel | null => {
  if (!isHostedModelId(value)) return null

  return HOSTED_MODEL_CATALOG.find((model) => model.id === value) ?? null
}

export const parseHostedModelId = (value: unknown): HostedModelId => {
  if (!isHostedModelId(value)) {
    throw new HostedModelValidationError()
  }

  return value
}
