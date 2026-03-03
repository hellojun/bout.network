import { eq } from 'drizzle-orm'
import Redis from 'ioredis'

import { createDb } from '@bout/db'
import { agents, battles } from '@bout/db/schema'
import type { Action, GameState } from '@boutnetwork/game-sdk'

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
// Battle state for HTTP polling
// ---------------------------------------------------------------------------

async function setBattleState(
  battleId: string,
  data: {
    status: 'active' | 'finished'
    gameId: string
    agents: string[]
    round: number
    currentTurnAgentId: string | null
    timeoutMs: number
    availableTools: unknown[]
    gameState: unknown
    lastAction: { agentId: string; tool: string; events: unknown[] } | null
    winner: string | null
    finishReason: string | null
  },
): Promise<void> {
  const key = `battle:state:${battleId}`
  const value = JSON.stringify({
    ...data,
    battleId,
    updatedAt: new Date().toISOString(),
  })
  await redis.set(key, value, 'EX', 3600)
}

// ---------------------------------------------------------------------------
// Per-agent views in Redis
// ---------------------------------------------------------------------------

async function setAgentViews(
  battleId: string,
  state: GameState,
  agentIds: string[],
  game: { getAgentView(s: GameState, a: string): GameState | Promise<GameState> },
): Promise<void> {
  for (const agentId of agentIds) {
    const view = await game.getAgentView(state, agentId)
    const key = `battle:view:${battleId}:${agentId}`
    await redis.set(key, JSON.stringify(view), 'EX', 3600)
  }
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

  const game = await loadGame(battle.gameId)
  const agentIds = [battle.agentA, battle.agentB]

  let state = await game.initialState(agentIds, battle.wager)

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

  // Write initial battle state to Redis for HTTP polling
  const initialAgent = await game.currentAgent(state)
  await setBattleState(battleId, {
    status: 'active',
    gameId: battle.gameId,
    agents: agentIds,
    round: 0,
    currentTurnAgentId: initialAgent,
    timeoutMs: game.meta.turnTimeoutMs,
    availableTools: game.tools,
    gameState: state,
    lastAction: null,
    winner: null,
    finishReason: null,
  })
  await setAgentViews(battleId, state, agentIds, game)

  const replayData: unknown[] = []

  for (let round = 1; round <= game.meta.maxRounds; round++) {
    const currentAgentId = await game.currentAgent(state)

    // Build per-agent view for the current player
    const agentView = await game.getAgentView(state, currentAgentId)

    // Notify current player it is their turn
    await publishEvent(
      battleId,
      'battle:your_turn',
      {
        round,
        timeoutMs: game.meta.turnTimeoutMs,
        availableTools: game.tools,
        gameState: agentView,
      },
      [currentAgentId],
    )

    // Update Redis state: it's this agent's turn
    await setBattleState(battleId, {
      status: 'active',
      gameId: battle.gameId,
      agents: agentIds,
      round,
      currentTurnAgentId: currentAgentId,
      timeoutMs: game.meta.turnTimeoutMs,
      availableTools: game.tools,
      gameState: state,
      lastAction: null,
      winner: null,
      finishReason: null,
    })

    const action = await waitForAction(currentAgentId, battleId, game.meta.turnTimeoutMs)

    // --- Forfeit ---
    if (action.tool === 'forfeit') {
      let forfeitState: GameState
      if (game.forfeit) {
        forfeitState = await game.forfeit(state, currentAgentId)
      } else {
        // Engine-level default: opponent wins, construct settlement directly
        const opponentId = agentIds[0] === currentAgentId ? agentIds[1] : agentIds[0]
        const totalPot = battle.wager * 2n
        const feeBps = battle.feeBps ?? 1000
        const fee = totalPot * BigInt(feeBps) / 10000n
        const prize = totalPot - fee

        const settlement = {
          winner: opponentId,
          amounts: { [opponentId]: prize, [currentAgentId]: 0n },
          protocolFee: fee,
          builderFee: 0n,
        }

        replayData.push({
          round,
          agentId: currentAgentId,
          action,
          result: { events: [{ type: 'forfeit' }] },
        })
        await db.update(battles).set({ replayData }).where(eq(battles.id, battleId))

        await executeSettlement(battleId, settlement, battle, db)
        await setBattleState(battleId, {
          status: 'finished',
          gameId: battle.gameId,
          agents: agentIds,
          round,
          currentTurnAgentId: null,
          timeoutMs: 0,
          availableTools: [],
          gameState: state,
          lastAction: { agentId: currentAgentId, tool: 'forfeit', events: [{ type: 'forfeit' }] },
          winner: settlement.winner,
          finishReason: 'forfeit',
        })
        await publishEvent(
          battleId,
          'battle:finished',
          { winner: settlement.winner, reason: 'forfeit' },
          agentIds,
        )
        return
      }

      const settlement = await game.settle(forfeitState, battle.wager, battle.feeBps ?? 1000)

      replayData.push({
        round,
        agentId: currentAgentId,
        action,
        result: { events: [{ type: 'forfeit' }] },
      })
      await db.update(battles).set({ replayData }).where(eq(battles.id, battleId))

      await executeSettlement(battleId, settlement, battle, db)
      await setBattleState(battleId, {
        status: 'finished',
        gameId: battle.gameId,
        agents: agentIds,
        round,
        currentTurnAgentId: null,
        timeoutMs: 0,
        availableTools: [],
        gameState: forfeitState,
        lastAction: { agentId: currentAgentId, tool: 'forfeit', events: [{ type: 'forfeit' }] },
        winner: settlement.winner,
        finishReason: 'forfeit',
      })
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
      await setBattleState(battleId, {
        status: 'active',
        gameId: battle.gameId,
        agents: agentIds,
        round,
        currentTurnAgentId: currentAgentId,
        timeoutMs: game.meta.turnTimeoutMs,
        availableTools: game.tools,
        gameState: state,
        lastAction: { agentId: currentAgentId, tool: 'pass', events: [{ type: 'timeout' }] },
        winner: null,
        finishReason: null,
      })
      continue
    }

    // --- Normal action ---
    const validated = validateAction(action, game.tools)
    const result = await game.applyAction(state, currentAgentId, validated)
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

    // Update per-agent views
    await setAgentViews(battleId, state, agentIds, game)

    // Check if game ended
    const terminated = result.terminated || await game.isTerminal(state)
    if (terminated) {
      const settlement = await game.settle(state, battle.wager, battle.feeBps ?? 1000)
      await executeSettlement(battleId, settlement, battle, db)
      await setBattleState(battleId, {
        status: 'finished',
        gameId: battle.gameId,
        agents: agentIds,
        round,
        currentTurnAgentId: null,
        timeoutMs: 0,
        availableTools: [],
        gameState: state,
        lastAction: { agentId: currentAgentId, tool: validated.tool, events: result.events },
        winner: settlement.winner,
        finishReason: 'terminal',
      })
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
  const settlement = await game.settle(state, battle.wager, battle.feeBps ?? 1000)
  await db.update(battles).set({ replayData }).where(eq(battles.id, battleId))
  await executeSettlement(battleId, settlement, battle, db)
  await setBattleState(battleId, {
    status: 'finished',
    gameId: battle.gameId,
    agents: agentIds,
    round: game.meta.maxRounds,
    currentTurnAgentId: null,
    timeoutMs: 0,
    availableTools: [],
    gameState: state,
    lastAction: null,
    winner: settlement.winner,
    finishReason: 'max_rounds',
  })
  await publishEvent(
    battleId,
    'battle:finished',
    { winner: settlement.winner, reason: 'max_rounds' },
    agentIds,
  )
}
