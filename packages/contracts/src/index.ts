import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020"
import addFormats from "ajv-formats"
import companyEventSchema from "../schemas/company-event.v1.json"
import knowledgeResultSchema from "../schemas/knowledge-result.v1.json"
import knowledgeSearchSchema from "../schemas/knowledge-search.v1.json"

export type JsonPrimitive = boolean | null | number | string
export type JsonValue = JsonArray | JsonObject | JsonPrimitive
export type JsonArray = JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

export type CompanyEventActor = {
  id?: string
  name?: string
  email?: string
}

export type CompanyEvent = {
  id: string
  organization_id: string
  source: string
  external_event_id: string
  external_url: string | null
  event_type: string
  occurred_at: string
  received_at: string
  actor: CompanyEventActor | null
  title: string | null
  content: string
  metadata: JsonObject
  raw_payload: JsonArray | JsonObject
}

export type KnowledgeSearchRequest = {
  organization_id: string
  query: string
  limit: number
}

export type KnowledgeSearchResultItem = {
  id: string
  type: string
  content: string
  score: number
  source_event_ids: string[]
}

export type KnowledgeSearchResult = {
  organization_id: string
  query: string
  retrieved_at: string
  results: KnowledgeSearchResultItem[]
}

export class ContractValidationError extends Error {
  readonly errors: readonly ErrorObject[]

  constructor(contractName: string, errors: readonly ErrorObject[]) {
    super(`Invalid ${contractName}: ${formatErrors(errors)}`)
    this.name = "ContractValidationError"
    this.errors = errors
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)

const companyEventValidator = ajv.compile<CompanyEvent>(companyEventSchema)
const knowledgeSearchValidator = ajv.compile<KnowledgeSearchRequest>(
  knowledgeSearchSchema
)
const knowledgeResultValidator = ajv.compile<KnowledgeSearchResult>(
  knowledgeResultSchema
)

export const validateCompanyEvent = (value: unknown): value is CompanyEvent =>
  companyEventValidator(value)

export const validateKnowledgeSearchRequest = (
  value: unknown
): value is KnowledgeSearchRequest => knowledgeSearchValidator(value)

export const validateKnowledgeSearchResult = (
  value: unknown
): value is KnowledgeSearchResult => knowledgeResultValidator(value)

export const assertCompanyEvent = (value: unknown): CompanyEvent =>
  assertContract("CompanyEvent", companyEventValidator, value)

export const assertKnowledgeSearchRequest = (
  value: unknown
): KnowledgeSearchRequest =>
  assertContract("KnowledgeSearchRequest", knowledgeSearchValidator, value)

export const assertKnowledgeSearchResult = (
  value: unknown
): KnowledgeSearchResult =>
  assertContract("KnowledgeSearchResult", knowledgeResultValidator, value)

function assertContract<T>(
  contractName: string,
  validator: ValidateFunction<T>,
  value: unknown
): T {
  if (validator(value)) {
    return value
  }

  throw new ContractValidationError(contractName, validator.errors ?? [])
}

function formatErrors(errors: readonly ErrorObject[]): string {
  return errors
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ")
}
