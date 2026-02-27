import type { IGame } from '@bout/game-sdk'

import { Gomoku } from './gomoku/src/index.js'

export const games: Record<string, IGame> = {
  gomoku: Gomoku,
}

export function loadGame(gameId: string): IGame {
  const game = games[gameId]
  if (!game) throw new Error(`Unknown game: ${gameId}`)
  return game
}
