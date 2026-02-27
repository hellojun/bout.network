import { createPublicClient, createWalletClient, http, type Account } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

import { boutEscrowAbi, battleIdToBytes32, ZERO_ADDRESS } from '@bout/contracts'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CHAIN_ENABLED = process.env.CHAIN_SETTLEMENT_ENABLED === 'true'
const ESCROW_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS as `0x${string}` | undefined
const JUDGE_KEY = process.env.JUDGE_PRIVATE_KEY as string | undefined
const RPC_URL = process.env.BASE_RPC_URL || 'https://sepolia.base.org'

// ---------------------------------------------------------------------------
// Lazy-initialised clients
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _publicClient: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _walletClient: any = null
let _account: Account | null = null

function init() {
  if (_walletClient) return
  if (!JUDGE_KEY) throw new Error('JUDGE_PRIVATE_KEY not set')

  const key = (JUDGE_KEY.startsWith('0x') ? JUDGE_KEY : `0x${JUDGE_KEY}`) as `0x${string}`
  _account = privateKeyToAccount(key)

  _publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  })

  _walletClient = createWalletClient({
    account: _account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  })
}

function getEscrowAddress(): `0x${string}` {
  if (!ESCROW_ADDRESS) throw new Error('ESCROW_CONTRACT_ADDRESS not set')
  return ESCROW_ADDRESS
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a deposit in the BoutEscrow contract.
 * Called by Judge before battle starts (once per agent).
 */
export async function recordDeposit(
  battleId: string,
  agentWallet: string,
  amountUsdc6: bigint,
): Promise<string | null> {
  if (!CHAIN_ENABLED) return null

  init()
  const escrow = getEscrowAddress()

  const hash = await _walletClient.writeContract({
    account: _account,
    chain: baseSepolia,
    address: escrow,
    abi: boutEscrowAbi,
    functionName: 'recordDeposit',
    args: [
      battleIdToBytes32(battleId),
      agentWallet as `0x${string}`,
      amountUsdc6,
    ],
  })

  await _publicClient.waitForTransactionReceipt({ hash })
  console.log(`[chain] recordDeposit: battle=${battleId} agent=${agentWallet} amount=${amountUsdc6} tx=${hash}`)
  return hash
}

/**
 * Settle a battle on-chain via BoutEscrow.settle().
 * Returns the tx hash on success, null if chain is disabled.
 */
export async function settleOnChain(
  battleId: string,
  winnerWallet: string | null,
  feeBps: number,
): Promise<string | null> {
  if (!CHAIN_ENABLED) return null

  init()
  const escrow = getEscrowAddress()

  const winner = winnerWallet
    ? (winnerWallet as `0x${string}`)
    : (ZERO_ADDRESS as `0x${string}`)

  const hash = await _walletClient.writeContract({
    account: _account,
    chain: baseSepolia,
    address: escrow,
    abi: boutEscrowAbi,
    functionName: 'settle',
    args: [battleIdToBytes32(battleId), winner, feeBps],
  })

  await _publicClient.waitForTransactionReceipt({ hash })
  console.log(`[chain] settle: battle=${battleId} winner=${winnerWallet || 'draw'} fee=${feeBps}bps tx=${hash}`)
  return hash
}

/**
 * Refund a battle on-chain via BoutEscrow.refund().
 */
export async function refundOnChain(
  battleId: string,
): Promise<string | null> {
  if (!CHAIN_ENABLED) return null

  init()
  const escrow = getEscrowAddress()

  const hash = await _walletClient.writeContract({
    account: _account,
    chain: baseSepolia,
    address: escrow,
    abi: boutEscrowAbi,
    functionName: 'refund',
    args: [battleIdToBytes32(battleId)],
  })

  await _publicClient.waitForTransactionReceipt({ hash })
  console.log(`[chain] refund: battle=${battleId} tx=${hash}`)
  return hash
}

/**
 * Refund a room's deposit on-chain.
 *
 * When a room expires or is cancelled before matching, the creator's USDC
 * (paid via x402 at room creation) is sitting in the Escrow contract but
 * untracked. We first call recordDeposit to register it under the roomId,
 * then immediately call refund to send the full amount back — no fee.
 */
export async function refundRoom(
  roomId: string,
  creatorWallet: string,
  amountUsdc6: bigint,
): Promise<string | null> {
  if (!CHAIN_ENABLED) return null

  init()
  const escrow = getEscrowAddress()
  const roomBytes32 = battleIdToBytes32(roomId)

  // Step 1: Record the deposit so the contract knows about it
  const depositHash = await _walletClient.writeContract({
    account: _account,
    chain: baseSepolia,
    address: escrow,
    abi: boutEscrowAbi,
    functionName: 'recordDeposit',
    args: [roomBytes32, creatorWallet as `0x${string}`, amountUsdc6],
  })
  await _publicClient.waitForTransactionReceipt({ hash: depositHash })

  // Step 2: Refund — sends full totalWager back to agentA (creator)
  const refundHash = await _walletClient.writeContract({
    account: _account,
    chain: baseSepolia,
    address: escrow,
    abi: boutEscrowAbi,
    functionName: 'refund',
    args: [roomBytes32],
  })
  await _publicClient.waitForTransactionReceipt({ hash: refundHash })

  console.log(`[chain] refundRoom: room=${roomId} wallet=${creatorWallet} amount=${amountUsdc6} tx=${refundHash}`)
  return refundHash
}
