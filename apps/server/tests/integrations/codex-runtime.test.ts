import { describe, expect, test } from "bun:test"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  CodexRuntime,
  type CodexCredentialSet,
  type CodexSpawnLike,
} from "../../src/integrations/codex"

type JsonRecord = Record<string, unknown>
type DataListener = (chunk: unknown) => void

type FakeMessage = {
  method?: string
  id?: number
  params?: JsonRecord
}

class FakeProcess {
  readonly messages: FakeMessage[] = []
  private outputListener: DataListener | null = null
  private errorListener: ((error: unknown) => void) | null = null
  private exitListener:
    ((code: number | null, signal: string | null) => void) | null = null

  readonly stdin = {
    destroyed: false,
    write: (chunk: string) => {
      const message = JSON.parse(chunk) as FakeMessage
      this.messages.push(message)
      queueMicrotask(() => this.respond(message))
      return true
    },
    end: () => {
      this.stdin.destroyed = true
    },
  }

  readonly stdout = {
    on: (_event: "data", listener: DataListener) => {
      this.outputListener = listener
    },
  }

  readonly stderr = {
    on: (_event: "data", _listener: DataListener) => undefined,
  }

  once(
    event: "error" | "exit",
    listener:
      | ((error: unknown) => void)
      | ((code: number | null, signal: string | null) => void)
  ) {
    if (event === "error")
      this.errorListener = listener as (error: unknown) => void
    else {
      this.exitListener = listener as (
        code: number | null,
        signal: string | null
      ) => void
    }
  }

  kill() {
    this.stdin.destroyed = true
    return true
  }

  private emit(message: JsonRecord) {
    this.outputListener?.(`${JSON.stringify(message)}\n`)
  }

  private respond(message: FakeMessage) {
    if (message.id === undefined || !message.method) return
    if (message.method === "initialize") {
      this.emit({ id: message.id, result: { userAgent: "fake-codex" } })
      return
    }
    if (message.method === "account/login/start") {
      this.emit({ id: message.id, result: { type: "chatgptAuthTokens" } })
      return
    }
    if (message.method === "model/list") {
      this.emit({
        id: message.id,
        result: {
          data: [
            {
              id: "gpt-5.6-terra",
              model: "gpt-5.6-terra",
              displayName: "GPT-5.6-Terra",
              hidden: false,
              supportedReasoningEfforts: [{ reasoningEffort: "high" }],
              inputModalities: ["text"],
            },
          ],
          nextCursor: null,
        },
      })
      return
    }
    if (message.method === "thread/start") {
      this.emit({
        id: message.id,
        result: { thread: { id: "thread-1" } },
      })
      return
    }
    if (message.method === "turn/start") {
      this.emit({
        id: message.id,
        result: { turn: { id: "turn-1", status: "inProgress" } },
      })
      this.emit({
        method: "turn/started",
        params: { threadId: "thread-1", turn: { id: "turn-1" } },
      })
      this.emit({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "Hello from ",
        },
      })
      this.emit({
        method: "item/agentMessage/delta",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          itemId: "item-1",
          delta: "Codex",
        },
      })
      this.emit({
        method: "item/completed",
        params: {
          threadId: "thread-1",
          turnId: "turn-1",
          item: {
            type: "agentMessage",
            id: "item-1",
            text: "Hello from Codex",
          },
        },
      })
      this.emit({
        method: "turn/completed",
        params: {
          threadId: "thread-1",
          turn: { id: "turn-1", status: "completed" },
        },
      })
      return
    }
    if (message.method === "thread/delete") {
      this.emit({ id: message.id, result: {} })
    }
  }

  triggerError(error: unknown) {
    this.errorListener?.(error)
  }

  triggerExit() {
    this.exitListener?.(1, null)
  }
}

const credentials: CodexCredentialSet = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  account_id: "account-1",
  email: "owner@example.com",
  plan_type: "pro",
}

describe("CodexRuntime", () => {
  test("authenticates app-server and returns streamed Codex output", async () => {
    const fakeProcess = new FakeProcess()
    const spawnCall: {
      command?: string
      args?: string[]
      shell?: boolean
    } = {}
    const spawn: CodexSpawnLike = (command, args, options) => {
      spawnCall.command = command
      spawnCall.args = [...args]
      spawnCall.shell = options.shell
      return fakeProcess as never
    }
    const runtime = new CodexRuntime({
      homeRoot: join(tmpdir(), "cloudberry-codex-runtime-test-home"),
      workspaceRoot: join(tmpdir(), "cloudberry-codex-runtime-test-workspace"),
      spawn,
      refreshCredentials: async (current) => current,
    })

    await runtime.connect("organization-1", credentials)
    expect(runtime.isConnected("organization-1")).toBe(true)
    expect(spawnCall.command).toBe(
      process.platform === "win32" ? "codex.cmd" : "codex"
    )
    expect(spawnCall.args).toEqual(["app-server", "--listen", "stdio://"])
    expect(spawnCall.shell).toBe(process.platform === "win32")

    const models = await runtime.listModels("organization-1")
    expect(models).toEqual([
      {
        id: "gpt-5.6-terra",
        name: "GPT-5.6-Terra",
        reasoning_effort: "high",
        input_modalities: ["text"],
      },
    ])

    const completion = await runtime.createChatCompletion("organization-1", {
      model: "gpt-5.6-terra",
      effort: "high",
      input: "Say hello",
    })
    expect(completion).toMatchObject({
      id: "turn-1",
      model: "gpt-5.6-terra",
      content: "Hello from Codex",
      thread_id: "thread-1",
      turn_id: "turn-1",
    })

    const login = fakeProcess.messages.find(
      (message) => message.method === "account/login/start"
    )
    expect(login?.params).toMatchObject({
      type: "chatgptAuthTokens",
      accessToken: "access-token",
      chatgptAccountId: "account-1",
      chatgptPlanType: "pro",
    })

    const threadStart = fakeProcess.messages.find(
      (message) => message.method === "thread/start"
    )
    expect(threadStart?.params).toMatchObject({
      model: "gpt-5.6-terra",
      sandbox: "read-only",
      approvalPolicy: "never",
    })

    const turnStart = fakeProcess.messages.find(
      (message) => message.method === "turn/start"
    )
    expect(turnStart?.params).toMatchObject({
      model: "gpt-5.6-terra",
      effort: "high",
      sandboxPolicy: { type: "readOnly", networkAccess: false },
    })

    await runtime.disconnect("organization-1")
    expect(runtime.isConnected("organization-1")).toBe(false)
  })

  test("rejects unsafe Windows shell script paths", () => {
    if (process.platform !== "win32") return

    expect(
      () =>
        new CodexRuntime({
          cliPath: "C:\\tools\\codex&exfiltrate.cmd",
        })
    ).toThrow("CODEX_RUNTIME_NOT_CONFIGURED")
  })
})
