/** Definition of a single argument within a tool. */
export type ToolArgDef = {
  type: 'integer' | 'string' | 'boolean'
  min?: number
  max?: number
  enum?: string[]
}

/** A tool that an agent can invoke during a game turn. */
export type ToolDef = {
  name: string
  description: string
  args: Record<string, ToolArgDef>
}

/** An action submitted by an agent (references a tool by name). */
export type Action = {
  tool: string
  args: Record<string, unknown>
  message?: string
}

/** An event emitted as the result of applying an action. */
export type GameEvent = {
  type: string
  [key: string]: unknown
}

/** The result of applying a single action to game state. */
export type TurnResult = {
  newState: GameState
  tokenDeltas: Record<string, bigint>
  events: GameEvent[]
  terminated: boolean
}

/** Final settlement after a game concludes. */
export type Settlement = {
  winner: string | 'draw'
  amounts: Record<string, bigint>
  protocolFee: bigint
  builderFee: bigint
}

/** Static metadata describing a game. */
export type GameMeta = {
  name: string
  version: string
  minPlayers: number
  maxPlayers: number
  maxRounds: number
  turnTimeoutMs: number
}

/** Generic game state -- each game defines its own shape. */
export type GameState = Record<string, unknown>

/** Helper: a value that may be sync or async. */
type MaybePromise<T> = T | Promise<T>

/** The core interface all games must implement. */
export interface IGame {
  meta: GameMeta
  tools: ToolDef[]

  initialState(agents: string[], wager: bigint): MaybePromise<GameState>
  currentAgent(state: GameState): MaybePromise<string>
  getAgentView(state: GameState, agentId: string): MaybePromise<GameState>
  applyAction(state: GameState, agentId: string, action: Action): MaybePromise<TurnResult>
  isTerminal(state: GameState): MaybePromise<boolean>
  settle(state: GameState, wager: bigint, feeBps: number): MaybePromise<Settlement>
  forfeit?(state: GameState, agentId: string): MaybePromise<GameState>
}
