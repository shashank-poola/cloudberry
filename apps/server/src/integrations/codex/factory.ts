import { CodexAuthClient } from "./client"
import { CodexRuntime, type CodexRuntimeLike } from "./runtime"
import type { CodexAuthClientLike } from "./types"

let codexAuthClient: CodexAuthClientLike | null = null
let codexRuntime: CodexRuntimeLike | null = null

export const getCodexAuthClient = (): CodexAuthClientLike => {
  if (codexAuthClient) return codexAuthClient
  codexAuthClient = new CodexAuthClient()
  return codexAuthClient
}

export const setCodexAuthClientForTests = (
  client: CodexAuthClientLike | null
) => {
  codexAuthClient = client
}

export const getCodexRuntime = (): CodexRuntimeLike => {
  if (codexRuntime) return codexRuntime
  codexRuntime = new CodexRuntime({
    refreshCredentials: (credentials) =>
      getCodexAuthClient().refreshCredentials(credentials),
  })
  return codexRuntime
}

export const createLazyCodexRuntime = (): CodexRuntimeLike => {
  let runtime: CodexRuntimeLike | null = null
  const get = () => {
    if (!runtime) runtime = getCodexRuntime()
    return runtime
  }

  return {
    connect: (organizationId, credentials) =>
      get().connect(organizationId, credentials),
    disconnect: (organizationId) => get().disconnect(organizationId),
    isConnected: (organizationId) => get().isConnected(organizationId),
    listModels: (organizationId) => get().listModels(organizationId),
    createChatCompletion: (organizationId, request) =>
      get().createChatCompletion(organizationId, request),
  }
}

export const setCodexRuntimeForTests = (runtime: CodexRuntimeLike | null) => {
  codexRuntime = runtime
}
