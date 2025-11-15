/// <reference types="@cloudflare/workers-types" />

import { MatchmakingRoom } from './durable-objects/MatchmakingRoom'

// Re-export the Durable Object class so Cloudflare can bind to it by name
export { MatchmakingRoom }

export interface Env {
  MATCHMAKING: DurableObjectNamespace
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url)

    // Route WebSocket matchmaking traffic to the Durable Object
    if (url.pathname === '/matchmaking') {
      const id = env.MATCHMAKING.idFromName('global')
      const stub = env.MATCHMAKING.get(id)
      return stub.fetch(request)
    }

    // Basic health check / placeholder
    return new Response('OK', { status: 200 })
  },
}
