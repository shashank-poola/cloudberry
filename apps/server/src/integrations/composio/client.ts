import { Composio } from "@composio/core"
import { getComposioApiKey } from "./config"
import type { ComposioClientLike } from "./types"

export const createComposioClient = (): ComposioClientLike =>
  new Composio({
    apiKey: getComposioApiKey(),
    allowTracking: false,
  }) as unknown as ComposioClientLike
