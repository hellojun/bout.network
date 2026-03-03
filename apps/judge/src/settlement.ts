import { createHash } from 'crypto'

import { eq } from 'drizzle-orm'

import type { Database } from '@bout/db'
import { agents, battleParticipants, battles } from '@bout/db/schema'
import type { Settlement } from '@boutnetwork/game-sdk'

import { settleOnChain } from './chain.js'

// ---------------------------------------------------------------------------
// ELO calculation
// ---------------------------------------------------------------------------

const K = 32

type EloResult = 'win' | 'loss' | 'draw'

function calculateElo(
  ratingA: number,
  ratingB: number,
  result: EloResult,
): { deltaA: number; deltaB: number } {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  const expectedB = 1 - expectedA

  let scoreA: number
  let scoreB: number

  if (result === 'win') {
    scoreA = 1
    scoreB = 0
  } else if (result === 'loss') {
    scoreA = 0
    scoreB = 1
  } else {
    scoreA = 0.5
    scoreB = 0.5
  }

  return {
    deltaA: Math.round(K * (scoreA - expectedA)),
    deltaB: Math.round(K * (scoreB - expectedB)),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

// ---------------------------------------------------------------------------
// Settlement execution
// ---------------------------------------------------------------------------

export async function executeSettlement(
  battleId: string,
  settlement: Settlement,
  battle: any,
  db: Database,
): Promise<void> {
  // Calculate replay hash
  const [battleRecord] = await db
    .select()
    .from(battles)
    .where(eq(battles.id, battleId))
    .limit(1)
  const replayHash = sha256(JSON.stringify(battleRecord?.replayData || []))

  // Determine outcome
  const isWinnerA = settlement.winner === battle.agentA
  const isWinnerB = settlement.winner === battle.agentB
  const isDraw = settlement.winner === 'draw'

  // Get agent ratings + wallet addresses
  const [agentA] = await db.select().from(agents).where(eq(agents.id, battle.agentA))
  const [agentB] = await db.select().from(agents).where(eq(agents.id, battle.agentB))

  // Settle on-chain (returns real tx hash when CHAIN_SETTLEMENT_ENABLED=true)
  let settlementTx: string
  try {
    const winnerWallet = isDraw
      ? null
      : isWinnerA
        ? agentA?.walletAddress ?? null
        : agentB?.walletAddress ?? null

    const txHash = await settleOnChain(battleId, winnerWallet, battle.feeBps ?? 1000)
    settlementTx = txHash || `0x${sha256(battleId + Date.now())}`
  } catch (err) {
    console.error(`[chain] settle failed for battle ${battleId}:`, err)
    settlementTx = `0x${sha256(battleId + Date.now())}`
  }

  const ratingA = agentA?.rating ?? 1000
  const ratingB = agentB?.rating ?? 1000
  const winsA = agentA?.wins ?? 0
  const lossesA = agentA?.losses ?? 0
  const drawsA = agentA?.draws ?? 0
  const winsB = agentB?.wins ?? 0
  const lossesB = agentB?.losses ?? 0
  const drawsB = agentB?.draws ?? 0

  let eloResult: EloResult
  if (isWinnerA) {
    eloResult = 'win'
  } else if (isWinnerB) {
    eloResult = 'loss'
  } else {
    eloResult = 'draw'
  }

  const { deltaA, deltaB } = calculateElo(ratingA, ratingB, eloResult)

  // Update battle record
  await db
    .update(battles)
    .set({
      status: 'finished',
      winnerId: isDraw ? null : settlement.winner,
      replayHash,
      settlementTx,
      finishedAt: new Date(),
    })
    .where(eq(battles.id, battleId))

  // Update agent A stats
  await db
    .update(agents)
    .set({
      rating: ratingA + deltaA,
      wins: isWinnerA ? winsA + 1 : winsA,
      losses: isWinnerB ? lossesA + 1 : lossesA,
      draws: isDraw ? drawsA + 1 : drawsA,
    })
    .where(eq(agents.id, battle.agentA))

  // Update agent B stats
  await db
    .update(agents)
    .set({
      rating: ratingB + deltaB,
      wins: isWinnerB ? winsB + 1 : winsB,
      losses: isWinnerA ? lossesB + 1 : lossesB,
      draws: isDraw ? drawsB + 1 : drawsB,
    })
    .where(eq(agents.id, battle.agentB))

  // Update participant A
  await db
    .update(battleParticipants)
    .set({
      finalToken: settlement.amounts[battle.agentA] || 0n,
      pnl: (settlement.amounts[battle.agentA] || 0n) - battle.wager,
      eloAfter: ratingA + deltaA,
      eloDelta: deltaA,
    })
    .where(eq(battleParticipants.agentId, battle.agentA))

  // Update participant B
  await db
    .update(battleParticipants)
    .set({
      finalToken: settlement.amounts[battle.agentB] || 0n,
      pnl: (settlement.amounts[battle.agentB] || 0n) - battle.wager,
      eloAfter: ratingB + deltaB,
      eloDelta: deltaB,
    })
    .where(eq(battleParticipants.agentId, battle.agentB))
}
