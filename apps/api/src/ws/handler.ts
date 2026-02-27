import { createHash } from 'crypto'
import type { IncomingMessage } from 'http'

import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { WebSocket, WebSocketServer } from 'ws'

import { agents } from '@bout/db/schema'

import { db } from '../lib/db.js'
import { redis } from '../lib/redis.js'

/** Agent connections: agentId (DB id, e.g. "agt_xxx") -> WebSocket */
const agentConnections = new Map<string, WebSocket>()

/** Observer connections: battleId -> Set<WebSocket> */
const observerConnections = new Map<string, Set<WebSocket>>()

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '', 'http://localhost')
    const apiKey = url.searchParams.get('api_key')
    const battleId = url.searchParams.get('battle_id')
    const isObserver = url.pathname?.includes('/observe') || !apiKey

    if (isObserver && battleId) {
      handleObserverConnection(ws, battleId)
      return
    }

    if (!apiKey) {
      ws.close(4001, 'Missing api_key')
      return
    }

    handleAgentConnection(ws, apiKey)
  })
}

function handleObserverConnection(ws: WebSocket, battleId: string): void {
  if (!observerConnections.has(battleId)) {
    observerConnections.set(battleId, new Set())
  }
  observerConnections.get(battleId)!.add(ws)
  ws.send(JSON.stringify({ event: 'connected', mode: 'observer', battleId }))

  ws.on('close', () => {
    observerConnections.get(battleId)?.delete(ws)
  })
}

const AUTH_CACHE_TTL = 60

/** Resolve API key to DB agent ID, with Redis cache. */
async function resolveAgentId(apiKey: string): Promise<string | null> {
  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Check cache
  const cached = await redis.get(`auth:${keyHash}`)
  if (cached) return cached

  // Verify against DB (same logic as auth middleware)
  const allAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.status, 'active'))

  for (const agent of allAgents) {
    const valid = await bcrypt.compare(apiKey, agent.apiKeyHash)
    if (valid) {
      await redis.setex(`auth:${keyHash}`, AUTH_CACHE_TTL, agent.id)
      return agent.id
    }
  }

  return null
}

async function handleAgentConnection(ws: WebSocket, apiKey: string): Promise<void> {
  const agentId = await resolveAgentId(apiKey)

  if (!agentId) {
    ws.close(4001, 'Invalid api_key')
    return
  }

  agentConnections.set(agentId, ws)
  ws.send(JSON.stringify({ event: 'connected', agentId }))

  ws.on('close', () => {
    agentConnections.delete(agentId)
  })

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      handleAgentMessage(agentId, msg)
    } catch {
      // Ignore malformed messages
    }
  })
}

function handleAgentMessage(_agentId: string, _msg: unknown): void {
  // Handle agent messages if needed
}

/** Check if an agent has an active WebSocket connection. */
export function isAgentConnected(agentId: string): boolean {
  const ws = agentConnections.get(agentId)
  return !!ws && ws.readyState === WebSocket.OPEN
}

/** Send a message to a specific agent. */
export function sendToAgent(agentId: string, event: string, data: unknown): void {
  const ws = agentConnections.get(agentId)
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data }))
  }
}

/** Broadcast a message to all observers of a battle. */
export function broadcastToBattle(
  battleId: string,
  event: string,
  data: unknown,
): void {
  const observers = observerConnections.get(battleId)
  if (!observers) return

  const msg = JSON.stringify({ event, data })
  for (const ws of observers) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
    }
  }
}

/** Broadcast to both agents in a battle AND observers. */
export function broadcast(
  battleId: string,
  event: string,
  data: unknown,
  agentIds?: string[],
): void {
  if (agentIds) {
    for (const id of agentIds) {
      sendToAgent(id, event, data)
    }
  }
  broadcastToBattle(battleId, event, data)
}

/** Publish a battle event via Redis pub/sub for cross-process broadcasting. */
export async function publishBattleEvent(
  battleId: string,
  event: string,
  data: unknown,
  agentIds?: string[],
): Promise<void> {
  await redis.publish(
    'battle:events',
    JSON.stringify({ battleId, event, data, agentIds }),
  )
}

// Subscribe to Redis pub/sub for cross-process broadcasting
const sub = redis.duplicate()
sub.subscribe('battle:events')
sub.on('message', (channel, message) => {
  if (channel !== 'battle:events') return

  try {
    const { battleId, event, data, agentIds } = JSON.parse(message)
    broadcast(battleId, event, data, agentIds)
  } catch {
    // Ignore malformed pub/sub messages
  }
})
