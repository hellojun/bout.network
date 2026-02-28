import { desc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { agents, battleParticipants, battles } from '@bout/db/schema'

import { db } from '../lib/db.js'
import { redis } from '../lib/redis.js'
import { authMiddleware } from '../middleware/auth.js'

export const battleRoutes = new Hono()

// Submit action
battleRoutes.post('/action', authMiddleware, async (c) => {
  const agentId = c.get('agentId')
  const body = await c.req.json()
  const { battleId, tool, args, message } = body

  if (!battleId || !tool) {
    return c.json({ error: 'Missing battleId or tool' }, 400)
  }

  const action = JSON.stringify({ tool, args: args || {}, message })
  await redis.rpush(`action:${battleId}:${agentId}`, action)

  return c.json({ status: 'submitted' })
})

// Poll battle state (for HTTP-based agents)
battleRoutes.get('/:id/state', authMiddleware, async (c) => {
  const agentId = c.get('agentId')
  const battleId = c.req.param('id')

  const raw = await redis.get(`battle:state:${battleId}`)

  if (!raw) {
    // Fall back to DB -- battle may not have started yet or state expired
    const [battle] = await db
      .select()
      .from(battles)
      .where(eq(battles.id, battleId))
      .limit(1)

    if (!battle) {
      return c.json({ error: 'Battle not found' }, 404)
    }

    if (battle.status === 'finished') {
      return c.json({
        battleId,
        status: 'finished',
        winnerId: battle.winnerId,
      })
    }

    return c.json({
      battleId,
      status: 'pending',
    })
  }

  const state = JSON.parse(raw)
  const isParticipant = state.agents.includes(agentId)
  const isYourTurn = state.currentTurnAgentId === agentId

  // Add per-agent view (myColor/opponentColor) for participants
  let gameState = state.gameState
  if (isParticipant && gameState) {
    const agentIndex = state.agents.indexOf(agentId)
    const myColor = agentIndex === 0 ? 1 : 2
    gameState = {
      ...gameState,
      myColor,
      opponentColor: myColor === 1 ? 2 : 1,
    }
  }

  return c.json({
    battleId: state.battleId,
    status: state.status,
    gameId: state.gameId,
    round: state.round,
    isYourTurn,
    currentTurnAgentId: state.currentTurnAgentId,
    timeoutMs: state.timeoutMs,
    availableTools: isParticipant ? state.availableTools : undefined,
    gameState,
    lastAction: state.lastAction,
    winner: state.winner,
    finishReason: state.finishReason,
    updatedAt: state.updatedAt,
  })
})

// Live battle state for observers (no auth required)
battleRoutes.get('/:id/live', async (c) => {
  const battleId = c.req.param('id')

  const raw = await redis.get(`battle:state:${battleId}`)

  if (!raw) {
    const [battle] = await db
      .select()
      .from(battles)
      .where(eq(battles.id, battleId))
      .limit(1)

    if (!battle) {
      return c.json({ error: 'Battle not found' }, 404)
    }

    if (battle.status === 'finished') {
      return c.json({ battleId, status: 'finished', winnerId: battle.winnerId })
    }

    return c.json({ battleId, status: 'pending' })
  }

  const state = JSON.parse(raw)

  return c.json({
    battleId: state.battleId,
    status: state.status,
    gameId: state.gameId,
    agents: state.agents,
    round: state.round,
    currentTurnAgentId: state.currentTurnAgentId,
    timeoutMs: state.timeoutMs,
    gameState: state.gameState,
    lastAction: state.lastAction,
    winner: state.winner,
    finishReason: state.finishReason,
    updatedAt: state.updatedAt,
  })
})

// Get battle details (with agent names and participant data)
battleRoutes.get('/:id', async (c) => {
  const battleId = c.req.param('id')

  const [battle] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1)

  if (!battle) {
    return c.json({ error: 'Battle not found' }, 404)
  }

  const participants = await db
    .select()
    .from(battleParticipants)
    .where(eq(battleParticipants.battleId, battleId))

  // Fetch agent names
  const [agentAData] = await db
    .select({ name: agents.name, rating: agents.rating })
    .from(agents)
    .where(eq(agents.id, battle.agentA))
    .limit(1)

  const [agentBData] = await db
    .select({ name: agents.name, rating: agents.rating })
    .from(agents)
    .where(eq(agents.id, battle.agentB))
    .limit(1)

  return c.json({
    ...battle,
    agentAName: agentAData?.name ?? battle.agentA,
    agentBName: agentBData?.name ?? battle.agentB,
    agentARating: agentAData?.rating ?? 1000,
    agentBRating: agentBData?.rating ?? 1000,
    participants,
  })
})

// List battles (with agent names)
battleRoutes.get('/', async (c) => {
  const status = c.req.query('status')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)
  const offset = parseInt(c.req.query('offset') || '0')

  let results
  if (status) {
    results = await db
      .select()
      .from(battles)
      .where(eq(battles.status, status))
      .orderBy(desc(battles.startedAt))
      .limit(limit)
      .offset(offset)
  } else {
    results = await db
      .select()
      .from(battles)
      .orderBy(desc(battles.startedAt))
      .limit(limit)
      .offset(offset)
  }

  // Fetch agent names for all battles
  const agentIds = [...new Set(results.flatMap((b) => [b.agentA, b.agentB]))]
  const agentNames: Record<string, string> = {}

  if (agentIds.length > 0) {
    const agentRecords = await db
      .select({ id: agents.id, name: agents.name })
      .from(agents)
      .where(sql`${agents.id} IN (${sql.join(agentIds.map(id => sql`${id}`), sql`, `)})`)

    for (const a of agentRecords) {
      agentNames[a.id] = a.name
    }
  }

  return c.json({
    battles: results.map((b) => ({
      ...b,
      agentAName: agentNames[b.agentA] ?? b.agentA,
      agentBName: agentNames[b.agentB] ?? b.agentB,
    })),
  })
})
