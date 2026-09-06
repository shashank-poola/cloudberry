import { describe, expect, test } from "bun:test"
import { getApiErrorMessage } from "../../../api/client"
import { HOSTED_MODELS } from "../../../api/chat/client"

describe("hosted chat browser client", () => {
  test("only exposes the server-supported hosted model choices", () => {
    expect(HOSTED_MODELS).toEqual(["gpt-oss-120b", "minimax-m2.7"])
  })

  test("turns persisted knowledge configuration codes into guidance", () => {
    expect(getApiErrorMessage("KNOWLEDGE_NOT_CONFIGURED")).toBe(
      "Cloudberry's company knowledge service is not configured yet. Configure it or use your connected Codex account."
    )
  })
})
