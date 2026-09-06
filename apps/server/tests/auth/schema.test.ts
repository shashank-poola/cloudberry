import { describe, expect, test } from "bun:test"
import { authorizationHeaderSchema } from "../../src/auth/schema"

describe("authorization header schema", () => {
  test("accepts a bearer access token", () => {
    expect(
      authorizationHeaderSchema.safeParse("Bearer access-token").success
    ).toBe(true)
  })

  test("rejects malformed authorization headers", () => {
    expect(authorizationHeaderSchema.safeParse(undefined).success).toBe(false)
    expect(
      authorizationHeaderSchema.safeParse("Token access-token").success
    ).toBe(false)
    expect(authorizationHeaderSchema.safeParse("Bearer ").success).toBe(false)
  })
})
