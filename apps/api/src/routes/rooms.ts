import { Queue } from 'bullmq'
import { and, desc, eq, or } from 'drizzle-orm'
import { Hono } from 'hono'

import { agents, battleParticipants, battles, rooms } from '@bout/db/schema'

import { db } from '../lib/db.js'
import { genBattleId, genParticipantId, genRoomId } from '../lib/id.js'
import { authMiddleware } from '../middleware/auth.js'

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')
const redisConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  maxRetriesPerRequest: null,
}
const battleQueue = new Queue('battles', { connection: redisConnection })
const refundQueue = new Queue('room-refunds', { connection: redisConnection })

const ROOM_EXPIRY_MS = 10 * 60 * 1000
const FIXED_WAGER = 1_000n // 1 USDC (internal: 1,000 tokens × 1000 = 1,000,000 = 1 USDC in 6-decimal)
const WAGER_USDC6 = '1000000' // 1 USDC in 6-decimal (string for BullMQ serialization)
const FEE_BPS = 1000 // 10% → winner gets 1.8 USDC, Bout takes 0.2 USDC
const DEFAULT_RATING = 1000

export const roomRoutes = new Hono()

// List rooms
roomRoutes.get('/', async (c) => {
  const status = c.req.query('status') || 'open'
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)

  const allRooms = await db
    .select({
      id: rooms.id,
      gameId: rooms.gameId,
      creatorId: rooms.creatorId,
      creatorName: agents.name,
      wager: rooms.wager,
      status: rooms.status,
      battleId: rooms.battleId,
      expiresAt: rooms.expiresAt,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .leftJoin(agents, eq(rooms.creatorId, agents.id))
    .where(eq(rooms.status, status))
    .orderBy(desc(rooms.createdAt))
    .limit(limit)

  return c.json({ rooms: allRooms })
})

// Create room
roomRoutes.post('/', authMiddleware, async (c) => {
  const agentId = c.get('agentId')
  const body = await c.req.json()
  const { gameId, wager } = body

  if (!gameId) {
    return c.json({ error: 'Missing gameId' }, 400)
  }

  // Check: agent must not have an open room or active battle
  const [openRoom] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.creatorId, agentId), eq(rooms.status, 'open')))
    .limit(1)

  if (openRoom) {
    return c.json(
      { error: 'You already have an open room. Cancel it or wait for it to expire before creating another.' },
      409,
    )
  }

  const [activeBattle] = await db
    .select({ id: battles.id })
    .from(battles)
    .where(
      and(
        eq(battles.status, 'active'),
        or(eq(battles.agentA, agentId), eq(battles.agentB, agentId)),
      ),
    )
    .limit(1)

  if (activeBattle) {
    return c.json(
      { error: 'You have an active battle in progress. Finish it before creating a new room.' },
      409,
    )
  }

  // x402 payment is handled by the middleware in index.ts.
  // If we reach here, payment was already verified (or payments are disabled).

  const roomId = genRoomId()
  const expiresAt = new Date(Date.now() + ROOM_EXPIRY_MS)

  await db.insert(rooms).values({
    id: roomId,
    gameId,
    creatorId: agentId,
    wager: FIXED_WAGER,
    expiresAt,
  })

  return c.json(
    {
      id: roomId,
      gameId,
      creatorId: agentId,
      wager: FIXED_WAGER.toString(),
      status: 'open',
      expiresAt: expiresAt.toISOString(),
    },
    201,
  )
})

// Join room
roomRoutes.post('/:id/join', authMiddleware, async (c) => {
  const agentId = c.get('agentId')
  const roomId = c.req.param('id')

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)

  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }
  if (room.status !== 'open') {
    return c.json({ error: 'Room is not open' }, 400)
  }
  if (room.creatorId === agentId) {
    return c.json({ error: 'Cannot join your own room' }, 400)
  }
  if (new Date(room.expiresAt) < new Date()) {
    return c.json({ error: 'Room has expired' }, 400)
  }

  // Check: joiner must not have an open room or active battle
  const [joinerOpenRoom] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.creatorId, agentId), eq(rooms.status, 'open')))
    .limit(1)

  if (joinerOpenRoom) {
    return c.json(
      { error: 'You have an open room. Cancel it before joining another room.' },
      409,
    )
  }

  const [joinerActiveBattle] = await db
    .select({ id: battles.id })
    .from(battles)
    .where(
      and(
        eq(battles.status, 'active'),
        or(eq(battles.agentA, agentId), eq(battles.agentB, agentId)),
      ),
    )
    .limit(1)

  if (joinerActiveBattle) {
    return c.json(
      { error: 'You have an active battle in progress. Finish it before joining a room.' },
      409,
    )
  }

  // x402 payment is handled by the middleware in index.ts.

  const battleId = genBattleId()

  const [creatorAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, room.creatorId))
    .limit(1)

  const [joinerAgent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1)

  await db.transaction(async (tx) => {
    await tx
      .update(rooms)
      .set({ status: 'matched', battleId })
      .where(eq(rooms.id, roomId))

    await tx.insert(battles).values({
      id: battleId,
      roomId,
      gameId: room.gameId,
      agentA: room.creatorId,
      agentB: agentId,
      wager: room.wager,
      feeBps: FEE_BPS,
    })

    await tx.insert(battleParticipants).values([
      {
        id: genParticipantId(),
        battleId,
        agentId: room.creatorId,
        initialToken: room.wager,
        eloBefore: creatorAgent?.rating ?? DEFAULT_RATING,
      },
      {
        id: genParticipantId(),
        battleId,
        agentId,
        initialToken: room.wager,
        eloBefore: joinerAgent?.rating ?? DEFAULT_RATING,
      },
    ])
  })

  await battleQueue.add('battle', { battleId }, { jobId: battleId })

  return c.json({ battleId, status: 'matched' })
})

// Cancel room
roomRoutes.post('/:id/cancel', authMiddleware, async (c) => {
  const agentId = c.get('agentId')
  const roomId = c.req.param('id')

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)

  if (!room) {
    return c.json({ error: 'Room not found' }, 404)
  }
  if (room.creatorId !== agentId) {
    return c.json({ error: 'Not your room' }, 403)
  }
  if (room.status !== 'open') {
    return c.json({ error: 'Room is not open' }, 400)
  }

  await db
    .update(rooms)
    .set({ status: 'cancelled' })
    .where(eq(rooms.id, roomId))

  // Enqueue on-chain refund (Judge worker processes it)
  const [creator] = await db
    .select({ walletAddress: agents.walletAddress })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1)

  if (creator?.walletAddress) {
    await refundQueue.add('refund', {
      roomId,
      creatorWallet: creator.walletAddress,
      amountUsdc6: WAGER_USDC6,
    })
  }

  return c.json({ id: roomId, status: 'cancelled' })
})
