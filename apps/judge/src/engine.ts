import { eq } from 'drizzle-orm'
import Redis from 'ioredis'

import { createDb } from '@bout/db'
import { agents, battles } from '@bout/db/schema'
import type { Action, GameState } from '@bout/game-sdk'

import { recordDeposit } from './chain.js'
import { loadGame } from './loader.js'
import { executeSettlement } from './settlement.js'

// ---------------------------------------------------------------------------
// Shared connections
// ---------------------------------------------------------------------------

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
const db = createDb(
  process.env.DATABASE_URL || 'postgresql://bout:bout@localhost:5432/bout',
)

// ---------------------------------------------------------------------------
// Redis pub/sub helpers
// ---------------------------------------------------------------------------

async function publishEvent(
  battleId: string,
  event: string,
  data: unknown,
  agentIds?: string[],
): Promise<void> {
  await redis.publish(
    'battle:events',
    JSON.stringify({ battleId, event, data, agentIds }),
  )
}

// ---------------------------------------------------------------------------
// Action helpers
// ---------------------------------------------------------------------------

const MAX_TIMEOUTS = 3

async function waitForAction(
  agentId: string,
  battleId: string,
  timeoutMs: number,
): Promise<Action> {
  const key = `action:${battleId}:${agentId}`
  const result = await redis.blpop(key, Math.ceil(timeoutMs / 1000))

  if (!result) {
    const timeoutKey = `timeout:${battleId}:${agentId}`
    const count = await redis.incr(timeoutKey)
    if (count >= MAX_TIMEOUTS) {
      return { tool: 'forfeit', args: {} }
    }
    return { tool: 'pass', args: {} }
  }

  return JSON.parse(result[1])
}

function validateAction(action: Action, tools: { name: string }[]): Action {
  if (action.tool === 'pass' || action.tool === 'forfeit') {
    return action
  }
  const isKnownTool = tools.some((t) => t.name === action.tool)
  if (!isKnownTool) {
    return { tool: 'pass', args: {} }
  }
  return action
}

// ---------------------------------------------------------------------------
// Core battle loop
// ---------------------------------------------------------------------------

export async function runBattle(battleId: string): Promise<void> {
  const [battle] = await db.select().from(battles).where(eq(battles.id, battleId))
  if (!battle) throw new Error(`Battle not found: ${battleId}`)

  const game = loadGame(battle.gameId)
  const agentIds = [battle.agentA, battle.agentB]

  let state = game.initialState(agentIds, battle.wager)

  await publishEvent(
    battleId,
    'battle:start',
    {
      battleId,
      gameId: battle.gameId,
      agentA: battle.agentA,
      agentB: battle.agentB,
      wager: battle.wager.toString(),
      maxRounds: game.meta.maxRounds,
    },
    agentIds,
  )

  // Record deposits on-chain (bookkeeping for the Escrow contract)
  const wagerUsdc6 = battle.wager * 1000n // internal tokens → USDC 6 decimals
  const [agentARecord] = await db.select().from(agents).where(eq(agents.id, battle.agentA)).limit(1)
  const [agentBRecord] = await db.select().from(agents).where(eq(agents.id, battle.agentB)).limit(1)

  if (agentARecord?.walletAddress && agentBRecord?.walletAddress) {
    try {
      await recordDeposit(battleId, agentARecord.walletAddress, wagerUsdc6)
      await recordDeposit(battleId, agentBRecord.walletAddress, wagerUsdc6)
    } catch (err) {
      console.error(`[chain] recordDeposit failed for battle ${battleId}:`, err)
    }
  }

  const replayData: unknown[] = []

  for (let round = 1; round <= game.meta.maxRounds; round++) {
    const currentState = state as Record<string, unknown>
    const currentAgentIndex = currentState.currentColor === 1 ? 0 : 1
    const currentAgentId = agentIds[currentAgentIndex]

    // Notify current player it is their turn
    await publishEvent(
      battleId,
      'battle:your_turn',
      {
        round,
        timeoutMs: game.meta.turnTimeoutMs,
        availableTools: game.tools,
        gameState: {
          ...currentState,
          myColor: currentState.currentColor,
          opponentColor: currentState.currentColor === 1 ? 2 : 1,
        },
      },
      [currentAgentId],
    )

    const action = await waitForAction(currentAgentId, battleId, game.meta.turnTimeoutMs)

    // --- Forfeit ---
    if (action.tool === 'forfeit') {
      const winnerColor = currentState.currentColor === 1 ? 2 : 1
      const forfeitState = { ...currentState, winner: winnerColor } as GameState
      const settlement = game.settle(forfeitState, battle.wager, battle.feeBps ?? 1000)

      replayData.push({
        round,
        agentId: currentAgentId,
        action,
        result: { events: [{ type: 'forfeit' }] },
      })
      await db.update(battles).set({ replayData }).where(eq(battles.id, battleId))

      await executeSettlement(battleId, settlement, battle, db)
      await publishEvent(
        battleId,
        'battle:finished',
        { winner: settlement.winner, reason: 'forfeit' },
        agentIds,
      )
      return
    }

    // --- Pass (timeout) ---
    if (action.tool === 'pass') {
      await publishEvent(
        battleId,
        'battle:turn_result',
        {
          round,
          agentId: currentAgentId,
          tool: 'pass',
          result: [{ type: 'timeout' }],
          tokenDeltas: {},
        },
        agentIds,
      )
      replayData.push({
        round,
        agentId: currentAgentId,
        action,
        result: { events: [{ type: 'timeout' }] },
      })
      continue
    }

    // --- Normal action ---
    const validated = validateAction(action, game.tools)
    const result = game.applyAction(state, currentAgentId, validated)
    state = result.newState

    replayData.push({
      round,
      agentId: currentAgentId,
      action: validated,
      events: result.events,
    })

    // Persist replay data periodically and on termination
    if (round % 5 === 0 || result.terminated) {
      await db.update(battles).set({ replayData }).where(eq(battles.id, battleId))
    }

    await publishEvent(
      battleId,
      'battle:turn_result',
      {
        round,
        agentId: currentAgentId,
        tool: validated.tool,
        events: result.events,
        tokenDeltas: result.tokenDeltas,
      },
      agentIds,
    )

    // Check if game ended
    if (result.terminated || game.isTerminal(state)) {
      const settlement = game.settle(state, battle.wager, battle.feeBps ?? 1000)
      await executeSettlement(battleId, settlement, battle, db)
      await publishEvent(
        battleId,
        'battle:finished',
        {
          winner: settlement.winner,
          amounts: Object.fromEntries(
            Object.entries(settlement.amounts).map(([k, v]) => [k, v.toString()]),
          ),
          protocolFee: settlement.protocolFee.toString(),
        },
        agentIds,
      )
      return
    }
  }

  // Max rounds reached -- settle based on current state
  const settlement = game.settle(state, battle.wager, battle.feeBps ?? 1000)
  await db.update(battles).set({ replayData }).where(eq(battles.id, battleId))
  await executeSettlement(battleId, settlement, battle, db)
  await publishEvent(
    battleId,
    'battle:finished',
    { winner: settlement.winner, reason: 'max_rounds' },
    agentIds,
  )
}
