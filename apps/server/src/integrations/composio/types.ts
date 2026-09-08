export type ComposioConnectionRequestLike = {
  id: string
  redirectUrl: string | null
}

export type ComposioConnectedToolkitLike = {
  slug: string
  name: string
  connection?: {
    isActive: boolean
    connectedAccount?: {
      id: string
      status: string
    }
  }
}

export type ComposioSessionLike = {
  authorize(
    toolkit: string,
    options?: { callbackUrl?: string }
  ): Promise<ComposioConnectionRequestLike>
  toolkits(options?: { isConnected?: boolean }): Promise<{
    items: ComposioConnectedToolkitLike[]
  }>
}

export type ComposioClientLike = {
  sessions: {
    create(
      userId: string,
      config?: {
        toolkits?: string[]
        authConfigs?: Record<string, string>
        manageConnections?: boolean
        sandbox?: { enable: boolean }
      }
    ): Promise<ComposioSessionLike>
  }
  connectedAccounts: {
    get(id: string): Promise<unknown>
    delete(id: string): Promise<unknown>
    disable(id: string): Promise<unknown>
  }
  triggers: {
    create(
      userId: string,
      slug: string,
      body?: {
        connectedAccountId?: string
        triggerConfig?: Record<string, unknown>
      }
    ): Promise<{ triggerId: string }>
    delete(id: string): Promise<unknown>
    setWebhookSubscription(params: {
      webhookUrl: string
      enabledEvents?: string[]
      version?: "V3"
    }): Promise<unknown>
    parse(
      request: { body: unknown; headers: unknown },
      options?: { verifySecret?: string; tolerance?: number }
    ): Promise<unknown>
  }
}
