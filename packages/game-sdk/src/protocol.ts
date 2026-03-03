import type { GameEvent, GameMeta, GameState, ToolDef } from './types.js'

// ---------------------------------------------------------------------------
// GET /bout/meta
// ---------------------------------------------------------------------------

export type MetaResponse = {
  meta: GameMeta
  tools: ToolDef[]
}

// ---------------------------------------------------------------------------
// POST /bout/games  (create game instance)
// ---------------------------------------------------------------------------

export type CreateGameRequest = {
  agents: string[]
  wager: string // bigint as string
}

export type CreateGameResponse = {
  instanceId: string
}

// ---------------------------------------------------------------------------
// GET /bout/games/:id/state?agent=X
// ---------------------------------------------------------------------------

export type GameStateResponse = {
  currentAgent: string
  state: GameState
  tools: ToolDef[]
  terminated: boolean
}

// ---------------------------------------------------------------------------
// POST /bout/games/:id/action
// ---------------------------------------------------------------------------

export type ActionRequest = {
  agentId: string
  action: {
    tool: string
    args: Record<string, unknown>
    message?: string
  }
}

export type ActionResponse = {
  valid: boolean
  events: GameEvent[]
  tokenDeltas: Record<string, string> // bigint values as strings
  terminated: boolean
  state: GameState
}

// ---------------------------------------------------------------------------
// POST /bout/games/:id/forfeit
// ---------------------------------------------------------------------------

export type ForfeitRequest = {
  agentId: string
}

export type ForfeitResponse = {
  state: GameState
}

// ---------------------------------------------------------------------------
// POST /bout/games/:id/settle
// ---------------------------------------------------------------------------

export type SettleRequest = {
  wager: string // bigint as string
  feeBps: number
}

export type SettleResponse = {
  winner: string | 'draw'
  amounts: Record<string, string> // bigint values as strings
  protocolFee: string
  builderFee: string
}

// ---------------------------------------------------------------------------
// GET /bout/games/:id/terminal
// ---------------------------------------------------------------------------

export type TerminalResponse = {
  terminated: boolean
}
