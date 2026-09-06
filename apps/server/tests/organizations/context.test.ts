import { describe, expect, test } from "bun:test"
import type { NextFunction, Request, Response } from "express"
import { organizationContextMiddleware } from "../../src/organizations/context"

type ResponsePayload = {
  success: boolean
  data: null
  error: string
}

describe("organization context middleware", () => {
  test("rejects a request that did not pass authentication", async () => {
    let statusCode: number | null = null
    let payload: ResponsePayload | null = null
    let nextCalled = false
    const response = {
      status: (status: number) => {
        statusCode = status
        return response
      },
      json: (body: ResponsePayload) => {
        payload = body
        return response
      },
    }
    const next: NextFunction = () => {
      nextCalled = true
    }

    await organizationContextMiddleware(
      {} as Request,
      response as unknown as Response,
      next
    )

    expect(Number(statusCode)).toBe(401)
    expect(JSON.stringify(payload)).toBe(
      JSON.stringify({
        success: false,
        data: null,
        error: "UNAUTHORIZED",
      })
    )
    expect(nextCalled).toBe(false)
  })
})
