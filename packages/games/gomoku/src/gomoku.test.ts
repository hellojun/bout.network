import { describe, expect, it } from 'vitest'

import { Gomoku, GomokuState } from './index.js'

function toGomoku(state: Record<string, unknown>): GomokuState {
  return state as unknown as GomokuState
}

describe('Gomoku', () => {
  const agents = ['agent_a', 'agent_b']

  it('initializes a 15x15 empty board', () => {
    const state = toGomoku(Gomoku.initialState(agents, 100n))
    expect(state.board.length).toBe(15)
    expect(state.board[0].length).toBe(15)
    expect(state.currentColor).toBe(1)
    expect(state.moveCount).toBe(0)
  })

  it('places stones alternately', () => {
    const state = Gomoku.initialState(agents, 100n)

    const r1 = Gomoku.applyAction(state, 'agent_a', { tool: 'place_stone', args: { row: 7, col: 7 } })
    expect(r1.events[0].type).toBe('move')
    expect(toGomoku(r1.newState).board[7][7]).toBe(1)

    const r2 = Gomoku.applyAction(r1.newState, 'agent_b', { tool: 'place_stone', args: { row: 7, col: 8 } })
    expect(toGomoku(r2.newState).board[7][8]).toBe(2)
  })

  it('detects horizontal win', () => {
    let state = Gomoku.initialState(agents, 100n)

    // Black: (7,3)(7,4)(7,5)(7,6)(7,7) -- five in a row
    // White: (8,3)(8,4)(8,5)(8,6)
    const moves = [
      ['agent_a', 7, 3],
      ['agent_b', 8, 3],
      ['agent_a', 7, 4],
      ['agent_b', 8, 4],
      ['agent_a', 7, 5],
      ['agent_b', 8, 5],
      ['agent_a', 7, 6],
      ['agent_b', 8, 6],
      ['agent_a', 7, 7],
    ] as const

    for (const [agent, row, col] of moves) {
      const result = Gomoku.applyAction(state, agent, { tool: 'place_stone', args: { row, col } })
      state = result.newState
      if (result.terminated) {
        expect(result.events[0].type).toBe('win')
        break
      }
    }

    expect(toGomoku(state).winner).toBe(1)
  })

  it('settles correctly for winner', () => {
    const state = toGomoku(Gomoku.initialState(agents, 100n))
    state.winner = 1

    const settlement = Gomoku.settle(state as unknown as Record<string, unknown>, 100n, 300)

    expect(settlement.winner).toBe('agent_a')
    expect(settlement.protocolFee).toBe(6n) // 200 * 300 / 10000 = 6
    expect(settlement.amounts['agent_a']).toBe(194n) // 200 - 6
  })

  it('settles draw correctly', () => {
    const state = toGomoku(Gomoku.initialState(agents, 100n))
    state.winner = null
    state.moveCount = 225

    const settlement = Gomoku.settle(state as unknown as Record<string, unknown>, 100n, 300)

    expect(settlement.winner).toBe('draw')
  })

  it('handles invalid move (occupied position)', () => {
    const state = Gomoku.initialState(agents, 100n)

    const r1 = Gomoku.applyAction(state, 'agent_a', { tool: 'place_stone', args: { row: 7, col: 7 } })

    // Agent B tries the same position -- should fall back to first empty cell (0,0)
    const r2 = Gomoku.applyAction(r1.newState, 'agent_b', { tool: 'place_stone', args: { row: 7, col: 7 } })
    expect(toGomoku(r2.newState).board[0][0]).toBe(2)
  })
})
