import { Queue, Worker } from 'bullmq'
import { and, eq, lt } from 'drizzle-orm'
import Redis from 'ioredis'

import { createDb } from '@bout/db'
import { agents, rooms } from '@bout/db/schema'

import { refundRoom } from './chain.js'
import { runBattle } from './engine.js'

// ---------------------------------------------------------------------------
// Shared connection
// ---------------------------------------------------------------------------

const redisOpts = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: Number(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port) || 6379,
  maxRetriesPerRequest: null,
}

const redis = new Redis(redisOpts)

// ---------------------------------------------------------------------------
// Battle worker
// ---------------------------------------------------------------------------

const judgeWorker = new Worker(
  'battles',
  async (job) => {
    const { battleId } = job.data as { battleId: string }
    console.log(`[Judge] Starting battle: ${battleId}`)
    await runBattle(battleId)
    console.log(`[Judge] Battle completed: ${battleId}`)
  },
  { connection: redis as any, concurrency: 10 },
)

judgeWorker.on('failed', (job, err) => {
  console.error(`[Judge] Job failed: ${job?.id}`, err)
})

judgeWorker.on('completed', (job) => {
  console.log(`[Judge] Job completed: ${job.id}`)
})

// ---------------------------------------------------------------------------
// Room expiry checker -- runs every minute
// ---------------------------------------------------------------------------

const ROOM_EXPIRY_INTERVAL_MS = 60_000

const WAGER_USDC6 = 1_000_000n // 1 USDC in 6-decimal

async function expireRooms(): Promise<void> {
  const db = createDb(
    process.env.DATABASE_URL || 'postgresql://bout:bout@localhost:5432/bout',
  )

  const expired = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.status, 'open'), lt(rooms.expiresAt, new Date())))

  for (const room of expired) {
    await db.update(rooms).set({ status: 'cancelled' }).where(eq(rooms.id, room.id))
    console.log(`[Judge] Room expired: ${room.id}`)

    // Refund creator's USDC on-chain (full amount, no fee)
    try {
      const [creator] = await db
        .select({ walletAddress: agents.walletAddress })
        .from(agents)
        .where(eq(agents.id, room.creatorId))
        .limit(1)

      if (creator?.walletAddress) {
        await refundRoom(room.id, creator.walletAddress, WAGER_USDC6)
        console.log(`[Judge] Refunded room ${room.id} to ${creator.walletAddress}`)
      }
    } catch (err) {
      console.error(`[Judge] Refund failed for room ${room.id}:`, err)
    }
  }
}

const expiryQueue = new Queue('room-expiry', { connection: redis as any })
await expiryQueue.add('check-expiry', {}, {
  repeat: { every: ROOM_EXPIRY_INTERVAL_MS },
})

const expiryWorker = new Worker(
  'room-expiry',
  async () => {
    await expireRooms()
  },
  { connection: redis as any },
)

expiryWorker.on('failed', (_job, err) => {
  console.error('[Judge] Room expiry check failed', err)
})

// ---------------------------------------------------------------------------
// Room refund worker — processes refund jobs from API (manual cancel)
// ---------------------------------------------------------------------------

const refundWorker = new Worker(
  'room-refunds',
  async (job) => {
    const { roomId, creatorWallet, amountUsdc6 } = job.data as {
      roomId: string
      creatorWallet: string
      amountUsdc6: string
    }
    console.log(`[Judge] Processing refund for room ${roomId}`)
    await refundRoom(roomId, creatorWallet, BigInt(amountUsdc6))
    console.log(`[Judge] Refunded room ${roomId} to ${creatorWallet}`)
  },
  { connection: redis as any },
)

refundWorker.on('failed', (job, err) => {
  console.error(`[Judge] Refund job failed: ${job?.id}`, err)
})

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

console.log('[Judge] Worker started, waiting for battles...')
