import { eq } from 'drizzle-orm'

import { createDb } from '@bout/db'
import { gameRegistry } from '@bout/db/schema'
import type { IGame } from '@bout/game-sdk'
import { RemoteGame } from '@bout/game-sdk/remote'
import { Gomoku } from '@bout/games/gomoku'

// ---------------------------------------------------------------------------
// Built-in games
// ---------------------------------------------------------------------------

const builtinGames: Record<string, IGame> = {
  gomoku: Gomoku,
}

// ---------------------------------------------------------------------------
// DB connection (lazy)
// ---------------------------------------------------------------------------

let db: ReturnType<typeof createDb> | null = null

function getDb() {
  if (!db) {
    db = createDb(
      process.env.DATABASE_URL || 'postgresql://bout:bout@localhost:5432/bout',
    )
  }
  return db
}

// ---------------------------------------------------------------------------
// Async game loader
// ---------------------------------------------------------------------------

export async function loadGame(gameId: string): Promise<IGame> {
  // 1. Fast path: built-in games
  const builtin = builtinGames[gameId]
  if (builtin) return builtin

  // 2. Look up in DB game_registry
  const [entry] = await getDb()
    .select()
    .from(gameRegistry)
    .where(eq(gameRegistry.id, gameId))
    .limit(1)

  if (!entry) throw new Error(`Unknown game: ${gameId}`)

  // 3. Remote game via HTTP
  if (entry.serverUrl) {
    const remote = new RemoteGame(entry.serverUrl)
    await remote.fetchMeta()
    return remote
  }

  throw new Error(`Game "${gameId}" is registered but has no serverUrl and is not built-in`)
}
