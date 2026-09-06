import { describe, expect, test } from "bun:test"
import { HOSTED_MODELS } from "../../../api/chat/client"

describe("hosted chat browser client", () => {
  test("only exposes the server-supported hosted model choices", () => {
    expect(HOSTED_MODELS).toEqual(["gpt-oss-120b", "minimax-m2.7"])
  })
})
