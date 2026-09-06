import { describe, expect, test } from "bun:test"
import { getDashboardSectionForPathname } from "../components/dashboard/dashboard-nav"

describe("dashboard routes", () => {
  test("keeps persisted conversations in the chat section", () => {
    expect(getDashboardSectionForPathname("/")).toBe("new-chat")
    expect(
      getDashboardSectionForPathname(
        "/c/11111111-1111-4111-8111-111111111111"
      )
    ).toBe("new-chat")
    expect(getDashboardSectionForPathname("/computer")).toBe("computer")
  })
})
