import type {
  Action,
  GameState,
  IGame,
  Settlement,
  TurnResult,
} from '@bout/game-sdk'
import { deepClone } from '@bout/game-sdk'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BOARD_SIZE = 15
const MAX_MOVES = BOARD_SIZE * BOARD_SIZE
const WIN_LENGTH = 5

// ---------------------------------------------------------------------------
// Gomoku-specific state
// ---------------------------------------------------------------------------

export type GomokuState = {
  board: number[][] // 0 = empty, 1 = black, 2 = white
  currentColor: 1 | 2
  moveCount: number
  lastMove: { row: number; col: number; color: number } | null
  winner: 1 | 2 | null
  agents: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGomoku(state: GameState): GomokuState {
  return state as unknown as GomokuState
}

function toGameState(state: GomokuState): GameState {
  return state as unknown as GameState
}

function createEmptyBoard(): number[][] {
  return Array.from({ length: BOARD_SIZE }, () => new Array<number>(BOARD_SIZE).fill(0))
}

function checkWin(board: number[][], row: number, col: number, color: number): boolean {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]

  for (const [dr, dc] of directions) {
    let count = 1

    for (const sign of [1, -1]) {
      let r = row + dr * sign
      let c = col + dc * sign
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === color) {
        count++
        r += dr * sign
        c += dc * sign
      }
    }

    if (count >= WIN_LENGTH) return true
  }

  return false
}

function findFirstEmpty(board: number[][]): { row: number; col: number } | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return { row: r, col: c }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Game implementation
// ---------------------------------------------------------------------------

export const Gomoku: IGame = {
  meta: {
    name: 'Gomoku',
    version: '1.0.0',
    minPlayers: 2,
    maxPlayers: 2,
    maxRounds: MAX_MOVES,
    turnTimeoutMs: 10_000,
  },

  tools: [
    {
      name: 'place_stone',
      description: 'Place a stone on the board. row and col range: 0-14.',
      args: {
        row: { type: 'integer', min: 0, max: BOARD_SIZE - 1 },
        col: { type: 'integer', min: 0, max: BOARD_SIZE - 1 },
      },
    },
  ],

  currentAgent(state: GameState): string {
    const s = toGomoku(state)
    return s.agents[s.currentColor === 1 ? 0 : 1]
  },

  getAgentView(state: GameState, agentId: string): GameState {
    const s = toGomoku(state)
    const myColor = agentId === s.agents[0] ? 1 : 2
    return { ...state, myColor, opponentColor: myColor === 1 ? 2 : 1 }
  },

  forfeit(state: GameState, agentId: string): GameState {
    const s = toGomoku(state)
    const winnerColor: 1 | 2 = agentId === s.agents[0] ? 2 : 1
    return toGameState({ ...s, winner: winnerColor })
  },

  initialState(agents: string[], _wager: bigint): GameState {
    const state: GomokuState = {
      board: createEmptyBoard(),
      currentColor: 1,
      moveCount: 0,
      lastMove: null,
      winner: null,
      agents,
    }
    return toGameState(state)
  },

  applyAction(state: GameState, agentId: string, action: Action): TurnResult {
    const s = deepClone(toGomoku(state))
    const myColor: 1 | 2 = agentId === s.agents[0] ? 1 : 2

    // Not this agent's turn -- return state unchanged
    if (myColor !== s.currentColor) {
      return { newState: toGameState(s), tokenDeltas: {}, events: [], terminated: false }
    }

    let row = action.args.row as number
    let col = action.args.col as number

    // Fall back to first empty cell when the move is invalid
    if (row < 0 || row > BOARD_SIZE - 1 || col < 0 || col > BOARD_SIZE - 1 || s.board[row][col] !== 0) {
      const empty = findFirstEmpty(s.board)
      if (!empty) {
        return { newState: toGameState(s), tokenDeltas: {}, events: [], terminated: true }
      }
      row = empty.row
      col = empty.col
    }

    s.board[row][col] = myColor
    s.lastMove = { row, col, color: myColor }
    s.moveCount++
    s.currentColor = myColor === 1 ? 2 : 1

    const won = checkWin(s.board, row, col, myColor)
    if (won) s.winner = myColor

    const terminated = won || s.moveCount >= MAX_MOVES

    return {
      newState: toGameState(s),
      tokenDeltas: {},
      events: [{ type: won ? 'win' : 'move', row, col, color: myColor }],
      terminated,
    }
  },

  isTerminal(state: GameState): boolean {
    const s = toGomoku(state)
    return s.winner !== null || s.moveCount >= MAX_MOVES
  },

  settle(state: GameState, wager: bigint, feeBps: number): Settlement {
    const s = toGomoku(state)
    const totalPot = wager * 2n
    const fee = totalPot * BigInt(feeBps) / 10000n
    const prize = totalPot - fee

    if (s.winner === 1) {
      return {
        winner: s.agents[0],
        amounts: { [s.agents[0]]: prize, [s.agents[1]]: 0n },
        protocolFee: fee,
        builderFee: 0n,
      }
    }

    if (s.winner === 2) {
      return {
        winner: s.agents[1],
        amounts: { [s.agents[0]]: 0n, [s.agents[1]]: prize },
        protocolFee: fee,
        builderFee: 0n,
      }
    }

    // Draw -- split pot evenly, each player absorbs half the fee
    const half = wager - fee / 2n
    return {
      winner: 'draw',
      amounts: { [s.agents[0]]: half, [s.agents[1]]: half },
      protocolFee: fee,
      builderFee: 0n,
    }
  },
}

export default Gomoku
