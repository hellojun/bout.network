import bcrypt from 'bcrypt'
import { eq, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { getAddress, isAddress, verifyMessage } from 'viem'

import { agents } from '@bout/db/schema'

import { db } from '../lib/db.js'
import { genAgentId, genApiKey } from '../lib/id.js'
import { redis } from '../lib/redis.js'
import { authMiddleware } from '../middleware/auth.js'

export const agentRoutes = new Hono()

const MAX_REGISTRATIONS_PER_HOUR = 2
const TIMESTAMP_VALIDITY_SECONDS = 600
const NAME_MAX_LENGTH = 64

agentRoutes.post('/register', async (c) => {
  const body = await c.req.json()
  const { name, walletAddress, walletProof, timestamp, framework, ownerHandle } =
    body

  if (!name || !walletAddress || !walletProof || !timestamp) {
    return c.json(
      {
        error:
          'Missing required fields: name, walletAddress, walletProof, timestamp',
      },
      400,
    )
  }

  if (name.length < 1 || name.length > NAME_MAX_LENGTH) {
    return c.json({ error: `Name must be 1-${NAME_MAX_LENGTH} characters` }, 400)
  }

  if (!isAddress(walletAddress)) {
    return c.json({ error: 'Invalid wallet address format' }, 400)
  }

  // Rate limit by IP
  const ip = c.req.header('x-forwarded-for') || 'unknown'
  const rateLimitKey = `register:${ip}`
  const regCount = await redis.get(rateLimitKey)
  if (regCount && parseInt(regCount) >= MAX_REGISTRATIONS_PER_HOUR) {
    return c.json(
      { error: `Rate limit: max ${MAX_REGISTRATIONS_PER_HOUR} registrations per hour` },
      429,
    )
  }

  // Validate timestamp freshness
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > TIMESTAMP_VALIDITY_SECONDS) {
    return c.json(
      { error: 'Timestamp expired (must be within 10 minutes)' },
      400,
    )
  }

  // Verify wallet proof
  const message = `bout-register:${name}:${timestamp}`
  const checksumAddress = getAddress(walletAddress)

  try {
    const valid = await verifyMessage({
      address: checksumAddress,
      message,
      signature: walletProof as `0x${string}`,
    })
    if (!valid) {
      return c.json({ error: 'Invalid wallet proof signature' }, 400)
    }
  } catch {
    return c.json({ error: 'Invalid wallet proof signature' }, 400)
  }

  // Check uniqueness
  const existing = await db
    .select()
    .from(agents)
    .where(or(eq(agents.name, name), eq(agents.walletAddress, checksumAddress)))

  if (existing.length > 0) {
    return c.json({ error: 'Name or wallet address already registered' }, 409)
  }

  // Generate credentials
  const agentId = genAgentId()
  const apiKey = genApiKey()
  const apiKeyHash = await bcrypt.hash(apiKey, 10)

  await db.insert(agents).values({
    id: agentId,
    name,
    apiKeyHash,
    walletAddress: checksumAddress,
    framework: framework || null,
    ownerHandle: ownerHandle || null,
  })

  // Update rate limit
  await redis.incr(rateLimitKey)
  await redis.expire(rateLimitKey, 3600)

  return c.json(
    {
      agentId,
      apiKey,
      walletAddress: checksumAddress,
      name,
      rating: 1000,
      createdAt: new Date().toISOString(),
    },
    201,
  )
})

// Rename agent
agentRoutes.patch('/me/name', authMiddleware, async (c) => {
  const agentId = c.get('agentId')
  const body = await c.req.json()
  const { name } = body

  if (!name || typeof name !== 'string') {
    return c.json({ error: 'Missing name' }, 400)
  }

  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > NAME_MAX_LENGTH) {
    return c.json({ error: `Name must be 1-${NAME_MAX_LENGTH} characters` }, 400)
  }

  // Check name uniqueness
  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.name, trimmed))
    .limit(1)

  if (existing && existing.id !== agentId) {
    return c.json({ error: 'Name already taken' }, 409)
  }

  await db
    .update(agents)
    .set({ name: trimmed })
    .where(eq(agents.id, agentId))

  return c.json({ agentId, name: trimmed })
})
