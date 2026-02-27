import type { IGame } from '@bout/game-sdk'

import { Gomoku } from '@bout/games/gomoku'

// ---------------------------------------------------------------------------
// Game registry
// ---------------------------------------------------------------------------

const games: Record<string, IGame> = {
  gomoku: Gomoku,
}

export function loadGame(gameId: string): IGame {
  const game = games[gameId]
  if (!game) throw new Error(`Unknown game: ${gameId}`)
  return game
}
