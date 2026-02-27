import { createHash } from 'crypto'

import bcrypt from 'bcrypt'
import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

import { agents } from '@bout/db/schema'

import { db } from '../lib/db.js'
import { redis } from '../lib/redis.js'

type AuthEnv = {
  Variables: {
    agentId: string
  }
}

const MAX_FAILED_ATTEMPTS = 5
const FAIL_WINDOW_SECONDS = 900
const CACHE_TTL_SECONDS = 60

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey) {
    throw new HTTPException(401, { message: 'Missing X-API-Key header' })
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  // Check rate limit on failed attempts
  const failKey = `auth:fail:${keyHash}`
  const failCount = await redis.get(failKey)
  if (failCount && parseInt(failCount) >= MAX_FAILED_ATTEMPTS) {
    throw new HTTPException(429, {
      message: 'Too many failed attempts. Try again in 15 minutes.',
    })
  }

  // Check cache for previously verified key
  const cacheKey = `auth:${keyHash}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    c.set('agentId', cached)
    return next()
  }

  // Verify against database
  const allAgents = await db
    .select()
    .from(agents)
    .where(eq(agents.status, 'active'))

  let matched: string | null = null
  for (const agent of allAgents) {
    const valid = await bcrypt.compare(apiKey, agent.apiKeyHash)
    if (valid) {
      matched = agent.id
      break
    }
  }

  if (!matched) {
    await redis.incr(failKey)
    await redis.expire(failKey, FAIL_WINDOW_SECONDS)
    throw new HTTPException(401, { message: 'Invalid API key' })
  }

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, matched)
  c.set('agentId', matched)

  // Update last seen (fire-and-forget)
  await db
    .update(agents)
    .set({ lastSeenAt: new Date() })
    .where(eq(agents.id, matched))

  return next()
})
