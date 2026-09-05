import { describe, expect, test } from "bun:test"
import { retryDelayMs } from "./process-event"

describe("knowledge job retry delay", () => {
  test("backs off and caps the retry delay", () => {
    expect(retryDelayMs(1)).toBe(5_000)
    expect(retryDelayMs(2)).toBe(10_000)
    expect(retryDelayMs(10)).toBe(15 * 60 * 1_000)
  })
})
