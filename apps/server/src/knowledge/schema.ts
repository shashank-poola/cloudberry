import {
  assertCompanyEvent,
  ContractValidationError,
  type CompanyEvent,
} from "@cloudberry/contracts"

export class InvalidCompanyEventError extends Error {
  constructor(cause: ContractValidationError) {
    super(cause.message)
    this.name = "InvalidCompanyEventError"
    this.cause = cause
  }
}

export const parseCompanyEvent = (value: unknown): CompanyEvent => {
  try {
    return assertCompanyEvent(value)
  } catch (error) {
    if (error instanceof ContractValidationError) {
      throw new InvalidCompanyEventError(error)
    }

    throw error
  }
}
