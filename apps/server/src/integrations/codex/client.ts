import {
  getCodexAuthBaseUrl,
  getCodexAuthTimeoutMs,
  getCodexClientId,
  normalizeCodexAuthBaseUrl,
} from "./config"
import {
  CodexAuthClientError,
  codexInvalidResponse,
  codexResponseError,
} from "./errors"
import {
  asCodexRecord,
  parseCodexCredentialRefresh,
  parseCodexDeviceAuthorization,
  parseCodexDeviceCode,
  parseCodexDeviceCompletion,
} from "./schema"
import type {
  CodexAuthClientLike,
  CodexAuthClientOptions,
  CodexCredentialSet,
  CodexDeviceAuthorization,
  CodexDeviceCode,
  CodexDevicePollResult,
  FetchLike,
  CodexIdentity,
} from "./types"

const joinUrl = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`

export class CodexAuthClient implements CodexAuthClientLike {
  private readonly baseUrl: string
  private readonly clientId: string
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number

  constructor(options: CodexAuthClientOptions = {}) {
    this.baseUrl = normalizeCodexAuthBaseUrl(
      options.baseUrl?.trim() || getCodexAuthBaseUrl()
    )
    this.clientId =
      options.clientId?.trim() ||
      process.env.CODEX_CLIENT_ID?.trim() ||
      getCodexClientId()
    this.fetchImpl = options.fetchImpl || fetch
    this.timeoutMs = options.timeoutMs ?? getCodexAuthTimeoutMs()

    if (
      !this.clientId ||
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs <= 0
    ) {
      throw new CodexAuthClientError(
        "CODEX_AUTH_NOT_CONFIGURED",
        null,
        "configuration"
      )
    }
  }

  async requestDeviceCode(): Promise<CodexDeviceCode> {
    const payload = await this.postJson("/api/accounts/deviceauth/usercode", {
      client_id: this.clientId,
    })
    return parseCodexDeviceCode(payload, joinUrl(this.baseUrl, "/codex/device"))
  }

  async pollDeviceCode(
    deviceAuthId: string,
    userCode: string
  ): Promise<CodexDevicePollResult> {
    const response = await this.sendJson("/api/accounts/deviceauth/token", {
      client_id: this.clientId,
      device_auth_id: deviceAuthId,
      user_code: userCode,
    })

    if (response.status === 403 || response.status === 404) {
      return { status: "pending" }
    }
    if (!response.ok) throw codexResponseError(response.status)

    return {
      status: "authorized",
      authorization: parseCodexDeviceAuthorization(await this.json(response)),
    }
  }

  async completeDeviceCode(
    authorization: CodexDeviceAuthorization
  ): Promise<CodexIdentity> {
    const completion =
      await this.completeDeviceCodeWithCredentials(authorization)
    return completion.identity
  }

  async completeDeviceCodeWithCredentials(
    authorization: CodexDeviceAuthorization
  ) {
    const response = await this.sendForm("/oauth/token", {
      grant_type: "authorization_code",
      code: authorization.authorization_code,
      redirect_uri: joinUrl(this.baseUrl, "/deviceauth/callback"),
      client_id: this.clientId,
      code_verifier: authorization.code_verifier,
    })
    if (!response.ok) throw codexResponseError(response.status)

    return parseCodexDeviceCompletion(await this.json(response))
  }

  async refreshCredentials(
    credentials: CodexCredentialSet
  ): Promise<CodexCredentialSet> {
    if (!credentials.refresh_token) {
      throw new CodexAuthClientError("CODEX_AUTH_NOT_AUTHORIZED", 401, "http")
    }

    const response = await this.sendForm("/oauth/token", {
      grant_type: "refresh_token",
      refresh_token: credentials.refresh_token,
      client_id: this.clientId,
    })
    if (!response.ok) throw codexResponseError(response.status)

    return parseCodexCredentialRefresh(await this.json(response), credentials)
  }

  private async postJson(path: string, body: Record<string, unknown>) {
    const response = await this.sendJson(path, body)
    if (!response.ok) throw codexResponseError(response.status)
    return this.json(response)
  }

  private async json(response: Response) {
    try {
      return asCodexRecord(await response.json())
    } catch (error) {
      if (error instanceof CodexAuthClientError) throw error
      throw codexInvalidResponse(response.status)
    }
  }

  private sendJson(path: string, body: Record<string, unknown>) {
    return this.request(path, {
      "Content-Type": "application/json",
      body: JSON.stringify(body),
    })
  }

  private sendForm(path: string, values: Record<string, string>) {
    return this.request(path, {
      "Content-Type": "application/x-www-form-urlencoded",
      body: new URLSearchParams(values).toString(),
    })
  }

  private async request(
    path: string,
    init: { body: string; "Content-Type": string }
  ) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      return await this.fetchImpl(joinUrl(this.baseUrl, path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": init["Content-Type"],
        },
        body: init.body,
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) {
        throw new CodexAuthClientError("CODEX_AUTH_TIMEOUT", null, "timeout")
      }
      if (error instanceof CodexAuthClientError) throw error
      throw new CodexAuthClientError("CODEX_AUTH_UNAVAILABLE", null, "network")
    } finally {
      clearTimeout(timeout)
    }
  }
}
