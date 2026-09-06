import { describe, expect, test } from "bun:test"
import {
  isPrizedComputerReady,
  normaliseCodexSessionStatus,
} from "../../../api/computer/client"

describe("computer browser client", () => {
  test("recognizes a ready Prized computer", () => {
    expect(
      isPrizedComputerReady({
        id: "computer-1",
        provider: "prized",
        status: "running",
        boxId: "box-1",
      })
    ).toBe(true)

    expect(
      isPrizedComputerReady({
        id: "computer-1",
        provider: "prized",
        status: "provisioning",
        boxId: "box-1",
      })
    ).toBe(false)
  })

  test("normalizes backend and provider session states for the chat UI", () => {
    expect(normaliseCodexSessionStatus("pending")).toBe("queued")
    expect(normaliseCodexSessionStatus("in-progress")).toBe("running")
    expect(normaliseCodexSessionStatus("done")).toBe("succeeded")
    expect(normaliseCodexSessionStatus("interrupted")).toBe("cancelled")
  })
})
