import { describe, expect, test } from "bun:test"
import { isPrizedComputerReady } from "../../../api/computer/client"

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
})
