import { describe, expect, test } from "bun:test"
import {
  parseConnectionCallback,
  parseIntegrationProvider,
  IntegrationRequestValidationError,
} from "../../src/integrations/validation"

describe("integration request validation", () => {
  test("accepts supported providers and callback values", () => {
    expect(parseIntegrationProvider("github")).toBe("github")
    expect(
      parseConnectionCallback({
        state: "1234567890123456",
        status: "success",
        connected_account_id: "ca_123",
      })
    ).toMatchObject({ status: "success" })
  })

  test("rejects unsupported or incomplete values", () => {
    expect(() => parseIntegrationProvider("notion")).toThrow(
      IntegrationRequestValidationError
    )
    expect(() =>
      parseConnectionCallback({ state: "short", status: "success" })
    ).toThrow(IntegrationRequestValidationError)
  })
})
