import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

import { gameRegistry } from '@bout/db/schema'

import { db } from '../lib/db.js'

export const gameRoutes = new Hono()

// List all active games
gameRoutes.get('/', async (c) => {
  const allGames = await db
    .select({
      id: gameRegistry.id,
      name: gameRegistry.name,
      version: gameRegistry.version,
      status: gameRegistry.status,
      serverUrl: gameRegistry.serverUrl,
      isBuiltin: gameRegistry.isBuiltin,
      builderAddress: gameRegistry.builderAddress,
      createdAt: gameRegistry.createdAt,
    })
    .from(gameRegistry)
    .where(eq(gameRegistry.status, 'active'))

  return c.json({ games: allGames })
})

// Get single game
gameRoutes.get('/:id', async (c) => {
  const gameId = c.req.param('id')

  const [game] = await db
    .select()
    .from(gameRegistry)
    .where(eq(gameRegistry.id, gameId))
    .limit(1)

  if (!game) {
    return c.json({ error: 'Game not found' }, 404)
  }

  return c.json(game)
})

// Register external game
gameRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const { id, name, serverUrl, version, builderAddress } = body

  if (!id || !name || !serverUrl || !version) {
    return c.json(
      { error: 'Missing required fields: id, name, serverUrl, version' },
      400,
    )
  }

  // Check for duplicate
  const [existing] = await db
    .select({ id: gameRegistry.id })
    .from(gameRegistry)
    .where(eq(gameRegistry.id, id))
    .limit(1)

  if (existing) {
    return c.json({ error: `Game "${id}" already registered` }, 409)
  }

  // Ping the game server to verify it speaks the bout protocol
  try {
    const metaRes = await fetch(`${serverUrl.replace(/\/+$/, '')}/bout/meta`)
    if (!metaRes.ok) {
      return c.json(
        { error: `Game server health check failed: GET /bout/meta returned ${metaRes.status}` },
        400,
      )
    }
    const metaData = await metaRes.json()
    if (!metaData.meta || !metaData.tools) {
      return c.json(
        { error: 'Game server /bout/meta response missing meta or tools' },
        400,
      )
    }
  } catch (err) {
    return c.json(
      { error: `Cannot reach game server at ${serverUrl}: ${(err as Error).message}` },
      400,
    )
  }

  await db.insert(gameRegistry).values({
    id,
    name,
    serverUrl,
    version,
    builderAddress: builderAddress || null,
    isBuiltin: 0,
  })

  return c.json(
    { id, name, serverUrl, version, status: 'active' },
    201,
  )
})
