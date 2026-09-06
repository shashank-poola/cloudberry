import { createComposioClient } from "./client"
import type { ComposioClientLike } from "./types"

let composioClient: ComposioClientLike | null = null

export const getComposioClient = (): ComposioClientLike => {
  if (composioClient) return composioClient
  composioClient = createComposioClient()
  return composioClient
}

export const setComposioClientForTests = (
  client: ComposioClientLike | null
) => {
  composioClient = client
}
