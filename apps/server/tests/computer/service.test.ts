import { describe, expect, test } from "bun:test"
import { normalizeCodexStatus } from "../../src/computer/service"

describe("normalizeCodexStatus", () => {
  test("maps provider lifecycle values to the stored session states", () => {
    expect(normalizeCodexStatus("pending")).toBe("queued")
    expect(normalizeCodexStatus("in-progress")).toBe("running")
    expect(normalizeCodexStatus("completed")).toBe("succeeded")
    expect(normalizeCodexStatus("error")).toBe("failed")
    expect(normalizeCodexStatus("interrupted")).toBe("cancelled")
  })

  test("keeps the current state for an unknown provider value", () => {
    expect(normalizeCodexStatus("provider-added-state", "running")).toBe(
      "running"
    )
  })
})
